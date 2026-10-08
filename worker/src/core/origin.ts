// [Define404] 가게냥 (gage-meo): 다른 사이트에서 보낸 쓰기 요청 막기
// 브라우저는 다른 사이트의 페이지에서도 text/plain POST 를 미리 묻지 않고 보낼 수 있다.
// 그래서 쓰기 요청은 Origin(없으면 Sec-Fetch-Site)으로 같은 사이트인지 보고, JSON API 는 Content-Type 도 본다.

export type WriteGuard = { ok: true } | { ok: false; status: 403 | 415; error: string };

const WRITE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isWrite(method: string): boolean {
  return WRITE.has(method.toUpperCase());
}

// 허용 출처: 이 사이트 자신의 주소, ALLOWED_ORIGINS(쉼표 구분), 시험 모드(MOCK=1)에서는 http://localhost 계열
export function allowedOrigins(requestUrl: string, extra?: string, dev = false): Set<string> {
  const set = new Set<string>([new URL(requestUrl).origin]);
  for (const o of (extra || "").split(",")) {
    const v = o.trim().replace(/\/+$/, "");
    if (v) set.add(v);
  }
  if (dev) set.add("http://localhost");
  return set;
}

const isLocal = (o: string) => /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);

export function checkOrigin(
  h: { origin?: string | null; fetchSite?: string | null },
  allowed: Set<string>,
): WriteGuard {
  const deny: WriteGuard = { ok: false, status: 403, error: "origin not allowed" };
  const o = h.origin;
  if (o === "null") {
    // 개인 정보 보호 설정 등으로 Origin 이 "null" 이면 브라우저가 붙이는 Sec-Fetch-Site 로 같은 사이트인지 본다
    return h.fetchSite === "same-origin" ? { ok: true } : deny;
  }
  if (o) {
    if (allowed.has(o)) return { ok: true };
    if (allowed.has("http://localhost") && isLocal(o)) return { ok: true };
    return deny;
  }
  // Origin 이 없으면: 브라우저가 다른 사이트라고 밝힌 요청만 막고, 머리글이 없는 서버·메일 프로그램 요청은 통과
  if (h.fetchSite === "cross-site") return deny;
  return { ok: true };
}

export function isJson(contentType?: string | null): boolean {
  return (contentType || "").split(";")[0].trim().toLowerCase() === "application/json";
}
