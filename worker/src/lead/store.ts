// D1: 점검 결과, 리포트 신청, 하루 사용량
import type { CheckResult } from "../core/check";

export const today = (now = Date.now()) => new Date(now + 9 * 3600_000).toISOString().slice(0, 10); // 한국 날짜

// 하루 사용량을 1 올리고, 상한을 넘으면 false
export async function takeDaily(db: D1Database, kind: "check" | "lead", limit: number): Promise<boolean> {
  const row = await db
    .prepare(
      "INSERT INTO usage (day, kind, count) VALUES (?1, ?2, 1) ON CONFLICT(day, kind) DO UPDATE SET count = count + 1 RETURNING count",
    )
    .bind(today(), kind)
    .first<{ count: number }>();
  return (row?.count ?? 0) <= limit;
}

export async function saveCheck(db: D1Database, r: CheckResult): Promise<void> {
  await db
    .prepare("INSERT INTO checks (id, created_at, store_name, region, url, score, result) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)")
    .bind(r.id, r.createdAt, r.input.name, r.input.region, r.homepageUrl, r.score, JSON.stringify(r))
    .run();
}

export async function loadCheck(db: D1Database, id: string): Promise<CheckResult | null> {
  const row = await db.prepare("SELECT result FROM checks WHERE id = ?1").bind(id).first<{ result: string }>();
  return row ? (JSON.parse(row.result) as CheckResult) : null;
}

export type LeadRow = {
  checkId: string;
  email: string;
  storeName: string;
  region: string;
  score: number;
  marketing: boolean;
  consentVersion: string;
  unsubToken: string | null; // 광고 수신 거부 링크용 (동의한 경우만)
};

export async function leadExists(db: D1Database, checkId: string, email: string): Promise<boolean> {
  return !!(await db.prepare("SELECT id FROM leads WHERE check_id = ?1 AND email = ?2").bind(checkId, email).first());
}

// 같은 점검에 같은 메일로 다시 신청하면 새로 넣지 않는다 (false)
export async function saveLead(db: D1Database, l: LeadRow, now = Date.now()): Promise<boolean> {
  if (await leadExists(db, l.checkId, l.email)) return false;
  await db
    .prepare(
      `INSERT INTO leads (created_at, check_id, email, store_name, region, score, consent_privacy_at, consent_marketing, consent_marketing_at, consent_version, unsub_token)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?1, ?7, ?8, ?9, ?10)`,
    )
    .bind(now, l.checkId, l.email, l.storeName, l.region, l.score, l.marketing ? 1 : 0, l.marketing ? now : null, l.consentVersion, l.unsubToken)
    .run();
  return true;
}

// 광고 수신 거부: 링크의 토큰으로 메일 주소를 찾아 그 주소의 모든 신청 기록에서 동의를 거둔다
// 처음 거부한 경우에만 메일 주소를 돌려준다 (처리 결과 알림용). 이미 거부했거나 없는 토큰이면 null
export async function withdrawMarketing(db: D1Database, token: string, now = Date.now()): Promise<string | null> {
  const row = await db
    .prepare("SELECT email FROM leads WHERE unsub_token = ?1")
    .bind(token)
    .first<{ email: string }>();
  if (!row) return null;
  const res = await db
    .prepare("UPDATE leads SET consent_marketing = 0, consent_marketing_at = NULL, marketing_withdrawn_at = ?2 WHERE email = ?1 AND consent_marketing = 1")
    .bind(row.email, now)
    .run();
  return (res.meta?.changes ?? 0) > 0 ? row.email : null;
}

// 매일 한 번: 7일 지난 점검 결과, 1년 지난 신청 기록을 지운다
export async function cleanup(db: D1Database, now = Date.now()): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM checks WHERE created_at < ?1").bind(now - 7 * 86400_000),
    db.prepare("DELETE FROM leads WHERE created_at < ?1").bind(now - 365 * 86400_000),
    db.prepare("DELETE FROM usage WHERE day < ?1").bind(today(now - 30 * 86400_000)),
  ]);
}
