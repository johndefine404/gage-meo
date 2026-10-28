// 지도 검색 결과를 네이버·카카오 공통 모양으로 맞춘다
export type Source = "naver" | "kakao";

export type Place = {
  source: Source;
  name: string;
  address: string; // 지번 주소
  roadAddress: string; // 도로명 주소
  phone: string;
  category: string;
  homepage?: string; // 네이버는 가게가 등록한 홈페이지를 준다
  placeUrl?: string; // 카카오맵 장소 페이지
};

export type PlaceQuery = { name: string; region: string };

// 검색어로 보낼 가게 이름: 괄호 속 참고 글귀를 빼고 공백을 하나로. 다 지워지면 원래 이름
export const searchName = (name: string) => name.replace(/[(（\[][^)）\]]*[)）\]]/g, " ").replace(/\s+/g, " ").trim() || name.trim();

// 실제 API에 보내는 검색어: "지역 가게이름" (지역을 비우면 가게 이름만)
export const queryText = (q: PlaceQuery) => `${q.region} ${searchName(q.name)}`.trim();

export interface PlaceProvider {
  source: Source;
  mock: boolean;
  // 검색 API 키가 아직 없어 지도 확인을 하지 않는 상태 (운영에서 예시 데이터를 보여 주지 않는다)
  pending?: boolean;
  search(q: PlaceQuery): Promise<Place[]>;
}
