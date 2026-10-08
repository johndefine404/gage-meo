import type { Env } from "../env";
import { kakaoProvider } from "./kakao";
import { mockProvider } from "./mock";
import { naverProvider } from "./naver";
import type { PlaceProvider, Source } from "./types";

// MOCK=1 이면 예시 데이터, 키가 있으면 실제 API, 키가 없으면 "지도 확인 준비 중"
// 운영에서는 키가 없어도 예시 데이터를 실제 가게처럼 보여 주지 않는다
export function providers(env: Env): { naver: PlaceProvider; kakao: PlaceProvider } {
  const mock = env.MOCK === "1";
  return {
    naver: mock
      ? mockProvider("naver")
      : env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET
        ? naverProvider(env.NAVER_CLIENT_ID, env.NAVER_CLIENT_SECRET, env.NAVER_API_SOURCE === "openapi" ? "openapi" : "hub")
        : pendingProvider("naver"),
    kakao: mock ? mockProvider("kakao") : env.KAKAO_REST_KEY ? kakaoProvider(env.KAKAO_REST_KEY) : pendingProvider("kakao"),
  };
}

export function pendingProvider(source: Source): PlaceProvider {
  return {
    source,
    mock: false,
    pending: true,
    async search() {
      return [];
    },
  };
}
