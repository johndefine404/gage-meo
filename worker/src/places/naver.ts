// 네이버 검색 API: 지역 검색 어댑터
// 2026-07-31 부터 새 키는 네이버 클라우드 플랫폼의 NAVER API HUB 에서만 발급된다.
// 기본은 API HUB 주소를 쓰고, 예전 developers.naver.com 키는 NAVER_API_SOURCE=openapi 로 쓴다.
// 응답 모양은 두 주소가 같다 (2026-10-09 실제 키로 확인)
import { queryText, type Place, type PlaceProvider } from "./types";

type NaverItem = {
  title: string;
  link: string;
  category: string;
  description: string;
  telephone: string;
  address: string;
  roadAddress: string;
};

export type NaverSource = "hub" | "openapi";

export function naverRequest(source: NaverSource, clientId: string, clientSecret: string, query: string): { url: string; headers: Record<string, string> } {
  const qs = `display=5&query=${encodeURIComponent(query)}`;
  if (source === "openapi") {
    return {
      url: `https://openapi.naver.com/v1/search/local.json?${qs}`,
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
    };
  }
  return {
    url: `https://naverapihub.apigw.ntruss.com/search/v1/local?${qs}`,
    headers: { "X-NCP-APIGW-API-KEY-ID": clientId, "X-NCP-APIGW-API-KEY": clientSecret },
  };
}

export function naverProvider(clientId: string, clientSecret: string, source: NaverSource = "hub", fetchImpl: typeof fetch = fetch): PlaceProvider {
  return {
    source: "naver",
    mock: false,
    async search(q) {
      const { url, headers } = naverRequest(source, clientId, clientSecret, queryText(q));
      const res = await fetchImpl(url, {
        headers,
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`naver ${res.status}`);
      const data = (await res.json()) as { items?: NaverItem[] };
      return (data.items ?? []).map(fromNaver);
    },
  };
}

export function fromNaver(i: NaverItem): Place {
  return {
    source: "naver",
    name: stripTags(i.title),
    address: i.address ?? "",
    roadAddress: i.roadAddress ?? "",
    phone: i.telephone ?? "",
    category: i.category ?? "",
    homepage: i.link || undefined,
  };
}

// 네이버는 검색어와 겹치는 글자를 <b> 태그로 감싸서 준다
export function stripTags(s: string): string {
  return (s ?? "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
}
