// 메일 보내기. 비밀값에 따라 보내는 길을 고른다
// 1) GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN 이 있으면 Gmail API (Google Workspace)
// 2) 아니면 RESEND_API_KEY 가 있으면 Resend
// 3) 둘 다 없으면 보내지 않고 로그만 남긴다 (로컬 시험용)
import type { Env } from "../env";

export type MailMessage = {
  from: string; // "이름 <주소>" 또는 주소만
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  unsubscribeUrl?: string; // 있으면 메일 프로그램의 수신 거부 버튼(List-Unsubscribe)도 건다
  date?: Date;
  messageId?: string;
};

// unsubscribeUrl 이 있으면 메일 프로그램의 수신 거부 버튼(List-Unsubscribe)도 같이 건다
export async function sendMail(env: Env, to: string, subject: string, text: string, replyTo?: string, unsubscribeUrl?: string): Promise<"sent" | "logged"> {
  const msg: MailMessage = { from: env.MAIL_FROM, to, subject, text, html: textToHtml(text), replyTo, unsubscribeUrl };
  if (env.GMAIL_CLIENT_ID && env.GMAIL_CLIENT_SECRET && env.GMAIL_REFRESH_TOKEN) {
    await sendGmail(env, msg);
    return "sent";
  }
  if (env.RESEND_API_KEY) {
    await sendResend(env.RESEND_API_KEY, msg);
    return "sent";
  }
  console.log(`[mail skipped: 메일 키 없음] to=${to} subject=${subject}\n${text}`);
  return "logged";
}

async function sendResend(key: string, m: MailMessage): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: m.from,
      to: m.to,
      subject: m.subject,
      text: m.text,
      ...(m.html ? { html: m.html } : {}),
      ...(m.replyTo ? { reply_to: m.replyTo } : {}),
      ...(m.unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${m.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`resend ${res.status} ${(await res.text()).slice(0, 200)}`);
}

// Gmail API: 갱신 토큰으로 접근 토큰을 받아(만료 전까지 메모리에 둔다) 완성된 메일을 raw 로 보낸다
let gmailToken: { value: string; exp: number } | null = null;

async function gmailAccessToken(env: Env): Promise<string> {
  if (gmailToken && gmailToken.exp > Date.now() + 60_000) return gmailToken.value;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.GMAIL_CLIENT_ID!,
      client_secret: env.GMAIL_CLIENT_SECRET!,
      refresh_token: env.GMAIL_REFRESH_TOKEN!,
    }),
  });
  if (!res.ok) throw new Error(`gmail token ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  gmailToken = { value: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return gmailToken.value;
}

async function sendGmail(env: Env, m: MailMessage): Promise<void> {
  const raw = base64Url(utf8(buildMime(m)));
  const send = async (token: string) =>
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
  let res = await send(await gmailAccessToken(env));
  if (res.status === 401) {
    gmailToken = null; // 토큰이 먼저 만료된 경우 한 번만 다시 받는다
    res = await send(await gmailAccessToken(env));
  }
  if (!res.ok) throw new Error(`gmail send ${res.status} ${(await res.text()).slice(0, 200)}`);
}

// ---- MIME (RFC 5322 / RFC 2045~2047) ----

const utf8 = (s: string) => new TextEncoder().encode(s);

function base64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export const base64Url = (bytes: Uint8Array) => base64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// 머리글의 비 ASCII 글자는 =?UTF-8?B?...?= 로 감싼다. 한 조각이 75자를 넘지 않게 글자 단위로 나눈다
export function encodeWord(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const words: string[] = [];
  let chunk = "";
  for (const ch of s) {
    if (utf8(chunk + ch).length > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${base64(utf8(w))}?=`).join("\r\n ");
}

// "이름 <주소>" 를 이름은 인코딩하고 주소는 그대로 둔다
export function encodeAddress(addr: string): string {
  const m = addr.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (!m) return addr.trim();
  const name = m[1].trim();
  if (!name) return `<${m[2]}>`;
  const shown = /^[\x20-\x7e]*$/.test(name) ? `"${name.replace(/["\\]/g, "\\$&")}"` : encodeWord(name);
  return `${shown} <${m[2]}>`;
}

const wrap76 = (b64: string) => b64.replace(/.{1,76}/g, "$&\r\n").trimEnd();
const noBreak = (v: string) => v.replace(/[\r\n]+/g, " ");

export function buildMime(m: MailMessage): string {
  const date = m.date ?? new Date();
  const fromAddr = m.from.match(/<([^>]+)>/)?.[1] ?? m.from.trim();
  const domain = fromAddr.split("@")[1] ?? "localhost";
  const messageId = m.messageId ?? `<${crypto.randomUUID()}@${domain}>`;
  const boundary = `b_${crypto.randomUUID().replace(/-/g, "")}`;
  const headers = [
    `From: ${encodeAddress(noBreak(m.from))}`,
    `To: ${encodeAddress(noBreak(m.to))}`,
    ...(m.replyTo ? [`Reply-To: ${encodeAddress(noBreak(m.replyTo))}`] : []),
    `Subject: ${encodeWord(noBreak(m.subject))}`,
    `Date: ${date.toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: ${messageId}`,
    "MIME-Version: 1.0",
    ...(m.unsubscribeUrl
      ? [`List-Unsubscribe: <${noBreak(m.unsubscribeUrl)}>`, "List-Unsubscribe-Post: List-Unsubscribe=One-Click"]
      : []),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const part = (type: string, body: string) =>
    [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", wrap76(base64(utf8(body)))].join("\r\n");
  return [
    headers.join("\r\n"),
    "",
    part("text/plain", m.text.replace(/\r?\n/g, "\r\n")),
    part("text/html", m.html ?? textToHtml(m.text)),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

// 순수 텍스트 리포트를 그대로 읽히는 HTML 로 옮긴다 (줄바꿈 유지, 주소는 링크로)
export function textToHtml(text: string): string {
  const esc = (v: string) => v.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);
  const body = esc(text).replace(/https?:\/\/[^\s<>&]+/g, (u) => `<a href="${u}">${u}</a>`);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body style="margin:0;padding:24px 16px;background:#ffffff"><div style="max-width:640px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:15px;line-height:1.7;color:#1d1d1f;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere">${body}</div></body></html>`;
}
