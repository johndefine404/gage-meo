// 키가 없거나 MOCK=1 일 때 쓰는 예시 데이터 (가상의 가게)
// 실제 API 응답 모양을 그대로 흉내 내고, 어댑터의 변환 함수를 똑같이 거친다
// - 가게 이름에 "없는"이 들어가면 두 곳 모두 검색 결과가 없다
// - 가게 이름에 "카카오만"이 들어가면 네이버에서 검색되지 않는다
// - 그 밖에는 네이버는 0507 안심번호, 카카오는 일반 전화번호로 등록된 흔한 상황을 보여 준다
import { fromKakao } from "./kakao";
import { fromNaver } from "./naver";
import type { Place, PlaceProvider, PlaceQuery, Source } from "./types";

export function mockProvider(source: Source): PlaceProvider {
  return {
    source,
    mock: true,
    async search(q) {
      return mockPlaces(source, q);
    },
  };
}

export function mockPlaces(source: Source, q: PlaceQuery): Place[] {
  const region = q.region.trim() || "서울 강남구";
  const name = q.name.trim() || "모락 베이커리";
  if (name.includes("없는")) return [];
  if (source === "naver" && name.includes("카카오만")) return [];

  const sido = region.split(" ")[0];
  const sidoFull = SIDO_FULL[sido] ?? sido;
  const rest = region.split(" ").slice(1).join(" ") || "중앙구";

  if (source === "naver") {
    return [
      fromNaver({
        title: `<b>${name}</b>`,
        link: "",
        category: "음식점>카페,디저트",
        description: "",
        telephone: "0507-1400-0000",
        address: `${sidoFull} ${rest} 예시동 123-4`,
        roadAddress: `${sidoFull} ${rest} 예시로 12 1층`,
      }),
      fromNaver({
        title: `${name} 2호점`,
        link: "",
        category: "음식점>카페,디저트",
        description: "",
        telephone: "",
        address: `${sidoFull} ${rest} 샘플동 55`,
        roadAddress: `${sidoFull} ${rest} 샘플길 8`,
      }),
    ];
  }
  return [
    fromKakao({
      place_name: name,
      category_name: "음식점 > 카페 > 디저트카페",
      phone: "02-000-0000",
      address_name: `${sido} ${rest} 예시동 123-4`,
      road_address_name: `${sido} ${rest} 예시로 12`,
      place_url: "http://place.map.kakao.com/0",
    }),
  ];
}

const SIDO_FULL: Record<string, string> = {
  서울: "서울특별시",
  부산: "부산광역시",
  대구: "대구광역시",
  인천: "인천광역시",
  광주: "광주광역시",
  대전: "대전광역시",
  울산: "울산광역시",
  세종: "세종특별자치시",
  경기: "경기도",
  강원: "강원특별자치도",
  충북: "충청북도",
  충남: "충청남도",
  전북: "전북특별자치도",
  전남: "전라남도",
  경북: "경상북도",
  경남: "경상남도",
  제주: "제주특별자치도",
};
