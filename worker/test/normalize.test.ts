import { fromKakao } from "../src/places/kakao";
import { describe, expect, it } from "vitest";
import {
  addressCore,
  compareAddress,
  compareName,
  comparePhone,
  normalizeAddress,
  normalizeName,
  normalizePhone,
  pickPlace,
  nameMatch,
  rankCandidates,
} from "../src/core/normalize";
import { fromNaver, stripTags } from "../src/places/naver";
import { mockPlaces } from "../src/places/mock";

describe("전화번호", () => {
  it("숫자만 남기고 국가번호를 0으로", () => {
    expect(normalizePhone("02-555-0142")).toBe("025550142");
    expect(normalizePhone("+82 2-555-0142")).toBe("025550142");
    expect(normalizePhone("+82-10-1234-5678")).toBe("01012345678");
    expect(normalizePhone("0082 10 1234 5678")).toBe("01012345678");
    expect(normalizePhone("(02) 555 0142")).toBe("025550142");
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone(undefined)).toBe("");
  });
  it("비교", () => {
    expect(comparePhone("02-555-0142", "025550142")).toBe("same");
    expect(comparePhone("0507-1400-0000", "02-555-0142")).toBe("near");
    expect(comparePhone("02-555-0142", "02-555-0143")).toBe("different");
    expect(comparePhone("", "02-555-0142")).toBe("missing");
  });
});

describe("주소", () => {
  it("시도 이름과 괄호, 층수를 정리", () => {
    expect(normalizeAddress("서울특별시 강남구 역삼로 12 (역삼동)")).toBe("서울 강남구 역삼로 12");
    expect(addressCore("서울특별시 강남구 역삼로 12 2층 201호")).toBe("서울 강남구 역삼로 12");
    expect(addressCore("서울 강남구 역삼로 12")).toBe("서울 강남구 역삼로 12");
    expect(addressCore("경기도 성남시 분당구 판교역로 235, 에이치스퀘어")).toBe("경기 성남시 분당구 판교역로 235");
    expect(addressCore("서울 강남구 테헤란로12길 34")).toBe("서울 강남구 테헤란로12길 34");
    expect(addressCore("서울 종로구 종로 1-1")).toBe("서울 종로구 종로 1-1");
    expect(addressCore("서울특별시 강남구 역삼동 123-4")).toBe("서울 강남구 역삼동 123-4");
    expect(addressCore("강원특별자치도 춘천시 중앙로 1")).toBe("강원 춘천시 중앙로 1");
    expect(addressCore("강원도 춘천시 중앙로 1")).toBe("강원 춘천시 중앙로 1");
  });
  it("네이버(긴 시도명 + 층) vs 카카오(짧은 시도명)는 같은 주소", () => {
    expect(
      compareAddress(
        { roadAddress: "서울특별시 강남구 역삼로 12 1층", address: "서울특별시 강남구 역삼동 123-4" },
        { roadAddress: "서울 강남구 역삼로 12", address: "서울 강남구 역삼동 123-4" },
      ),
    ).toBe("same");
  });
  it("같은 도로 다른 번호는 near, 다른 구는 different", () => {
    expect(compareAddress({ roadAddress: "서울 강남구 역삼로 12", address: "" }, { roadAddress: "서울 강남구 역삼로 14", address: "" })).toBe("near");
    expect(
      compareAddress({ roadAddress: "서울 강남구 테헤란로12길 34", address: "" }, { roadAddress: "서울 강남구 테헤란로12길 50", address: "" }),
    ).toBe("near");
    expect(compareAddress({ roadAddress: "서울 강남구 역삼로 12", address: "" }, { roadAddress: "부산 해운대구 해운대로 1", address: "" })).toBe(
      "different",
    );
    expect(compareAddress({ roadAddress: "", address: "" }, { roadAddress: "서울 강남구 역삼로 12", address: "" })).toBe("missing");
  });
  it("도로명이 달라도 지번이 같으면 same", () => {
    expect(
      compareAddress(
        { roadAddress: "서울 강남구 역삼로 12", address: "서울 강남구 역삼동 123-4" },
        { roadAddress: "", address: "서울특별시 강남구 역삼동 123-4" },
      ),
    ).toBe("same");
  });
});

describe("가게 이름", () => {
  it("태그·공백·기호를 지우고 비교", () => {
    expect(stripTags("<b>모락</b> 베이커리 &amp; 카페")).toBe("모락 베이커리 & 카페");
    expect(normalizeName("<b>모락</b> 베이커리")).toBe("모락베이커리");
    expect(compareName("모락 베이커리", "모락베이커리")).toBe("same");
    expect(compareName("모락베이커리 역삼점", "모락 베이커리")).toBe("near");
    expect(compareName("모락베이커리", "다른빵집")).toBe("different");
    expect(compareName("Cafe ONE", "cafe one")).toBe("same");
  });
  it("검색 결과 중 입력한 가게 고르기", () => {
    const list = [
      fromNaver({ title: "모락 베이커리 2호점", link: "", category: "", description: "", telephone: "", address: "", roadAddress: "부산광역시 해운대구 해운대로 1" }),
      fromNaver({ title: "<b>모락 베이커리</b>", link: "", category: "", description: "", telephone: "", address: "", roadAddress: "서울특별시 강남구 역삼로 12" }),
      fromNaver({ title: "다른 빵집", link: "", category: "", description: "", telephone: "", address: "", roadAddress: "서울특별시 강남구 역삼로 10" }),
    ];
    expect(pickPlace(list, "모락베이커리", "서울 강남구")?.roadAddress).toBe("서울특별시 강남구 역삼로 12");
    expect(pickPlace(list, "없는가게", "서울")).toBeNull();
    expect(pickPlace([], "모락", "서울")).toBeNull();
  });
});

describe("체인 지점과 후보", () => {
  const np = (title: string, roadAddress: string) =>
    fromNaver({ title, link: "", category: "", description: "", telephone: "", address: "", roadAddress });
  it("브랜드를 줄여 쓴 체인 지점도 같은 가게로 본다", () => {
    expect(nameMatch("이디야커피 역삼중앙점", "이디야 역삼중앙점")).toBe("near");
    expect(nameMatch("메가MGC커피 강남역점", "메가커피 강남역점")).toBe("near");
    expect(nameMatch("스타벅스 강남R점", "스타벅스 강남역점")).toBe("different");
    expect(nameMatch("이디야커피 역삼중앙점", "이디야커피 역삼역점")).toBe("different");
    expect(nameMatch("모락베이커리", "모락 빵집")).toBe("different");
  });
  it("지역을 빼고 다시 찾은 결과에서는 지역이 맞는 곳만 고른다", () => {
    const list = [np("우래옥", "강원특별자치도 강릉시 하평1길 8"), np("우래옥", "서울특별시 중구 창경궁로 62-29")];
    expect(pickPlace(list, "우래옥", "서울 중구", { requireRegion: true })?.roadAddress).toBe("서울특별시 중구 창경궁로 62-29");
    expect(pickPlace([list[0]], "우래옥", "서울 중구", { requireRegion: true })).toBeNull();
  });
  it("후보는 이름이 닮고 지역이 맞는 순, 같은 가게는 한 번만", () => {
    const list = [
      np("다른 빵집", "서울특별시 강남구 역삼로 10"),
      np("스타벅스 강남R점", "서울특별시 강남구 강남대로 390 (역삼동)"),
      fromKakao({ place_name: "스타벅스 강남R점", category_name: "", phone: "", address_name: "", road_address_name: "서울 강남구 강남대로 390", place_url: "" }),
      np("스타벅스 강남역우송빌딩점", "서울특별시 서초구 서초대로73길 7 (서초동)"),
    ];
    const c = rankCandidates(list, "스타벅스 강남역점", "서울 강남구");
    expect(c.map((x) => x.name)).toEqual(["스타벅스 강남R점", "스타벅스 강남역우송빌딩점"]);
  });
});

describe("예시 데이터", () => {
  it("입력한 이름과 지역으로 가상의 가게를 만든다", () => {
    const n = mockPlaces("naver", { name: "모락 베이커리", region: "서울 강남구" });
    const k = mockPlaces("kakao", { name: "모락 베이커리", region: "서울 강남구" });
    expect(n[0].name).toBe("모락 베이커리");
    expect(n[0].roadAddress.startsWith("서울특별시 강남구")).toBe(true);
    expect(compareAddress(n[0], k[0])).toBe("same");
    expect(comparePhone(n[0].phone, k[0].phone)).toBe("near");
    expect(mockPlaces("naver", { name: "없는 가게", region: "서울" })).toEqual([]);
    expect(mockPlaces("naver", { name: "카카오만 카페", region: "서울" })).toEqual([]);
    expect(mockPlaces("kakao", { name: "카카오만 카페", region: "서울" })).toHaveLength(1);
  });
});

import { naverRequest } from "../src/places/naver";

describe("naverRequest", () => {
  it("기본은 API HUB 주소와 머리말", () => {
    const r = naverRequest("hub", "id", "sec", "강남 국밥");
    expect(r.url.startsWith("https://naverapihub.apigw.ntruss.com/search/v1/local?")).toBe(true);
    expect(r.headers["X-NCP-APIGW-API-KEY-ID"]).toBe("id");
    expect(r.headers["X-NCP-APIGW-API-KEY"]).toBe("sec");
  });
  it("openapi 는 예전 주소", () => {
    const r = naverRequest("openapi", "id", "sec", "x");
    expect(r.url.startsWith("https://openapi.naver.com/v1/search/local.json?")).toBe(true);
    expect(r.headers["X-Naver-Client-Id"]).toBe("id");
  });
});
