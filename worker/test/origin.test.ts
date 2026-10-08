// [Define404] 가게냥 (gage-meo): 다른 사이트에서 보낸 쓰기 요청 막기
import { describe, expect, it } from "vitest";
import worker from "../src/index";
import { allowedOrigins, checkOrigin, isJson } from "../src/core/origin";
import type { Env } from "../src/env";

const SITE = "https://gage.define404.com";

// DB 를 부르면 기록만 남기는 가짜. 막힌 요청은 DB 를 한 번도 부르지 않아야 한다
function makeEnv(extra: Partial<Env> = {}) {
  const calls: string[] = [];
  const stmt = (sql: string) => ({
    bind: () => stmt(sql),
    first: async () => (calls.push(sql), null),
    run: async () => (calls.push(sql), { meta: { changes: 0 } }),
    all: async () => (calls.push(sql), { results: [] }),
  });
  const env = {
    DB: { prepare: (sql: string) => stmt(sql), batch: async () => (calls.push("batch"), []) },
    MOCK: "0",
    DAILY_CHECK_LIMIT: "500",
    DAILY_LEAD_LIMIT: "100",
    MAIL_FROM: "가게냥 <john@define404.com>",
    ...extra,
  } as unknown as Env;
  return { env, calls };
}
const ctx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;

async function post(path: string, headers: Record<string, string>, body: string, extra?: Partial<Env>) {
  const { env, calls } = makeEnv(extra);
  const res = await worker.fetch(new Request(SITE + path, { method: "POST", headers, body }), env, ctx);
  return { res, calls };
}
const realCheck = JSON.stringify({ name: "모락 베이커리", region: "서울 마포구" });
const emptyCheck = JSON.stringify({}); // 안내 문구(400)로 끝나 DB 를 부르지 않는다
const json = { "Content-Type": "application/json" };

describe("쓰기 요청 출처 검사 (통합)", () => {
  it("같은 사이트 JSON 요청은 통과한다", async () => {
    const { res, calls } = await post("/api/check", { ...json, Origin: SITE, "Sec-Fetch-Site": "same-origin" }, emptyCheck);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toContain("가게 이름");
    expect(calls).toEqual([]);
  });

  it("다른 사이트 Origin 은 403 이고 DB 를 건드리지 않는다", async () => {
    for (const path of ["/api/check", "/api/lead"]) {
      const { res, calls } = await post(path, { ...json, Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" }, realCheck);
      expect(res.status).toBe(403);
      expect(calls).toEqual([]);
    }
  });

  it("다른 사이트의 text/plain 단순 POST 도 403", async () => {
    const { res, calls } = await post("/api/check", { "Content-Type": "text/plain", Origin: "https://evil.example" }, realCheck);
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("Origin null 은 Sec-Fetch-Site same-origin 일 때만 통과", async () => {
    const ok = await post("/api/check", { ...json, Origin: "null", "Sec-Fetch-Site": "same-origin" }, emptyCheck);
    expect(ok.res.status).toBe(400);
    const bad = await post("/api/check", { ...json, Origin: "null", "Sec-Fetch-Site": "cross-site" }, realCheck);
    expect(bad.res.status).toBe(403);
    expect(bad.calls).toEqual([]);
    const none = await post("/api/check", { ...json, Origin: "null" }, realCheck);
    expect(none.res.status).toBe(403);
  });

  it("Origin 없이 Sec-Fetch-Site cross-site 면 403", async () => {
    const { res, calls } = await post("/api/check", { ...json, "Sec-Fetch-Site": "cross-site" }, realCheck);
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("Origin 도 Sec-Fetch-Site 도 없는 서버 요청은 통과한다", async () => {
    const { res } = await post("/api/check", json, emptyCheck);
    expect(res.status).toBe(400);
  });

  it("같은 사이트라도 JSON API 에 JSON 이 아니면 415", async () => {
    const { res, calls } = await post("/api/check", { "Content-Type": "text/plain", Origin: SITE }, realCheck);
    expect(res.status).toBe(415);
    expect(calls).toEqual([]);
    const form = await post("/api/lead", { "Content-Type": "application/x-www-form-urlencoded" }, "email=a@b.com");
    expect(form.res.status).toBe(415);
  });

  it("메일 프로그램의 원클릭 수신 거부(폼, Origin 없음)는 계속 된다", async () => {
    const t = "a".repeat(32);
    const { res, calls } = await post(`/api/unsubscribe?t=${t}`, { "Content-Type": "application/x-www-form-urlencoded" }, "List-Unsubscribe=One-Click");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("수신을 거부했습니다");
    expect(calls.length).toBeGreaterThan(0);
  });

  it("다른 사이트에서 보낸 수신 거부 POST 는 막는다", async () => {
    const { res, calls } = await post(`/api/unsubscribe?t=${"a".repeat(32)}`, { "Content-Type": "application/x-www-form-urlencoded", Origin: "https://evil.example" }, "List-Unsubscribe=One-Click");
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("시험 모드(MOCK=1)에서는 localhost 출처를 받는다", async () => {
    const dev = await post("/api/check", { ...json, Origin: "http://localhost:8787" }, emptyCheck, { MOCK: "1" });
    expect(dev.res.status).toBe(400);
    const prod = await post("/api/check", { ...json, Origin: "http://localhost:8787" }, emptyCheck);
    expect(prod.res.status).toBe(403);
  });

  it("GET 은 검사하지 않는다", async () => {
    const { env } = makeEnv();
    const res = await worker.fetch(new Request(SITE + "/health", { headers: { Origin: "https://evil.example" } }), env, ctx);
    expect(res.status).toBe(200);
  });
});

describe("출처 판정 함수", () => {
  const allowed = allowedOrigins(SITE + "/api/check", "https://partner.example/, ");
  it("자기 주소와 ALLOWED_ORIGINS 를 받는다", () => {
    expect(checkOrigin({ origin: SITE }, allowed).ok).toBe(true);
    expect(checkOrigin({ origin: "https://partner.example" }, allowed).ok).toBe(true);
    expect(checkOrigin({ origin: "https://gage.define404.com.evil.example" }, allowed).ok).toBe(false);
    expect(checkOrigin({ origin: "http://localhost:8787" }, allowed).ok).toBe(false);
  });
  it("Content-Type 판정은 charset 을 무시한다", () => {
    expect(isJson("application/json; charset=utf-8")).toBe(true);
    expect(isJson("text/plain")).toBe(false);
    expect(isJson(undefined)).toBe(false);
  });
});
