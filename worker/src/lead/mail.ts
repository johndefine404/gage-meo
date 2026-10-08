// Resend 로 메일을 보낸다. 키가 없으면 보내지 않고 로그만 남긴다 (로컬 시험용)
import type { Env } from "../env";

// unsubscribeUrl 이 있으면 메일 프로그램의 수신 거부 버튼(List-Unsubscribe)도 같이 건다
export async function sendMail(env: Env, to: string, subject: string, text: string, replyTo?: string, unsubscribeUrl?: string): Promise<"sent" | "logged"> {
  if (!env.RESEND_API_KEY) {
    console.log(`[mail skipped: RESEND_API_KEY 없음] to=${to} subject=${subject}\n${text}`);
    return "logged";
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to, subject, text, ...(replyTo ? { reply_to: replyTo } : {}),
      ...(unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status} ${(await res.text()).slice(0, 200)}`);
  return "sent";
}
