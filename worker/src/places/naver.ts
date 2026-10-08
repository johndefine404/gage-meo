// 네이버 검색 API: 지역 검색 어댑터
// 문서: https://developers.naver.com/docs/serviceapi/search/local/local.md
// 주의: 실제 키로 호출해 본 적 없음 (키 발급 전). 응답 모양은 공식 문서 기준
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

export function naverProvider(clientId: string, clientSecret: string, fetchImpl: typeof fetch = fetch): PlaceProvider {
  return {
    source: "naver",
    mock: false,
    async search(q) {
      const url = `https://openapi.naver.com/v1/search/local.json?display=5&query=${encodeURIComponent(queryText(q))}`;
      const res = await fetchImpl(url, {
        headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
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
