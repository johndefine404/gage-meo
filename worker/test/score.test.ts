import { describe, expect, it } from "vitest";
import { publicView, runCheck } from "../src/core/check";
import type { HomepageResult } from "../src/core/homepage";
import { buildItems, CATALOG, MAX_SCORE, summarize } from "../src/core/score";
import { reportSubject, reportText, ownerNoticeText } from "../src/lead/report";
import { mockProvider } from "../src/places/mock";
import type { Place } from "../src/places/types";

const place = (p: Partial<Place>): Place => ({
  source: "naver",
  name: "모락 베이커리",
  address: "서울특별시 강남구 역삼동 123-4",
  roadAddress: "서울특별시 강남구 역삼로 12",
  phone: "02-555-0142",
  category: "",
  ...p,
});

const goodHome: HomepageResult = {
  inputUrl: "https://shop.example",
  ok: true,
  finalUrl: "https://shop.example/",
  status: 200,
  https: true,
  elapsedMs: 300,
  redirects: [],
  robots: true,
  sitemap: true,
  facts: {
    title: "모락 베이커리",
    description: "케이크",
    viewport: true,
    naverVerification: true,
    og: { title: true, description: true, image: true },
    kakaoChannel: true,
    naverBooking: true,
    naverTalk: false,
  },
};

describe("점수", () => {
  it("배점 합계는 100", () => expect(MAX_SCORE).toBe(100));

  it("모두 갖추면 100점", () => {
    const items = buildItems({
      naver: { place: place({}), candidates: 1 },
      kakao: { place: place({ source: "kakao", roadAddress: "서울 강남구 역삼로 12", phone: "025550142" }), candidates: 1 },
      homepage: goodHome,
      homepageFrom: "input",
    });
    expect(items).toHaveLength(Object.keys(CATALOG).length);
    const s = summarize(items);
    expect(s.score).toBe(100);
    expect(s.grade).toBe("좋음");
    expect(items.every((i) => i.status === "pass")).toBe(true);
  });

  it("홈페이지 없음: 지도 항목만 점수, 나머지는 확인 못 함", () => {
    const items = buildItems({
      naver: { place: place({}), candidates: 1 },
      kakao: { place: place({ source: "kakao" }), candidates: 1 },
      homepage: null,
      homepageFrom: null,
    });
    const s = summarize(items);
    expect(s.score).toBe(55);
    expect(items.find((i) => i.id === "homepage_exists")?.status).toBe("fail");
    expect(items.find((i) => i.id === "chat_channel")?.status).toBe("unknown");
    expect(s.groups.find((g) => g.id === "listing")).toMatchObject({ points: 55, max: 55 });
  });

  it("어긋남과 반쪽 점수", () => {
    const slow = { ...goodHome, elapsedMs: 2000, sitemap: false, facts: { ...goodHome.facts!, description: "", kakaoChannel: false, naverBooking: false } };
    const items = buildItems({
      naver: { place: place({ phone: "0507-1400-0000" }), candidates: 2 },
      kakao: { place: place({ source: "kakao", roadAddress: "서울 강남구 역삼로 20" }), candidates: 1 },
      homepage: slow,
      homepageFrom: "naver",
    });
    const by = (id: string) => items.find((i) => i.id === id)!;
    expect(by("phone_match").status).toBe("warn");
    expect(by("address_match").status).toBe("warn");
    expect(by("speed")).toMatchObject({ status: "warn", points: 2.5 });
    expect(by("title_desc").status).toBe("warn");
    expect(by("sitemap_robots").status).toBe("warn");
    expect(by("chat_channel").status).toBe("fail");
    expect(by("homepage_exists").detail).toContain("네이버에 등록된 주소");
    // 실패 항목은 고치는 방법이 붙는다
    expect(by("chat_channel").fix).toContain("카카오톡 채널");
  });

  it("검색 실패는 '확인 못 함'", () => {
    const items = buildItems({ naver: { place: null, candidates: 0, error: "검색 API 오류" }, kakao: { place: null, candidates: 3 }, homepage: null, homepageFrom: null });
    expect(items.find((i) => i.id === "naver_found")?.status).toBe("unknown");
    expect(items.find((i) => i.id === "kakao_found")).toMatchObject({ status: "fail" });
    expect(items.find((i) => i.id === "kakao_found")?.detail).toContain("3곳");
    expect(summarize(items).score).toBe(0);
  });
});

describe("점검 한 번 (예시 데이터)", () => {
  const deps = { naver: mockProvider("naver"), kakao: mockProvider("kakao"), now: () => 0, id: () => "00000000-0000-0000-0000-000000000000" };

  it("홈페이지 없이", async () => {
    const r = await runCheck({ name: "모락 베이커리", region: "서울 강남구" }, { ...deps, homepage: async () => goodHome });
    expect(r.mock).toEqual({ naver: true, kakao: true });
    expect(r.items.find((i) => i.id === "phone_match")?.status).toBe("warn");
    expect(r.homepageUrl).toBeNull();
    expect(r.suggestBookingMeo).toBe(true);
    const pub = publicView(r);
    expect(pub.items.every((i) => !("fix" in i))).toBe(true);
  });

  it("입력한 홈페이지를 쓰고 상담 창구가 있으면 부킹냥 안내를 하지 않는다", async () => {
    let asked = "";
    const r = await runCheck(
      { name: "모락 베이커리", region: "서울 강남구", url: "shop.example" },
      { ...deps, homepage: async (u) => ((asked = u), goodHome) },
    );
    expect(asked).toBe("shop.example");
    expect(r.suggestBookingMeo).toBe(false);
    expect(r.score).toBe(95); // 전화번호만 반쪽
  });

  it("검색되지 않는 가게", async () => {
    const r = await runCheck({ name: "없는 가게", region: "서울" }, { ...deps, homepage: async () => goodHome });
    expect(r.items.find((i) => i.id === "naver_found")?.status).toBe("fail");
    expect(r.items.find((i) => i.id === "kakao_found")?.status).toBe("fail");
  });

  it("리포트 본문", async () => {
    const r = await runCheck({ name: "모락 베이커리", region: "서울 강남구" }, { ...deps, homepage: async () => goodHome });
    const brand = { name: "Define404", url: "https://define404.com", color: "#1E6B52", ctaUrl: "https://contact.define404.com", ctaLabel: "고쳐 드립니다", privacyOwner: "Define404", suggestBookingMeo: true };
    const t = reportText(r, brand);
    expect(t).toContain("고치는 방법:");
    expect(t).toContain("github.com/johndefine404/booking-meo");
    expect(t).toContain("고쳐 드립니다");
    expect(t).toContain("예시 데이터");
    expect(t).toContain("가게냥");
    expect(t).toContain("https://contact.define404.com");
    expect(reportSubject(r, brand)).toContain("가게냥 점검 리포트: 모락 베이커리");
    expect(t).not.toMatch(/\u2014/);
    expect(t).not.toMatch(/\*\*|^#/m);
    expect(ownerNoticeText(r, "a@b.co", true)).toContain("광고성 정보 수신 동의: 예");
  });
});
