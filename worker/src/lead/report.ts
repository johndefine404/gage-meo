// 상세 개선 리포트 (메일 본문, 순수 텍스트)
import { BOOKING_MEO_URL, type Brand } from "../brand";
import type { CheckResult } from "../core/check";
import { GROUP_TITLE, type Group, type Status } from "../core/score";

const MARK: Record<Status, string> = { pass: "[좋음]", warn: "[보완]", fail: "[고칠 것]", unknown: "[확인 못 함]" };
const ORDER: Record<Status, number> = { fail: 0, warn: 1, unknown: 2, pass: 3 };

export function reportSubject(r: CheckResult, b: Brand): string {
  return `[${b.name}] 가게냥 점검 리포트: ${r.input.name} (${r.score}점)`;
}

export function reportText(r: CheckResult, b: Brand): string {
  const lines: string[] = [];
  lines.push(`${r.input.name} (${r.input.region}) 온라인 점검 리포트`);
  lines.push(`점수: ${r.score}점 / 100점 (${r.grade})`);
  lines.push(`점검 시각: ${new Date(r.createdAt + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ")} (한국 시간)`);
  if (r.mock.naver || r.mock.kakao) lines.push("참고: 이 리포트의 지도 검색 결과는 예시 데이터입니다.");
  lines.push("");
  for (const g of r.groups) lines.push(`${g.title}: ${g.points} / ${g.max}`);

  for (const g of Object.keys(GROUP_TITLE) as Group[]) {
    lines.push("", `■ ${GROUP_TITLE[g]}`, "");
    const items = r.items.filter((i) => i.group === g).sort((a, c) => ORDER[a.status] - ORDER[c.status]);
    for (const i of items) {
      lines.push(`${MARK[i.status]} ${i.title} (${i.points}/${i.max})`);
      lines.push(`  확인한 것: ${i.detail}`);
      lines.push(`  왜 중요한가: ${i.why}`);
      lines.push(`  고치는 방법: ${i.fix}`);
      lines.push("");
    }
  }

  if (r.suggestBookingMeo) {
    lines.push("■ 상담 창구가 없다면", "");
    lines.push("부킹냥(booking-meo)은 카카오톡 채널, 네이버 톡톡, 홈페이지에서 가게 정보대로 손님 문의에 답하는 무료 오픈소스 AI 상담 챗봇입니다.");
    lines.push(BOOKING_MEO_URL, "");
  }

  lines.push(`■ ${b.ctaLabel}`, "");
  lines.push(`직접 고치기 어려우면 ${b.name}에 맡겨 주세요. 지도 정보 정리, 홈페이지 수정, 상담 창구 연결을 대신 해 드립니다.`);
  lines.push(b.ctaUrl, "");
  lines.push("---");
  lines.push(`이 메일은 가게냥(우리 가게 온라인 점검) 화면에서 리포트를 신청하셔서 보내 드렸습니다. 보낸 곳: ${b.name} (${b.url})`);
  lines.push("개인정보 삭제를 원하시면 이 메일에 회신해 주세요.");
  return lines.join("\n");
}

export function ownerNoticeText(r: CheckResult, email: string, marketing: boolean): string {
  const worst = r.items.filter((i) => i.status === "fail").map((i) => i.title);
  return [
    "새 리포트 신청이 들어왔습니다.",
    `가게: ${r.input.name} (${r.input.region})`,
    `홈페이지: ${r.homepageUrl ?? "없음"}`,
    `점수: ${r.score}점 (${r.grade})`,
    `고칠 것: ${worst.join(", ") || "없음"}`,
    `메일: ${email}`,
    `광고성 정보 수신 동의: ${marketing ? "예" : "아니오"}`,
  ].join("\n");
}
