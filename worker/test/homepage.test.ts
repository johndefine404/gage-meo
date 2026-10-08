import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyzeHtml, checkHomepage, normalizeInputUrl } from "../src/core/homepage";
import { strictGuard } from "../src/core/safefetch";

const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

describe("HTML 분석", () => {
  it("잘 갖춘 페이지", () => {
    const f = analyzeHtml(fx("good.html"));
    expect(f.title).toBe("모락 베이커리 | 강남 역삼동 케이크 전문점");
    expect(f.description).toContain("역삼역 3분");
    expect(f.viewport).toBe(true);
    expect(f.naverVerification).toBe(true);
    expect(f.og).toEqual({ title: true, description: true, image: true });
    expect(f.kakaoChannel).toBe(true);
    expect(f.naverBooking).toBe(true);
    expect(f.naverTalk).toBe(false);
  });
  it("빈약한 페이지", () => {
    const f = analyzeHtml(fx("bare.html"));
    expect(f.title).toBe("홈");
    expect(f.description).toBe("");
    expect(f.viewport).toBe(false);
    expect(f.naverVerification).toBe(false);
    expect(f.og).toEqual({ title: false, description: false, image: false });
    expect(f.kakaoChannel || f.naverBooking || f.naverTalk).toBe(false);
  });
  it("속성 순서·따옴표가 달라도 읽는다", () => {
    const f = analyzeHtml(`<meta content='width=device-width,initial-scale=1' name=viewport><meta content="x" property="og:title"><a href=https://talk.naver.com/ct/w00000>톡톡</a>`);
    expect(f.viewport).toBe(true);
    expect(f.og.title).toBe(true);
    expect(f.naverTalk).toBe(true);
  });
  it("주소 앞에 https 를 붙인다", () => {
    expect(normalizeInputUrl(" shop.example ")).toBe("https://shop.example");
    expect(normalizeInputUrl("http://shop.example")).toBe("http://shop.example");
  });
});

// 로컬 시험 서버: 홈페이지 두 개를 흉내 낸다
let server: Server;
let port = 0;
beforeAll(async () => {
  server = createServer((req, res) => {
    const host = req.headers["x-test-host"];
    const path = req.url ?? "/";
    const send = (status: number, type: string, body: string) => {
      res.writeHead(status, { "content-type": type });
      res.end(body);
    };
    if (host === "good.example") {
      if (path === "/") return send(200, "text/html; charset=utf-8", fx("good.html"));
      if (path === "/robots.txt") return send(200, "text/plain", fx("robots.txt").replace(/shop\.example/g, "good.example"));
      if (path === "/sitemap.xml") return send(200, "application/xml", fx("sitemap.xml"));
    }
    if (host === "spa.example") {
      // 모든 경로에 첫 화면 HTML 을 돌려주는 사이트
      return send(200, "text/html", fx("bare.html"));
    }
    if (host === "moved.example") {
      res.writeHead(301, { location: "https://good.example/" });
      return res.end();
    }
    send(404, "text/plain", "not found");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => server.close());

// https://<가짜 도메인>/... 요청을 로컬 서버로 돌린다. 주소 검사는 운영과 같은 엄격한 검사를 쓴다
const viaLocal = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const u = new URL(String(input));
  return fetch(`http://127.0.0.1:${port}${u.pathname}${u.search}`, { ...init, headers: { ...(init?.headers as object), "x-test-host": u.hostname } });
}) as typeof fetch;
const guard = strictGuard(async () => ["93.184.216.34"]);

describe("홈페이지 점검 (로컬 시험 서버)", () => {
  it("잘 갖춘 홈페이지", async () => {
    const r = await checkHomepage("good.example", { guard, fetchImpl: viaLocal });
    expect(r.ok).toBe(true);
    expect(r.https).toBe(true);
    expect(r.robots).toBe(true);
    expect(r.sitemap).toBe(true);
    expect(r.facts?.viewport).toBe(true);
    expect(typeof r.elapsedMs).toBe("number");
  });
  it("모든 경로에 HTML 을 주는 사이트는 robots·sitemap 없음으로 본다", async () => {
    const r = await checkHomepage("https://spa.example/", { guard, fetchImpl: viaLocal });
    expect(r.ok).toBe(true);
    expect(r.robots).toBe(false);
    expect(r.sitemap).toBe(false);
  });
  it("리다이렉트를 따라간다", async () => {
    const r = await checkHomepage("https://moved.example/", { guard, fetchImpl: viaLocal });
    expect(r.finalUrl).toBe("https://good.example/");
    expect(r.redirects).toEqual(["https://good.example/"]);
  });
  it("없는 페이지는 오류로 알린다", async () => {
    const r = await checkHomepage("https://nothing.example/", { guard, fetchImpl: viaLocal });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("404");
  });
  it("로컬 서버 주소를 직접 넣으면 운영 검사가 막는다", async () => {
    const r = await checkHomepage(`http://127.0.0.1:${port}/`, { guard: strictGuard() });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/포트|IP/);
    const r2 = await checkHomepage(`http://localhost/`, { guard: strictGuard() });
    expect(r2.error).toContain("내부 주소");
  });
});
