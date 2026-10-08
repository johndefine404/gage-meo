// 광고 수신 동의 규칙 (정보통신망법 제50조)
// - 광고는 동의한 사람에게만 보낸다 (①)
// - 밤 9시부터 아침 8시(한국 시간)에는 따로 동의를 받지 않았으므로 광고를 보내지 않는다 (③)
// - 동의는 2년마다 다시 확인해야 한다 (⑧, 시행령). 이 도구는 신청 기록을 1년 뒤 지우므로
//   동의가 2년을 넘길 일이 없지만, 보관 기간을 늘려도 안전하도록 2년 지난 동의는 무효로 본다

export const MARKETING_VALID_MS = 2 * 365 * 86400_000;

// 한국 시간 기준 21:00 ~ 08:00 이면 true
export function isNightKst(now = Date.now()): boolean {
  const h = new Date(now + 9 * 3600_000).getUTCHours();
  return h >= 21 || h < 8;
}

// 광고 수신 동의가 지금 유효한가 (동의 시각부터 2년)
export function marketingActive(consentAt: number | null | undefined, now = Date.now()): boolean {
  return typeof consentAt === "number" && now - consentAt < MARKETING_VALID_MS;
}

// 이번 메일에 광고(문의 안내)를 실어도 되는가
export function adAllowed(consentAt: number | null | undefined, now = Date.now()): boolean {
  return marketingActive(consentAt, now) && !isNightKst(now);
}

// 한국 시간 표기 (메일 본문용)
export function kstStamp(now = Date.now()): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
}
