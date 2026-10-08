export interface Env {
  DB: D1Database;
  LIMITER?: RateLimit;

  MOCK?: string;
  // 쓰기 요청을 받아 줄 다른 출처 (쉼표 구분). 비우면 이 사이트 자신의 주소만 받는다
  ALLOWED_ORIGINS?: string;
  DAILY_CHECK_LIMIT: string;
  DAILY_LEAD_LIMIT: string;
  MAIL_FROM: string;

  // 네이버 검색 API (지역 검색)
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
  // 카카오 로컬 API (키워드 검색)
  KAKAO_REST_KEY?: string;

  // 리포트 메일과 새 신청 알림. Gmail API(셋 다 있을 때)가 먼저, 없으면 Resend
  GMAIL_CLIENT_ID?: string;
  GMAIL_CLIENT_SECRET?: string;
  GMAIL_REFRESH_TOKEN?: string;
  RESEND_API_KEY?: string;
  OWNER_EMAIL?: string;

  // 브랜드 덮어쓰기 (대행사용). 비우면 brand.json 값을 쓴다
  BRAND_NAME?: string;
  BRAND_COLOR?: string;
  BRAND_URL?: string;
  CTA_URL?: string;
  CTA_LABEL?: string;
  PRIVACY_OWNER?: string;
  SUGGEST_BOOKING_MEO?: string;
  // 개인정보 처리방침 주소 (동의 문구와 화면 아래에 링크로 건다)
  PRIVACY_URL?: string;
}
