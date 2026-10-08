// Resend 로 메일을 보낸다. 키가 없으면 보내지 않고 로그만 남긴다 (로컬 시험용)
import type { Env } from "../env";

export async function sendMail(env: Env, to: string, subject: string, text: string, replyTo?: string): Promise<"sent" | "logged"> {
  if (!env.RESEND_API_KEY) {
    console.log(`[mail skipped: RESEND_API_KEY 없음] to=${to} subject=${subject}\n${text}`);
    return "logged";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to, subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!res.ok) throw new Error(`resend ${res.status} ${(await res.text()).slice(0, 200)}`);
  return "sent";
}
