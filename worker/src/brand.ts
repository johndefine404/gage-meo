// 대행사가 자기 이름으로 배포할 수 있게 브랜드를 설정 파일(brand.json)과 환경 변수로 바꾼다
import defaults from "../brand.json";
import type { Env } from "./env";

export type Brand = {
  name: string;
  url: string;
  color: string;
  ctaUrl: string;
  ctaLabel: string;
  privacyOwner: string; // 개인정보를 받는 쪽 (동의 문구에 들어간다)
  suggestBookingMeo: boolean;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const safeUrl = (u: string | undefined) => (u && /^https?:\/\//.test(u) ? u : undefined);

export function brand(env: Env): Brand {
  const d = defaults as Brand;
  const color = env.BRAND_COLOR && HEX.test(env.BRAND_COLOR) ? env.BRAND_COLOR : d.color;
  return {
    name: env.BRAND_NAME || d.name,
    url: safeUrl(env.BRAND_URL) ?? d.url,
    color,
    ctaUrl: safeUrl(env.CTA_URL) ?? d.ctaUrl,
    ctaLabel: env.CTA_LABEL || d.ctaLabel,
    privacyOwner: env.PRIVACY_OWNER || env.BRAND_NAME || d.privacyOwner,
    suggestBookingMeo: env.SUGGEST_BOOKING_MEO ? env.SUGGEST_BOOKING_MEO === "1" || env.SUGGEST_BOOKING_MEO === "true" : d.suggestBookingMeo,
  };
}

export const BOOKING_MEO_URL = "https://github.com/johndefine404/booking-meo";

// 동의 문구. 화면과 서버가 같은 문구를 쓰고, 문구를 바꾸면 버전을 올린다
export const CONSENT_VERSION = "2026-10-v1";

export function consentText(b: Brand) {
  return {
    version: CONSENT_VERSION,
    privacy: [
      `수집하는 곳: ${b.privacyOwner}`,
      "수집 항목: 이메일 주소, 점검한 가게 이름·지역·홈페이지 주소",
      "이용 목적: 상세 개선 리포트 발송, 리포트 관련 문의 응대",
      "보유 기간: 수집일부터 1년. 그 전에 삭제를 요청하면 바로 지웁니다",
      "동의하지 않을 수 있으며, 동의하지 않으면 상세 리포트를 메일로 받을 수 없습니다 (화면의 요약 점수는 그대로 볼 수 있습니다)",
    ],
    marketing: [
      `보내는 곳: ${b.privacyOwner}`,
      "내용: 홈페이지·지도 관리 개선 안내, 서비스 소식 (메일)",
      "선택 항목이며 동의하지 않아도 리포트는 받을 수 있습니다. 언제든 메일 회신으로 수신을 거부할 수 있습니다",
    ],
  };
}
