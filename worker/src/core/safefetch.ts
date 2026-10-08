// 사용자가 넣은 주소를 서버가 대신 여는 곳. 내부망을 엿보는 데 쓰이지 않게 막는다 (SSRF 방지)
// - http, https 만
// - 기본 포트(80, 443)만
// - 사설·루프백·링크로컬 등 공인 인터넷이 아닌 IP는 막는다 (주소 이름은 DNS로 풀어서 확인)
// - 리다이렉트는 최대 3번, 매번 다시 검사
// - 시간 제한, 크기 제한

export type Resolver = (host: string) => Promise<string[]>;

export class BlockedUrlError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

// ---------- IP 판별 ----------

function v4ToInt(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const p = m.slice(1).map(Number);
  if (p.some((n) => n > 255)) return null;
  return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
}

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function v4Blocked(ip: string): boolean {
  const n = v4ToInt(ip);
  if (n === null) return true;
  return V4_BLOCKED.some(([base, bits]) => {
    const b = v4ToInt(base)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((b & mask) >>> 0);
  });
}

// IPv6 를 16비트 8칸으로 펼친다
function v6Groups(ip: string): number[] | null {
  let s = ip.replace(/^\[|\]$/g, "").toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  // 끝에 IPv4 표기가 붙은 경우 (::ffff:1.2.3.4)
  const tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const n = v4ToInt(tail[1]);
    if (n === null) return null;
    s = s.slice(0, -tail[1].length) + ((n >>> 16) & 0xffff).toString(16) + ":" + (n & 0xffff).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0) return null;
  const all = [...head, ...Array(fill).fill("0"), ...rest];
  if (all.length !== 8) return null;
  const nums = all.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

function v6Blocked(ip: string): boolean {
  const g = v6Groups(ip);
  if (!g) return true;
  const allZeroBefore = (i: number) => g.slice(0, i).every((x) => x === 0);
  const embeddedV4 = () => `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  if (allZeroBefore(8)) return true; // ::
  if (allZeroBefore(7) && g[7] === 1) return true; // ::1
  if (allZeroBefore(5) && g[5] === 0xffff) return v4Blocked(embeddedV4()); // ::ffff:a.b.c.d
  if (allZeroBefore(6)) return true; // ::a.b.c.d (옛 표기)
  if (g[0] === 0x64 && g[1] === 0xff9b) return v4Blocked(embeddedV4()); // NAT64
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 고유 로컬
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 링크로컬
  if ((g[0] & 0xff00) === 0xff00) return true; // 멀티캐스트
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // 문서용
  return false;
}

export function isIpLiteral(host: string): boolean {
  return v4ToInt(host) !== null || host.includes(":");
}

// 공인 인터넷 주소가 아니면 true
export function isBlockedIp(ip: string): boolean {
  return ip.includes(":") ? v6Blocked(ip) : v4Blocked(ip);
}

// ---------- 주소 모양 검사 (DNS 전) ----------

export function checkUrlShape(input: string | URL): URL {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : input;
  } catch {
    throw new BlockedUrlError("주소 형식이 올바르지 않습니다");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError("http, https 주소만 확인합니다");
  if (url.username || url.password) throw new BlockedUrlError("아이디·비밀번호가 들어간 주소는 확인하지 않습니다");
  if (url.port !== "") throw new BlockedUrlError("기본 포트(80, 443)가 아닌 주소는 확인하지 않습니다");
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  if (!host) throw new BlockedUrlError("주소 형식이 올바르지 않습니다");
  if (host === "localhost" || /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(host)) {
    throw new BlockedUrlError("내부 주소는 확인하지 않습니다");
  }
  const bare = host.replace(/^\[|\]$/g, "");
  if (isIpLiteral(bare)) {
    if (isBlockedIp(bare)) throw new BlockedUrlError("공개되지 않은 IP 주소는 확인하지 않습니다");
  } else if (!host.includes(".")) {
    throw new BlockedUrlError("도메인 주소가 아닙니다");
  }
  return url;
}

// ---------- DNS 확인 ----------

// Cloudflare DNS-over-HTTPS 로 A·AAAA 레코드를 받는다
export const dohResolve: Resolver = async (host) => {
  const out: string[] = [];
  for (const type of ["A", "AAAA"]) {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) continue;
    const data = (await res.json()) as { Answer?: { type: number; data: string }[] };
    for (const a of data.Answer ?? []) if (a.type === 1 || a.type === 28) out.push(a.data);
  }
  return out;
};

export type Guard = (url: URL) => Promise<void>;

// 기본 검사: 모양 검사 + 이름을 풀어 나온 IP가 하나라도 내부망이면 막는다
export function strictGuard(resolve: Resolver = dohResolve): Guard {
  return async (url) => {
    checkUrlShape(url);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIpLiteral(host)) return;
    const ips = await resolve(host);
    if (!ips.length) throw new BlockedUrlError("주소를 찾을 수 없습니다");
    if (ips.some(isBlockedIp)) throw new BlockedUrlError("공개되지 않은 IP로 연결되는 주소는 확인하지 않습니다");
  };
}

// ---------- 안전한 가져오기 ----------

export type SafeFetchOptions = {
  guard: Guard;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

export type SafeResponse = {
  url: string; // 리다이렉트 후 최종 주소
  status: number;
  headers: Headers;
  body: string;
  truncated: boolean;
  elapsedMs: number; // 첫 요청부터 마지막 응답 헤더까지
  redirects: string[];
};

export async function safeFetch(input: string, opts: SafeFetchOptions): Promise<SafeResponse> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxRedirects = opts.maxRedirects ?? 3;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const maxBytes = opts.maxBytes ?? 1_500_000;
  const signal = AbortSignal.timeout(timeoutMs);
  const redirects: string[] = [];
  let url = checkUrlShape(input);
  const started = Date.now();

  for (let hop = 0; ; hop++) {
    await opts.guard(url);
    const res = await fetchImpl(url.toString(), {
      redirect: "manual",
      signal,
      headers: { "user-agent": "gage-meo/0.1 (+https://github.com/johndefine404/gage-meo)", accept: "text/html,*/*;q=0.8" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel();
      if (hop >= maxRedirects) throw new BlockedUrlError(`리다이렉트가 ${maxRedirects}번을 넘습니다`);
      url = checkUrlShape(new URL(res.headers.get("location")!, url));
      redirects.push(url.toString());
      continue;
    }
    const elapsedMs = Date.now() - started;
    const { text, truncated } = await readLimited(res, maxBytes);
    return { url: url.toString(), status: res.status, headers: res.headers, body: text, truncated, elapsedMs, redirects };
  }
}

async function readLimited(res: Response, maxBytes: number): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: "", truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (size + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - size));
      size = maxBytes;
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    size += value.byteLength;
  }
  const buf = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return { text: decode(buf, res.headers.get("content-type")), truncated };
}

// 오래된 한국 사이트는 EUC-KR 이 많다. 지원되지 않으면 UTF-8 로 읽는다
function decode(buf: Uint8Array, contentType: string | null): string {
  let charset = contentType?.match(/charset=([\w-]+)/i)?.[1];
  if (!charset) {
    const head = new TextDecoder().decode(buf.subarray(0, 2048));
    charset = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  }
  try {
    return new TextDecoder(charset || "utf-8").decode(buf);
  } catch {
    return new TextDecoder().decode(buf);
  }
}
