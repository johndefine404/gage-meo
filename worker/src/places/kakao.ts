// 카카오 로컬 API: 키워드로 장소 검색 어댑터
// 문서: https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-keyword
// 주의: 실제 키로 호출해 본 적 없음 (키 발급 전). 응답 모양은 공식 문서 기준
import { queryText, type Place, type PlaceProvider } from "./types";

type KakaoDoc = {
  place_name: string;
  category_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  place_url: string;
};

export function kakaoProvider(restKey: string, fetchImpl: typeof fetch = fetch): PlaceProvider {
  return {
    source: "kakao",
    mock: false,
    async search(q) {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?size=5&query=${encodeURIComponent(queryText(q))}`;
      const res = await fetchImpl(url, {
        headers: { Authorization: `KakaoAK ${restKey}` },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`kakao ${res.status}`);
      const data = (await res.json()) as { documents?: KakaoDoc[] };
      return (data.documents ?? []).map(fromKakao);
    },
  };
}

export function fromKakao(d: KakaoDoc): Place {
  return {
    source: "kakao",
    name: d.place_name ?? "",
    address: d.address_name ?? "",
    roadAddress: d.road_address_name ?? "",
    phone: d.phone ?? "",
    category: d.category_name ?? "",
    placeUrl: d.place_url || undefined,
  };
}
