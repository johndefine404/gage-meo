// [Define404] 가게냥 (gage-meo): 메일 MIME 만들기
import { describe, expect, it } from "vitest";
import { buildMime, encodeAddress, encodeWord, textToHtml } from "../src/lead/mail";

const b64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s+/g, "")), (c) => c.charCodeAt(0)));
const decodeWords = (v: string) =>
  v.replace(/\r\n /g, "").replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_m, p) => b64(p));

describe("MIME 메일", () => {
  const raw = buildMime({
    from: "가게냥 <john@define404.com>",
    to: "john@define404.com",
    subject: "(광고) [Define404] 가게냥 점검 리포트: 모락 베이커리 (72점)",
    text: "첫 줄\n둘째 줄 https://contact.define404.com",
    replyTo: "john@define404.com",
    unsubscribeUrl: "https://gage.define404.com/api/unsubscribe?t=abc",
    date: new Date(Date.UTC(2026, 9, 9, 3, 0, 0)),
    messageId: "<test@define404.com>",
  });
  const cut = raw.indexOf("\r\n\r\n");
  const head = raw.slice(0, cut);
  const body = raw.slice(cut + 4);

  it("한글 제목은 UTF-8 인코딩 단어로 감싸고 풀면 원래 제목이다", () => {
    const subj = head.match(/^Subject: (.*(?:\r\n .*)*)/m)![1];
    expect(subj).toMatch(/^=\?UTF-8\?B\?/);
    expect(subj.split("\r\n ").every((w) => w.length <= 75)).toBe(true);
    expect(decodeWords(subj)).toBe("(광고) [Define404] 가게냥 점검 리포트: 모락 베이커리 (72점)");
  });

  it("보내는 이름은 인코딩하고 주소는 그대로 둔다", () => {
    const from = head.match(/^From: (.*)$/m)![1];
    expect(from).toMatch(/<john@define404\.com>$/);
    expect(decodeWords(from)).toBe("가게냥 <john@define404.com>");
    expect(encodeAddress("Define404 <a@b.com>")).toBe('"Define404" <a@b.com>');
    expect(encodeWord("ascii only")).toBe("ascii only");
  });

  it("필수 머리글과 수신 거부 머리글이 있다", () => {
    for (const h of ["To: john@define404.com", "Reply-To: john@define404.com", "Message-ID: <test@define404.com>", "MIME-Version: 1.0", "Date: Fri, 09 Oct 2026 03:00:00 +0000"]) {
      expect(head).toContain(h);
    }
    expect(head).toContain("List-Unsubscribe: <https://gage.define404.com/api/unsubscribe?t=abc>");
    expect(head).toContain("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
    expect(head).toMatch(/Content-Type: multipart\/alternative; boundary="b_[0-9a-f]+"/);
  });

  it("text/plain 과 text/html 두 부분이 모두 있고 내용이 맞다", () => {
    const boundary = head.match(/boundary="([^"]+)"/)![1];
    const parts = body.split(`--${boundary}`).slice(1, -1);
    expect(parts).toHaveLength(2);
    expect(body.trimEnd().endsWith(`--${boundary}--`)).toBe(true);
    const [plain, html] = parts.map((p) => { const i = p.indexOf("\r\n\r\n"); return [p.slice(0, i), p.slice(i + 4).trim()]; });
    expect(plain[0]).toContain("text/plain; charset=UTF-8");
    expect(html[0]).toContain("text/html; charset=UTF-8");
    expect(plain[0]).toContain("Content-Transfer-Encoding: base64");
    expect(b64(plain[1])).toBe("첫 줄\r\n둘째 줄 https://contact.define404.com");
    expect(b64(html[1])).toContain('<a href="https://contact.define404.com">');
    expect(plain[1].split("\r\n").every((l) => l.length <= 76)).toBe(true);
  });

  it("머리글에 줄바꿈을 넣어 다른 머리글을 끼워 넣을 수 없다", () => {
    const m = buildMime({ from: "a@b.com", to: "c@d.com", subject: "hi\r\nBcc: x@y.com", text: "t" });
    expect(m).not.toMatch(/^Bcc:/m);
  });

  it("HTML 본문은 꺾쇠를 이스케이프한다", () => {
    expect(textToHtml("<script>")).toContain("&#60;script&#62;");
  });
});
