// 홈페이지 점검: 첫 화면 HTML 과 robots.txt, sitemap.xml 을 읽는다
// 자바스크립트로 나중에 그려지는 내용은 보지 못한다 (서버가 내려준 HTML 만 읽는다)
import { BlockedUrlError, safeFetch, type Guard } from "./safefetch";

export type PageFacts = {
  title: string;
  description: string;
  viewport: boolean;
  naverVerification: boolean;
  og: { title: boolean; description: boolean; image: boolean };
  kakaoChannel: boolean; // pf.kakao.com 링크 또는 카카오 채널 버튼
  naverBooking: boolean; // booking.naver.com
  naverTalk: boolean; // talk.naver.com
};

export type HomepageResult = {
  inputUrl: string;
  ok: boolean;
  error?: string;
  finalUrl?: string;
  status?: number;
  https?: boolean;
  elapsedMs?: number;
  redirects?: string[];
  facts?: PageFacts;
  robots?: boolean;
  sitemap?: boolean;
};

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ")
    .trim();

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  return out;
}

export function analyzeHtml(html: string): PageFacts {
  const metas = (html.match(/<meta\b[^>]*>/gi) ?? []).map(attrs);
  const meta = (key: string) => {
    const m = metas.find((a) => (a.name ?? a.property ?? "").toLowerCase() === key);
    return m ? decodeEntities(m.content ?? "") : "";
  };
  const title = decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const lower = html.toLowerCase();
  return {
    title,
    description: meta("description"),
    viewport: /width\s*=\s*device-width/i.test(meta("viewport")),
    naverVerification: meta("naver-site-verification").length > 0,
    og: { title: !!meta("og:title"), description: !!meta("og:description"), image: !!meta("og:image") },
    kakaoChannel: /pf\.kakao\.com\/_\w+/i.test(html) || lower.includes("kakao.channel.") || lower.includes("createchatbutton"),
    naverBooking: /booking\.naver\.com\//i.test(html),
    naverTalk: /talk\.naver\.com\//i.test(html),
  };
}

// 사용자가 넣은 주소에 https:// 를 붙여 주고 모양을 정리한다
export function normalizeInputUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
}

export type HomepageDeps = { guard: Guard; fetchImpl?: typeof fetch; timeoutMs?: number };

export async function checkHomepage(raw: string, deps: HomepageDeps): Promise<HomepageResult> {
  const inputUrl = normalizeInputUrl(raw);
  const base = { inputUrl, ok: false } as HomepageResult;
  const opts = { guard: deps.guard, fetchImpl: deps.fetchImpl, timeoutMs: deps.timeoutMs };
  let page;
  try {
    page = await safeFetch(inputUrl, opts);
  } catch (e) {
    // https 로 붙였는데 연결이 안 되면 http 로 한 번 더
    if (!(e instanceof BlockedUrlError) && !/^https?:/i.test(raw.trim())) {
      try {
        page = await safeFetch(inputUrl.replace(/^https:/, "http:"), opts);
      } catch (e2) {
        return { ...base, error: errorText(e2) };
      }
    } else {
      return { ...base, error: errorText(e) };
    }
  }
  if (page.status >= 400) return { ...base, finalUrl: page.url, status: page.status, error: `홈페이지가 ${page.status} 오류로 답합니다` };

  const final = new URL(page.url);
  const origin = final.origin;
  const robotsRes = await safeFetch(`${origin}/robots.txt`, { ...opts, maxBytes: 200_000 }).catch(() => null);
  const robots = !!robotsRes && robotsRes.status === 200 && looksLikeText(robotsRes);
  const sitemapLine = robots ? robotsRes!.body.match(/^\s*sitemap:\s*(\S+)/im)?.[1] : undefined;
  const sitemapRes = await safeFetch(sitemapLine || `${origin}/sitemap.xml`, { ...opts, maxBytes: 500_000 }).catch(() => null);
  const sitemap = !!sitemapRes && sitemapRes.status === 200 && /<(urlset|sitemapindex)\b/i.test(sitemapRes.body);

  return {
    inputUrl,
    ok: true,
    finalUrl: page.url,
    status: page.status,
    https: final.protocol === "https:",
    elapsedMs: page.elapsedMs,
    redirects: page.redirects,
    facts: analyzeHtml(page.body),
    robots,
    sitemap,
  };
}

// 없는 주소에도 첫 화면 HTML 을 돌려주는 사이트가 있어서, HTML 이면 robots.txt 로 치지 않는다
function looksLikeText(r: { headers: Headers; body: string }): boolean {
  const ct = r.headers.get("content-type") ?? "";
  return !ct.includes("html") && !/^\s*</.test(r.body);
}

function errorText(e: unknown): string {
  if (e instanceof BlockedUrlError) return e.reason;
  const msg = e instanceof Error ? e.message : String(e);
  if (/abort|timeout/i.test(msg)) return "홈페이지가 제한 시간 안에 답하지 않았습니다";
  return "홈페이지에 연결하지 못했습니다";
}
