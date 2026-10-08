import type { Env } from "../env";
import { kakaoProvider } from "./kakao";
import { mockProvider } from "./mock";
import { naverProvider } from "./naver";
import type { PlaceProvider } from "./types";

// 키가 있으면 실제 API, 없거나 MOCK=1 이면 예시 데이터
export function providers(env: Env): { naver: PlaceProvider; kakao: PlaceProvider } {
  const mock = env.MOCK === "1";
  return {
    naver:
      !mock && env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET
        ? naverProvider(env.NAVER_CLIENT_ID, env.NAVER_CLIENT_SECRET)
        : mockProvider("naver"),
    kakao: !mock && env.KAKAO_REST_KEY ? kakaoProvider(env.KAKAO_REST_KEY) : mockProvider("kakao"),
  };
}
