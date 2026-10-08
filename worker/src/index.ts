// [Define404] 가게냥 (gage-meo): 우리 가게 온라인 점검
// 가게 이름과 지역으로 네이버·카카오 지도 등록 상태와 홈페이지를 점검해 점수로 보여 준다.
import { Hono } from "hono";
import { brand, consentText, CONSENT_VERSION } from "./brand";
import { publicView, runCheck } from "./core/check";
import { checkHomepage } from "./core/homepage";
import { strictGuard } from "./core/safefetch";
import type { Env } from "./env";
import { sendMail } from "./lead/mail";
import { ownerNoticeText, reportSubject, reportText } from "./lead/report";
import { cleanup, leadExists, loadCheck, saveCheck, saveLead, takeDaily } from "./lead/store";
import { providers } from "./places";

const app = new Hono<{ Bindings: Env }>();

// 접속자별 요청 제한
app.use("/api/*", async (c, next) => {
  if (c.req.method === "POST" && c.env.LIMITER) {
    const key = c.req.header("CF-Connecting-IP") || "unknown";
    const { success } = await c.env.LIMITER.limit({ key });
    if (!success) return c.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요" }, 429);
  }
  await next();
});

app.get("/health", (c) => c.json({ ok: true }));

app.get("/api/config", (c) => {
  const b = brand(c.env);
  const p = providers(c.env);
  return c.json({ brand: b, consent: consentText(b), mock: { naver: p.naver.mock, kakao: p.kakao.mock } });
});

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

app.post("/api/check", async (c) => {
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return c.json({ error: "잘못된 요청입니다" }, 400);
  if (b.website) return c.json({ error: "잘못된 요청입니다" }, 400); // 봇이 채우는 숨은 칸
  const name = clean(b.name, 50);
  const region = clean(b.region, 40);
  const url = clean(b.url, 300);
  if (!name || !region) return c.json({ error: "가게 이름과 지역을 적어 주세요" }, 400);

  if (!(await takeDaily(c.env.DB, "check", Number(c.env.DAILY_CHECK_LIMIT) || 500))) {
    return c.json({ error: "오늘 점검 가능 횟수를 다 썼습니다. 내일 다시 시도해 주세요" }, 429);
  }

  const br = brand(c.env);
  const guard = strictGuard();
  const result = await runCheck(
    { name, region, url: url || undefined },
    { ...providers(c.env), homepage: (u) => checkHomepage(u, { guard }), suggestBookingMeo: br.suggestBookingMeo },
  );
  await saveCheck(c.env.DB, result);
  return c.json(publicView(result));
});

const EMAIL = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[a-zA-Z]{2,}$/;
const CHECK_ID = /^[0-9a-f-]{36}$/;

app.post("/api/lead", async (c) => {
  const b = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return c.json({ error: "잘못된 요청입니다" }, 400);
  if (b.website) return c.json({ ok: true }); // 봇이 채우는 숨은 칸
  const email = clean(b.email, 200).toLowerCase();
  const checkId = clean(b.checkId, 40);
  if (b.consentPrivacy !== true) return c.json({ error: "개인정보 수집·이용에 동의해 주세요 (필수)" }, 400);
  if (!EMAIL.test(email)) return c.json({ error: "메일 주소를 확인해 주세요" }, 400);
  if (!CHECK_ID.test(checkId)) return c.json({ error: "점검 결과를 찾을 수 없습니다" }, 400);
  const marketing = b.consentMarketing === true;

  const result = await loadCheck(c.env.DB, checkId);
  if (!result) return c.json({ error: "점검 결과가 만료됐습니다. 다시 점검해 주세요" }, 404);

  if (await leadExists(c.env.DB, checkId, email)) return c.json({ ok: true, duplicate: true });
  if (!(await takeDaily(c.env.DB, "lead", Number(c.env.DAILY_LEAD_LIMIT) || 100))) {
    return c.json({ error: "오늘 보낼 수 있는 리포트 수를 넘었습니다. 내일 다시 신청해 주세요" }, 429);
  }

  const isNew = await saveLead(c.env.DB, {
    checkId,
    email,
    storeName: result.input.name,
    region: result.input.region,
    score: result.score,
    marketing,
    consentVersion: CONSENT_VERSION,
  });
  if (!isNew) return c.json({ ok: true, duplicate: true });

  const br = brand(c.env);
  const mailed = await sendMail(c.env, email, reportSubject(result, br), reportText(result, br), c.env.OWNER_EMAIL);
  // 운영자 알림은 실패해도 신청자 응답에는 영향을 주지 않는다
  const notice = ownerNoticeText(result, email, marketing);
  if (c.env.OWNER_EMAIL) {
    c.executionCtx.waitUntil(
      sendMail(c.env, c.env.OWNER_EMAIL, `[${br.name}] 가게냥 새 리포트 신청: ${result.input.name}`, notice).catch((e) => console.error("owner notice", e)),
    );
  } else {
    console.log(`[owner notice: OWNER_EMAIL 없음]\n${notice}`);
  }
  return c.json({ ok: true, mailed });
});

app.notFound((c) => c.json({ error: "not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "잠시 후 다시 시도해 주세요" }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_e: ScheduledController, env: Env) {
    await cleanup(env.DB);
  },
} satisfies ExportedHandler<Env>;
