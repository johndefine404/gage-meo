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
  privacyUrl: string; // 개인정보 처리방침 주소
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
    privacyUrl: safeUrl(env.PRIVACY_URL) ?? d.privacyUrl,
    suggestBookingMeo: env.SUGGEST_BOOKING_MEO ? env.SUGGEST_BOOKING_MEO === "1" || env.SUGGEST_BOOKING_MEO === "true" : d.suggestBookingMeo,
  };
}

export const BOOKING_MEO_URL = "https://github.com/johndefine404/booking-meo";

// 동의 문구. 화면과 서버가 같은 문구를 쓰고, 문구를 바꾸면 버전을 올린다
// 개인정보 보호법 제15조 제2항: 목적, 항목, 보유·이용 기간, 동의 거부권과 거부 시 불이익을 알린다
// 개인정보 보호법 제22조: 필수 동의와 광고 수신 동의를 따로 받고, 광고 동의를 안 해도 리포트는 보낸다
export const CONSENT_VERSION = "2026-10-v3";

export function consentText(b: Brand) {
  return {
    version: CONSENT_VERSION,
    privacyUrl: b.privacyUrl,
    privacy: [
      `수집하는 곳: ${b.privacyOwner}`,
      "수집 목적: 상세 개선 리포트 발송, 리포트 관련 문의 응대",
      "수집 항목: 이메일 주소, 점검한 가게 이름·지역·점수 (홈페이지 주소를 포함한 점검 결과는 7일 동안만 보관)",
      "보유·이용 기간: 신청일부터 1년이 지나면 자동으로 지웁니다. 그 전이라도 메일 회신으로 삭제를 요청하면 지웁니다",
      "처리 위탁과 국외 이전: 개인정보 처리방침에 따라 서버 운영·저장은 Cloudflare, Inc.(미국), 메일 발송은 Google LLC(미국)에 맡깁니다",
      "동의하지 않으셔도 됩니다. 다만 동의하지 않으면 상세 리포트를 메일로 받을 수 없습니다 (화면의 요약 점수는 그대로 볼 수 있습니다)",
    ],
    marketing: [
      `보내는 곳: ${b.privacyOwner}`,
      "이용 목적: 홈페이지·지도 관리 대행 등 유료 서비스 안내 (메일)",
      "이용 항목: 이메일 주소, 점검한 가게 이름·지역·점수",
      "보유·이용 기간: 동의일부터 신청 기록을 지우는 1년까지. 그 전에 수신을 거부하면 바로 멈춥니다",
      "처리 위탁과 국외 이전: 개인정보 처리방침에 따라 Cloudflare, Inc.(미국)와 Google LLC(미국)에 맡깁니다",
      "동의하지 않으셔도 됩니다. 동의하지 않아도 리포트는 그대로 받을 수 있고, 다른 불이익은 없습니다",
      "광고 메일에는 제목 앞에 (광고)를 붙이고, 밤 9시부터 아침 8시 사이에는 보내지 않습니다. 메일 아래 수신 거부 링크를 누르면 무료로 바로 거부됩니다",
    ],
  };
}
