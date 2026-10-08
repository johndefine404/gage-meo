// [Define404] 가게냥 (gage-meo): 동의 문구와 광고 수신 규칙
import { describe, expect, it } from "vitest";
import { consentText } from "../src/brand";
import { adAllowed, isNightKst, marketingActive, MARKETING_VALID_MS } from "../src/lead/consent";

const kst = (iso: string) => Date.parse(`${iso}+09:00`);
const b = { name: "Define404", url: "https://contact.define404.com", color: "#1E6B52", ctaUrl: "https://contact.define404.com", ctaLabel: "고쳐 드립니다", privacyOwner: "Define404", suggestBookingMeo: true, privacyUrl: "https://contact.define404.com/privacy.html" };

describe("동의 문구 (개인정보 보호법 제15조 제2항)", () => {
  const t = consentText(b);
  for (const [name, list] of [["필수", t.privacy], ["광고", t.marketing]] as const) {
    it(`${name}: 목적, 항목, 기간, 거부권과 불이익을 모두 적는다`, () => {
      const all = list.join("\n");
      expect(all).toMatch(/목적/);
      expect(all).toMatch(/항목/);
      expect(all).toMatch(/기간/);
      expect(all).toMatch(/동의하지 않으셔도 됩니다/);
      expect(all).not.toMatch(/\u2014/);
    });
  }
  it("필수 문구는 실제 삭제 주기(1년, 점검 결과 7일)와 맞다", () => {
    const all = t.privacy.join("\n");
    expect(all).toContain("1년");
    expect(all).toContain("7일");
  });
  it("광고 동의를 하지 않아도 리포트는 받는다고 적는다 (제22조 제5항)", () => {
    expect(t.marketing.join("\n")).toContain("리포트는 그대로 받을 수 있고");
  });
});

describe("광고 수신 규칙 (정보통신망법 제50조)", () => {
  it("밤 9시부터 아침 8시(한국 시간)는 밤이다", () => {
    expect(isNightKst(kst("2026-10-09T20:59:00"))).toBe(false);
    expect(isNightKst(kst("2026-10-09T21:00:00"))).toBe(true);
    expect(isNightKst(kst("2026-10-10T07:59:00"))).toBe(true);
    expect(isNightKst(kst("2026-10-10T08:00:00"))).toBe(false);
  });
  it("동의는 2년이 지나면 무효로 본다", () => {
    const at = kst("2026-10-09T10:00:00");
    expect(marketingActive(at, at + MARKETING_VALID_MS - 1)).toBe(true);
    expect(marketingActive(at, at + MARKETING_VALID_MS)).toBe(false);
    expect(marketingActive(null, at)).toBe(false);
  });
  it("동의했어도 밤에는 광고를 싣지 않는다", () => {
    const day = kst("2026-10-09T14:00:00");
    const night = kst("2026-10-09T23:00:00");
    expect(adAllowed(day, day)).toBe(true);
    expect(adAllowed(night, night)).toBe(false);
    expect(adAllowed(null, day)).toBe(false);
  });
});
