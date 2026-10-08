import { describe, expect, it } from "vitest";
import { BlockedUrlError, checkUrlShape, isBlockedIp, safeFetch, strictGuard, type Resolver } from "../src/core/safefetch";

const publicResolver: Resolver = async () => ["93.184.216.34"];

describe("IP 판별", () => {
  it.each([
    "127.0.0.1",
    "127.10.0.1",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a00:1",
    "64:ff9b::a00:1",
    "not-an-ip",
  ])("%s 막음", (ip) => expect(isBlockedIp(ip)).toBe(true));

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "11.0.0.1", "2606:4700::1111", "::ffff:808:808"])("%s 통과", (ip) =>
    expect(isBlockedIp(ip)).toBe(false),
  );
});

describe("주소 모양 검사", () => {
  it.each([
    "http://127.0.0.1/",
    "http://127.1/",
    "http://2130706433/",
    "http://0x7f.0.0.1/",
    "http://10.0.0.5/admin",
    "http://169.254.169.254/latest/meta-data/",
    "http://192.168.0.1/",
    "http://localhost/",
    "http://LOCALHOST./",
    "http://foo.localhost/",
    "http://printer.local/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "file:///etc/passwd",
    "ftp://example.com/",
    "gopher://example.com/",
    "javascript:alert(1)",
    "https://example.com:8443/",
    "http://example.com:22/",
    "https://user:pass@example.com/",
    "http://intranet/",
    "not a url",
  ])("%s 막음", (u) => expect(() => checkUrlShape(u)).toThrow(BlockedUrlError));

  it.each(["https://example.com/", "http://example.com/a?b=1", "https://example.com:443/", "http://example.com:80/"])("%s 통과", (u) =>
    expect(checkUrlShape(u).hostname).toBe("example.com"),
  );
});

describe("DNS 결과 검사", () => {
  it("이름이 내부 IP로 풀리면 막는다", async () => {
    const g = strictGuard(async () => ["93.184.216.34", "10.0.0.5"]);
    await expect(g(new URL("https://evil.example/"))).rejects.toThrow(BlockedUrlError);
  });
  it("이름이 풀리지 않으면 막는다", async () => {
    await expect(strictGuard(async () => [])(new URL("https://nx.example/"))).rejects.toThrow(BlockedUrlError);
  });
  it("공인 IP면 통과", async () => {
    await expect(strictGuard(publicResolver)(new URL("https://ok.example/"))).resolves.toBeUndefined();
  });
});

// 가짜 fetch: 주소별 응답표
function fakeFetch(table: Record<string, () => Response>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const u = String(input);
    const f = table[u];
    if (!f) throw new Error(`unexpected fetch ${u}`);
    return f();
  }) as typeof fetch;
}
const redirect = (to: string) => () => new Response(null, { status: 302, headers: { location: to } });

describe("안전한 가져오기", () => {
  const guard = strictGuard(publicResolver);

  it("내부 주소로 넘기는 리다이렉트를 막는다", async () => {
    const fetchImpl = fakeFetch({ "https://a.example/": redirect("http://127.0.0.1/admin") });
    await expect(safeFetch("https://a.example/", { guard, fetchImpl })).rejects.toThrow(BlockedUrlError);
  });

  it("리다이렉트 대상의 DNS 도 다시 검사한다", async () => {
    const g = strictGuard(async (h) => (h === "inner.example" ? ["192.168.0.10"] : ["93.184.216.34"]));
    const fetchImpl = fakeFetch({ "https://a.example/": redirect("https://inner.example/") });
    await expect(safeFetch("https://a.example/", { guard: g, fetchImpl })).rejects.toThrow(/공개되지 않은 IP/);
  });

  it("리다이렉트 3번까지는 따라가고 4번째는 막는다", async () => {
    const ok = fakeFetch({
      "https://a.example/": redirect("https://a.example/1"),
      "https://a.example/1": redirect("/2"),
      "https://a.example/2": redirect("https://a.example/3"),
      "https://a.example/3": () => new Response("<title>끝</title>", { headers: { "content-type": "text/html" } }),
    });
    const r = await safeFetch("https://a.example/", { guard, fetchImpl: ok });
    expect(r.url).toBe("https://a.example/3");
    expect(r.redirects).toHaveLength(3);
    expect(r.body).toContain("끝");

    const tooMany = fakeFetch({
      "https://a.example/": redirect("https://a.example/1"),
      "https://a.example/1": redirect("https://a.example/2"),
      "https://a.example/2": redirect("https://a.example/3"),
      "https://a.example/3": redirect("https://a.example/4"),
    });
    await expect(safeFetch("https://a.example/", { guard, fetchImpl: tooMany })).rejects.toThrow(/리다이렉트/);
  });

  it("크기 제한을 넘으면 잘라 읽는다", async () => {
    const fetchImpl = fakeFetch({ "https://big.example/": () => new Response("x".repeat(5000)) });
    const r = await safeFetch("https://big.example/", { guard, fetchImpl, maxBytes: 1000 });
    expect(r.body.length).toBe(1000);
    expect(r.truncated).toBe(true);
  });

  it("시간 제한", async () => {
    const slow = (async (_u: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))))) as typeof fetch;
    await expect(safeFetch("https://slow.example/", { guard, fetchImpl: slow, timeoutMs: 50 })).rejects.toThrow(/abort/);
  });

  it("EUC-KR 페이지를 읽는다", async () => {
    // "가" = EUC-KR B0 A1
    const bytes = new Uint8Array([0x3c, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x3e, 0xb0, 0xa1, 0x3c, 0x2f, 0x74, 0x69, 0x74, 0x6c, 0x65, 0x3e]);
    const fetchImpl = fakeFetch({ "https://old.example/": () => new Response(bytes, { headers: { "content-type": "text/html; charset=euc-kr" } }) });
    const r = await safeFetch("https://old.example/", { guard, fetchImpl });
    expect(r.body).toBe("<title>가</title>");
  });
});
