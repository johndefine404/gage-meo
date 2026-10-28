// 점검 한 번: 네이버·카카오 검색 → 가게 고르기 → 홈페이지 → 점수
import type { Place, PlaceProvider } from "../places/types";
import type { HomepageResult } from "./homepage";
import { pickPlace, rankCandidates, type Candidate } from "./normalize";
import { buildItems, summarize, type Item, type Summary } from "./score";

export type CheckInput = { name: string; region: string; url?: string };

export type CheckResult = Summary & {
  id: string;
  createdAt: number;
  input: CheckInput;
  mock: { naver: boolean; kakao: boolean };
  pending: { naver: boolean; kakao: boolean }; // 지도 확인 준비 중 (검색 API 키 없음)
  scoreNote: string | null; // 점수를 읽을 때 알아야 할 것 (지도 확인 준비 중 등)
  // 두 지도 모두에서 가게를 못 찾았을 때: 이름을 고쳐 다시 점검하도록 보여 줄 비슷한 이름 후보
  notFound: { candidates: Candidate[] } | null;
  items: Item[];
  homepageUrl: string | null;
  suggestBookingMeo: boolean;
};

export type CheckDeps = {
  naver: PlaceProvider;
  kakao: PlaceProvider;
  homepage: (url: string) => Promise<HomepageResult>;
  suggestBookingMeo?: boolean;
  now?: () => number;
  id?: () => string;
};

export async function runCheck(input: CheckInput, deps: CheckDeps): Promise<CheckResult> {
  const q = { name: input.name, region: input.region };
  // 1차: "지역 가게이름". 못 고르면 2차: 가게 이름만 (네이버 지역 검색은 지역 낱말이 붙으면 지점명이 조금만 달라도 0건을 준다)
  // 2차에서는 지역 낱말이 주소에 하나도 없는 가게는 고르지 않는다. 지도 API 호출은 한 곳당 최대 2번
  const seen: Place[] = [];
  const search = async (p: PlaceProvider) => {
    if (p.pending) return { place: null, candidates: 0, pending: true };
    try {
      const list = await p.search(q);
      seen.push(...list);
      let place = pickPlace(list, input.name, input.region);
      let candidates = list.length;
      if (!place && q.region) {
        const again = await p.search({ name: q.name, region: "" });
        seen.push(...again);
        place = pickPlace(again, input.name, input.region, { requireRegion: true });
        candidates = Math.max(candidates, again.length);
      }
      return { place, candidates };
    } catch (e) {
      console.error(p.source, e);
      return { place: null, candidates: 0, error: "검색 API 오류" };
    }
  };
  const [naver, kakao] = await Promise.all([search(deps.naver), search(deps.kakao)]);

  const url = input.url?.trim() || naver.place?.homepage || "";
  const homepageFrom = input.url?.trim() ? "input" : url ? "naver" : null;
  const homepage = url ? await deps.homepage(url) : null;

  const items = buildItems({ naver, kakao, homepage, homepageFrom });
  const summary = summarize(items);
  const pending = { naver: !!deps.naver.pending, kakao: !!deps.kakao.pending };
  const scoreNote =
    pending.naver || pending.kakao
      ? `지도 확인은 준비 중입니다. ${[pending.naver && "네이버", pending.kakao && "카카오"].filter(Boolean).join("·")} 지도 항목은 아직 확인하지 못해 0점으로 셌습니다. 지금 점수는 홈페이지와 상담·예약 창구를 실제로 점검한 결과입니다.`
      : null;
  if (scoreNote) summary.grade = "지도 확인 준비 중";
  const searched = (x: { pending?: boolean; error?: string }) => !x.pending && !x.error;
  const notFound =
    searched(naver) && searched(kakao) && !naver.place && !kakao.place ? { candidates: rankCandidates(seen, input.name, input.region) } : null;
  const chat = items.find((i) => i.id === "chat_channel");
  return {
    ...summary,
    id: deps.id ? deps.id() : crypto.randomUUID(),
    createdAt: deps.now ? deps.now() : Date.now(),
    input: { name: input.name, region: input.region, url: input.url || undefined },
    mock: { naver: deps.naver.mock, kakao: deps.kakao.mock },
    pending,
    scoreNote,
    notFound,
    items,
    homepageUrl: homepage?.finalUrl ?? (url || null),
    suggestBookingMeo: (deps.suggestBookingMeo ?? true) && chat?.status !== "pass",
  };
}

// 화면에 보내는 요약: 고치는 방법(fix)은 빼고 메일 리포트에만 싣는다
export function publicView(r: CheckResult) {
  return { ...r, items: r.items.map(({ fix: _fix, ...rest }) => rest) };
}
