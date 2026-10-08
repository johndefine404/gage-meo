// 네이버와 카카오가 같은 가게를 서로 다르게 적는 차이를 지우고 비교한다
import type { Place } from "../places/types";

export type Level = "same" | "near" | "different" | "missing";

// ---------- 전화번호 ----------

// 숫자만 남기고, 국가번호(+82)는 0으로 바꾼다
export function normalizePhone(raw: string | undefined | null): string {
  let d = String(raw ?? "").replace(/[^\d+]/g, "");
  if (d.startsWith("+82")) d = "0" + d.slice(3);
  else if (d.startsWith("0082")) d = "0" + d.slice(4);
  else if (d.startsWith("82") && d.length >= 11) d = "0" + d.slice(2);
  d = d.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(1);
  return d;
}

// 0507·0504 등 050 계열은 네이버 스마트콜 같은 안심번호(가상 번호)다
export const isVirtualNumber = (digits: string) => /^050\d/.test(digits);

export function comparePhone(a: string, b: string): Level {
  const x = normalizePhone(a);
  const y = normalizePhone(b);
  if (!x || !y) return "missing";
  if (x === y) return "same";
  if (isVirtualNumber(x) || isVirtualNumber(y)) return "near";
  return "different";
}

// ---------- 주소 ----------

const SIDO: [RegExp, string][] = [
  [/^서울(특별)?시?$/, "서울"],
  [/^부산(광역)?시?$/, "부산"],
  [/^대구(광역)?시?$/, "대구"],
  [/^인천(광역)?시?$/, "인천"],
  [/^광주(광역)?시?$/, "광주"],
  [/^대전(광역)?시?$/, "대전"],
  [/^울산(광역)?시?$/, "울산"],
  [/^세종(특별자치)?시?$/, "세종"],
  [/^경기도?$/, "경기"],
  [/^강원(특별자치)?도?$/, "강원"],
  [/^충(청)?북(도)?$|^충청북도$/, "충북"],
  [/^충(청)?남(도)?$|^충청남도$/, "충남"],
  [/^전(라)?북(도)?$|^전라북도$|^전북특별자치도$/, "전북"],
  [/^전(라)?남(도)?$|^전라남도$/, "전남"],
  [/^경(상)?북(도)?$|^경상북도$/, "경북"],
  [/^경(상)?남(도)?$|^경상남도$/, "경남"],
  [/^제주(특별자치)?도?$/, "제주"],
];

export function normalizeSido(token: string): string {
  for (const [re, short] of SIDO) if (re.test(token)) return short;
  return token;
}

// 괄호 속 참고 항목, 쉼표, 층·호수를 지우고 시도 이름을 짧은 꼴로 맞춘다
export function normalizeAddress(raw: string | undefined | null): string {
  let s = String(raw ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[,·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  const tokens = s.split(" ");
  tokens[0] = normalizeSido(tokens[0]);
  return tokens.join(" ");
}

// 비교에 쓰는 핵심: 시도 ~ 도로명(또는 동) + 건물 번호(또는 번지). 층·호수·건물 이름은 버린다
export function addressCore(raw: string | undefined | null): string {
  const s = normalizeAddress(raw);
  if (!s) return "";
  const road = s.match(/^(.*?\S+(?:로|길))\s*(\d+(?:-\d+)?)(?![\d가-힣])/);
  if (road) return `${road[1].replace(/\s+/g, " ")} ${road[2]}`;
  const lot = s.match(/^(.*?\S+(?:동|리|가|읍|면))\s+(산\s*)?(\d+(?:-\d+)?)(?![\d가-힣])/);
  if (lot) return `${lot[1]} ${lot[2] ? "산" : ""}${lot[3]}`;
  return s;
}

// 시도 + 시군구 (앞 두 낱말)
const area = (core: string) => core.split(" ").slice(0, 2).join(" ");
// 번호를 뺀 도로명 부분
const street = (core: string) => core.replace(/\s*산?\d+(?:-\d+)?$/, "");

export function compareAddress(a: Pick<Place, "address" | "roadAddress">, b: Pick<Place, "address" | "roadAddress">): Level {
  const ra = addressCore(a.roadAddress);
  const rb = addressCore(b.roadAddress);
  const ja = addressCore(a.address);
  const jb = addressCore(b.address);
  if (!(ra || ja) || !(rb || jb)) return "missing";
  // 두 곳 모두 도로명 주소가 있으면 도로명으로 판단하고, 한쪽에만 있으면 지번으로 비교한다
  if (ra && rb) {
    if (ra === rb) return "same";
    if (street(ra) === street(rb) || (ja && ja === jb)) return "near";
  } else {
    if (ja && ja === jb) return "same";
    if (ja && jb && street(ja) === street(jb)) return "near";
  }
  const aa = area(ra || ja);
  const ab = area(rb || jb);
  if (aa && aa === ab) return "near";
  return "different";
}

// ---------- 가게 이름 ----------

export function normalizeName(raw: string | undefined | null): string {
  return String(raw ?? "")
    .replace(/<[^>]*>/g, "")
    .toLowerCase()
    .replace(/[\s\-_.·,()[\]&'"!~/]/g, "");
}

export function compareName(a: string, b: string): Level {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return "missing";
  if (x === y) return "same";
  if (x.includes(y) || y.includes(x)) return "near";
  return "different";
}

// ---------- 검색 결과 중 입력한 가게 고르기 ----------

// 이름이 같거나 한쪽이 다른 쪽을 품을 때만 같은 가게로 본다. 지역 낱말이 주소에 있으면 가산
export function pickPlace(places: Place[], name: string, region: string): Place | null {
  const want = normalizeName(name);
  const regionTokens = region
    .split(/\s+/)
    .filter(Boolean)
    .map((t, i) => (i === 0 ? normalizeSido(t) : t));
  let best: Place | null = null;
  let bestScore = 0;
  for (const p of places) {
    const level = compareName(p.name, name);
    let s = level === "same" ? 10 : level === "near" ? 5 : 0;
    if (!s || !want) continue;
    const addr = `${normalizeAddress(p.roadAddress)} ${normalizeAddress(p.address)}`;
    for (const t of regionTokens) if (addr.includes(t)) s += 1;
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  return best;
}
