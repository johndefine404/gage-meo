// 점수표: 항목마다 배점, 왜 중요한지 한 줄, 고치는 방법 한 줄
import type { Place } from "../places/types";
import type { HomepageResult } from "./homepage";
import { compareAddress, compareName, comparePhone, isVirtualNumber, normalizePhone, type Level } from "./normalize";

export type Status = "pass" | "warn" | "fail" | "unknown";
export type Group = "listing" | "homepage" | "contact";

export type Item = {
  id: string;
  group: Group;
  title: string;
  status: Status;
  points: number;
  max: number;
  detail: string; // 이번 점검에서 본 것
  why: string; // 왜 중요한지 한 줄
  fix: string; // 고치는 방법 한 줄 (메일 리포트에만 싣는다)
};

export type ScoreInput = {
  naver: { place: Place | null; error?: string; candidates: number };
  kakao: { place: Place | null; error?: string; candidates: number };
  homepage: HomepageResult | null;
  homepageFrom: "input" | "naver" | null;
};

export const GROUP_TITLE: Record<Group, string> = {
  listing: "지도 등록",
  homepage: "홈페이지",
  contact: "상담·예약 창구",
};

type Def = { group: Group; title: string; max: number; why: string; fix: string };

export const CATALOG: Record<string, Def> = {
  naver_found: {
    group: "listing",
    title: "네이버 지도에 등록",
    max: 15,
    why: "가게를 찾는 손님 다수가 네이버 지도·검색에서 시작합니다.",
    fix: "네이버 스마트플레이스(smartplace.naver.com)에서 업체를 등록하거나 이미 있는 업체의 주인 확인을 합니다.",
  },
  kakao_found: {
    group: "listing",
    title: "카카오맵에 등록",
    max: 15,
    why: "카카오맵과 카카오내비에서 길을 찾는 손님이 가게를 놓치지 않습니다.",
    fix: "카카오맵 앱의 장소 등록 또는 카카오 비즈니스(business.kakao.com)에서 업체 정보를 등록합니다.",
  },
  name_match: {
    group: "listing",
    title: "두 지도의 가게 이름 일치",
    max: 5,
    why: "이름이 다르면 손님이 같은 가게인지 헷갈리고 검색에서도 갈라집니다.",
    fix: "간판과 같은 이름 하나로 정해 네이버·카카오 두 곳을 똑같이 맞춥니다.",
  },
  address_match: {
    group: "listing",
    title: "두 지도의 주소 일치",
    max: 10,
    why: "주소가 다르면 길 안내가 엇갈려 손님이 엉뚱한 곳으로 갑니다.",
    fix: "도로명 주소와 건물 번호를 두 곳에서 같게 고치고, 층·호수는 상세 주소 칸에 적습니다.",
  },
  phone_match: {
    group: "listing",
    title: "두 지도의 전화번호 일치",
    max: 10,
    why: "번호가 다르거나 없으면 전화 문의가 끊기고 신뢰가 떨어집니다.",
    fix: "실제로 받는 번호를 두 곳에 같게 적습니다. 네이버 안심번호(0507)를 쓰면 카카오에도 같은 번호를 쓰는 편이 낫습니다.",
  },
  homepage_exists: {
    group: "homepage",
    title: "홈페이지 연결",
    max: 5,
    why: "지도 정보에 담기 어려운 메뉴·가격·사진을 한곳에 보여 줄 수 있습니다.",
    fix: "블로그나 무료 홈페이지라도 하나 만들고 네이버 스마트플레이스의 홈페이지 칸에 넣습니다.",
  },
  https: {
    group: "homepage",
    title: "보안 연결(https)",
    max: 5,
    why: "https 가 아니면 브라우저가 '주의 요함'을 띄우고 검색 순위에도 불리합니다.",
    fix: "호스팅 업체의 무료 SSL 인증서를 켜고 http 주소를 https 로 넘기도록 설정합니다.",
  },
  viewport: {
    group: "homepage",
    title: "휴대폰 화면 대응",
    max: 5,
    why: "손님 대부분이 휴대폰으로 봅니다. 대응이 없으면 글씨가 깨알같이 작게 보입니다.",
    fix: '<head> 에 <meta name="viewport" content="width=device-width, initial-scale=1"> 한 줄을 넣습니다.',
  },
  speed: {
    group: "homepage",
    title: "첫 응답 속도",
    max: 5,
    why: "3초 안에 뜨지 않으면 손님 상당수가 기다리지 않고 나갑니다.",
    fix: "큰 사진을 줄이고 캐시를 켜거나, 더 빠른 호스팅(Cloudflare Pages 등)으로 옮깁니다.",
  },
  title_desc: {
    group: "homepage",
    title: "검색 제목·설명",
    max: 5,
    why: "검색 결과에 보이는 제목과 설명 문구가 손님이 누를지 말지를 정합니다.",
    fix: '<title> 에 "가게이름 | 지역 업종"을, <meta name="description"> 에 한두 문장 소개를 넣습니다.',
  },
  naver_verify: {
    group: "homepage",
    title: "네이버 서치어드바이저 등록",
    max: 5,
    why: "네이버에 사이트 주인을 알려야 네이버 검색 수집이 빨라지고 상태를 볼 수 있습니다.",
    fix: "searchadvisor.naver.com 에서 사이트를 등록하고 받은 naver-site-verification 메타 태그를 넣습니다.",
  },
  sitemap_robots: {
    group: "homepage",
    title: "사이트맵·robots.txt",
    max: 5,
    why: "검색 로봇이 어떤 페이지를 읽어야 하는지 알려 주는 안내판입니다.",
    fix: "sitemap.xml 과 robots.txt 를 사이트 맨 위 경로에 두고, robots.txt 에 Sitemap: 줄을 적습니다.",
  },
  og: {
    group: "homepage",
    title: "카톡 공유 미리보기(Open Graph)",
    max: 3,
    why: "카카오톡으로 주소를 보낼 때 사진과 제목이 붙어야 눌러 봅니다.",
    fix: "og:title, og:description, og:image 메타 태그를 넣습니다.",
  },
  chat_channel: {
    group: "contact",
    title: "카카오톡 채널·네이버 톡톡 연결",
    max: 5,
    why: "전화하기 부담스러운 손님도 메시지로는 묻습니다. 문의 창구가 하나 더 생깁니다.",
    fix: "카카오톡 채널(또는 네이버 톡톡)을 만들고 홈페이지에 상담 버튼을 답니다.",
  },
  booking_link: {
    group: "contact",
    title: "네이버 예약 연결",
    max: 2,
    why: "손님이 전화 없이 바로 예약하면 놓치는 예약이 줄어듭니다.",
    fix: "네이버 예약을 열고 홈페이지에 예약 버튼(booking.naver.com 주소)을 답니다.",
  },
};

const PTS: Record<Status, number> = { pass: 1, warn: 0.5, fail: 0, unknown: 0 };

function item(id: string, status: Status, detail: string, fix?: string): Item {
  const d = CATALOG[id];
  return {
    id,
    group: d.group,
    title: d.title,
    status,
    points: Math.round(d.max * PTS[status] * 10) / 10,
    max: d.max,
    detail,
    why: d.why,
    fix: status === "pass" ? "지금 상태를 유지하면 됩니다." : fix ?? d.fix,
  };
}

const levelStatus = (l: Level): Status => (l === "same" ? "pass" : l === "near" ? "warn" : l === "missing" ? "warn" : "fail");

export function buildItems(s: ScoreInput): Item[] {
  const items: Item[] = [];
  const n = s.naver.place;
  const k = s.kakao.place;

  // 지도 등록
  for (const [id, side, label] of [
    ["naver_found", s.naver, "네이버"],
    ["kakao_found", s.kakao, "카카오"],
  ] as const) {
    if (side.error) items.push(item(id, "unknown", `${label} 검색을 하지 못했습니다 (${side.error})`));
    else if (side.place) items.push(item(id, "pass", `"${side.place.name}" (${side.place.roadAddress || side.place.address})`));
    else if (side.candidates > 0) items.push(item(id, "fail", `비슷한 결과 ${side.candidates}곳이 나왔지만 이름이 맞는 가게가 없습니다`));
    else items.push(item(id, "fail", `${label}에서 검색되지 않습니다`));
  }

  if (n && k) {
    const nameL = compareName(n.name, k.name);
    items.push(
      item("name_match", levelStatus(nameL), nameL === "same" ? "두 곳 이름이 같습니다" : `네이버 "${n.name}", 카카오 "${k.name}"`),
    );
    const addrL = compareAddress(n, k);
    items.push(
      item(
        "address_match",
        levelStatus(addrL),
        addrL === "same"
          ? "도로명 주소와 건물 번호가 같습니다"
          : `네이버 "${n.roadAddress || n.address}", 카카오 "${k.roadAddress || k.address}"`,
      ),
    );
    const phL = comparePhone(n.phone, k.phone);
    const np = normalizePhone(n.phone);
    const kp = normalizePhone(k.phone);
    let phDetail = "두 곳 번호가 같습니다";
    if (phL === "missing") phDetail = `번호가 없는 곳이 있습니다 (네이버 "${n.phone || "없음"}", 카카오 "${k.phone || "없음"}")`;
    else if (phL === "near") phDetail = `한쪽은 안심번호(050 계열)입니다 (네이버 "${n.phone}", 카카오 "${k.phone}")`;
    else if (phL === "different") phDetail = `번호가 다릅니다 (네이버 "${n.phone}", 카카오 "${k.phone}")`;
    const phFix =
      phL === "near" && (isVirtualNumber(np) || isVirtualNumber(kp))
        ? "안심번호와 실제 번호가 섞여 있습니다. 손님이 헷갈리지 않게 두 곳에 같은 번호를 씁니다."
        : undefined;
    items.push(item("phone_match", levelStatus(phL), phDetail, phFix));
  } else {
    const why = "두 지도 모두에서 가게가 확인돼야 비교할 수 있습니다";
    items.push(item("name_match", "unknown", why), item("address_match", "unknown", why), item("phone_match", "unknown", why));
  }

  // 홈페이지
  const h = s.homepage;
  if (!h) {
    items.push(item("homepage_exists", "fail", "입력한 주소도, 네이버에 등록된 홈페이지도 없습니다"));
    for (const id of ["https", "viewport", "speed", "title_desc", "naver_verify", "sitemap_robots", "og"]) {
      items.push(item(id, "unknown", "홈페이지가 없어 확인하지 않았습니다"));
    }
  } else if (!h.ok || !h.facts) {
    items.push(item("homepage_exists", "warn", `${h.inputUrl}: ${h.error ?? "열리지 않습니다"}`, "홈페이지 주소가 열리는지 확인하고, 바뀌었으면 지도 정보의 홈페이지 칸도 고칩니다."));
    for (const id of ["https", "viewport", "speed", "title_desc", "naver_verify", "sitemap_robots", "og"]) {
      items.push(item(id, "unknown", "홈페이지가 열리지 않아 확인하지 못했습니다"));
    }
  } else {
    const f = h.facts;
    const from = s.homepageFrom === "naver" ? " (네이버에 등록된 주소)" : "";
    items.push(item("homepage_exists", "pass", `${h.finalUrl}${from}`));
    items.push(item("https", h.https ? "pass" : "fail", h.https ? "https 로 열립니다" : "http 로 열립니다"));
    items.push(item("viewport", f.viewport ? "pass" : "fail", f.viewport ? "휴대폰 화면 설정이 있습니다" : "viewport 설정이 없습니다"));
    const ms = h.elapsedMs ?? 0;
    items.push(item("speed", ms < 1500 ? "pass" : ms < 3000 ? "warn" : "fail", `${(ms / 1000).toFixed(2)}초 (서버 응답까지)`));
    const td = f.title && f.description ? "pass" : f.title || f.description ? "warn" : "fail";
    items.push(
      item("title_desc", td, `제목 ${f.title ? `"${f.title.slice(0, 60)}"` : "없음"}, 설명 ${f.description ? "있음" : "없음"}`),
    );
    items.push(item("naver_verify", f.naverVerification ? "pass" : "fail", f.naverVerification ? "소유 확인 태그가 있습니다" : "naver-site-verification 태그가 없습니다"));
    const sr = h.sitemap && h.robots ? "pass" : h.sitemap || h.robots ? "warn" : "fail";
    items.push(item("sitemap_robots", sr, `robots.txt ${h.robots ? "있음" : "없음"}, sitemap ${h.sitemap ? "있음" : "없음"}`));
    const ogCount = [f.og.title, f.og.description, f.og.image].filter(Boolean).length;
    items.push(item("og", ogCount === 3 ? "pass" : ogCount > 0 ? "warn" : "fail", `og 태그 ${ogCount}/3 (제목, 설명, 이미지)`));
  }

  // 상담·예약 창구 (홈페이지에 붙은 링크로 판단)
  if (h?.ok && h.facts) {
    const f = h.facts;
    const chans = [f.kakaoChannel && "카카오톡 채널", f.naverTalk && "네이버 톡톡"].filter(Boolean).join(", ");
    items.push(item("chat_channel", chans ? "pass" : "fail", chans ? `${chans} 연결됨` : "홈페이지에 카카오톡 채널·톡톡 링크가 없습니다"));
    items.push(item("booking_link", f.naverBooking ? "pass" : "fail", f.naverBooking ? "네이버 예약 링크가 있습니다" : "네이버 예약 링크가 없습니다"));
  } else {
    items.push(item("chat_channel", "unknown", "홈페이지가 없어 확인하지 못했습니다"));
    items.push(item("booking_link", "unknown", "홈페이지가 없어 확인하지 못했습니다"));
  }
  return items;
}

export type Summary = { score: number; grade: string; groups: { id: Group; title: string; points: number; max: number }[] };

export function summarize(items: Item[]): Summary {
  const total = items.reduce((a, i) => a + i.points, 0);
  const score = Math.round(total);
  const grade = score >= 80 ? "좋음" : score >= 60 ? "보통" : score >= 40 ? "손볼 곳 많음" : "급함";
  const groups = (Object.keys(GROUP_TITLE) as Group[]).map((g) => {
    const gi = items.filter((i) => i.group === g);
    return { id: g, title: GROUP_TITLE[g], points: Math.round(gi.reduce((a, i) => a + i.points, 0) * 10) / 10, max: gi.reduce((a, i) => a + i.max, 0) };
  });
  return { score, grade, groups };
}

export const MAX_SCORE = Object.values(CATALOG).reduce((a, d) => a + d.max, 0);
