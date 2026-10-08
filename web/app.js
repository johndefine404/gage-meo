// [Define404] 가게냥 (gage-meo): 입력 화면과 결과 화면
(() => {
  const $ = (s) => document.querySelector(s);
  const LABEL = { pass: "좋음", warn: "보완", fail: "고칠 것", unknown: "확인 못 함" };
  const GROUP = { listing: "지도 등록", homepage: "홈페이지", contact: "상담·예약 창구" };
  let checkId = null;

  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };

  async function post(path, body) {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "잠시 후 다시 시도해 주세요");
    return data;
  }

  // 브랜드·동의 문구 (대행사 설정)
  fetch("/api/config")
    .then((r) => r.json())
    .then((cfg) => {
      const b = cfg.brand;
      if (/^#[0-9a-fA-F]{6}$/.test(b.color)) document.documentElement.style.setProperty("--brand", b.color);
      document.querySelectorAll("[data-brand-name]").forEach((e) => (e.textContent = b.name));
      document.querySelectorAll("[data-brand-link]").forEach((e) => (e.href = b.url));
      document.querySelectorAll("[data-cta-link]").forEach((e) => (e.href = b.ctaUrl));
      document.querySelectorAll("[data-cta-label]").forEach((e) => (e.textContent = b.ctaLabel));
      for (const [id, list] of [["privacyText", cfg.consent.privacy], ["marketingText", cfg.consent.marketing]]) {
        const ul = document.getElementById(id);
        ul.replaceChildren(...list.map((t) => el("li", null, t)));
      }
      if (cfg.mock.naver || cfg.mock.kakao) $("#mockNote").hidden = false;
      if (cfg.pending && (cfg.pending.naver || cfg.pending.kakao)) {
        $("#pendingNote").hidden = false;
        $("#checkForm .hint").textContent = "지도 확인이 준비 중이라 홈페이지 주소를 적어 주셔야 홈페이지를 점검합니다.";
      }
      const pu = cfg.consent.privacyUrl || b.privacyUrl;
      if (/^https?:\/\//.test(pu)) document.querySelectorAll("[data-privacy-link]").forEach((e) => (e.href = pu));
    })
    .catch(() => {});

  $("#checkForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector("button");
    $("#checkErr").textContent = "";
    const body = { name: f.elements.namedItem("name").value, region: f.region.value, url: f.url.value, website: f.website.value };
    if (!body.name.trim() || !body.region.trim()) {
      $("#checkErr").textContent = "가게 이름과 지역을 적어 주세요";
      return;
    }
    btn.disabled = true;
    btn.textContent = "점검하는 중 (최대 20초)";
    try {
      render(await post("/api/check", body));
    } catch (err) {
      $("#checkErr").textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = "점검하기";
    }
  });

  function render(r) {
    checkId = r.id;
    $("#resStore").textContent = `${r.input.name} · ${r.input.region}`;
    $("#resScore").textContent = r.score;
    $("#resGrade").textContent = r.grade;
    $("#resMock").hidden = !(r.mock.naver || r.mock.kakao);
    $("#resNote").textContent = r.scoreNote || "";
    $("#resNote").hidden = !r.scoreNote;
    requestAnimationFrame(() => ($("#resMeter").style.width = `${r.score}%`));

    $("#resGroups").replaceChildren(
      ...r.groups.map((g) => {
        const li = el("li");
        li.append(el("span", null, g.title), el("span", null, `${g.points} / ${g.max}`));
        const bar = el("span", "bar");
        const i = el("i");
        i.style.width = `${g.max ? (g.points / g.max) * 100 : 0}%`;
        bar.append(i);
        li.append(bar);
        return li;
      }),
    );

    const rows = [];
    let last = null;
    for (const it of r.items) {
      if (it.group !== last) {
        rows.push(el("li", "grp", GROUP[it.group] || it.group));
        last = it.group;
      }
      const li = el("li");
      li.append(el("span", `st ${it.status}`, LABEL[it.status]), el("span", "t", it.title), el("span", "pts", `${it.points} / ${it.max}`));
      li.append(el("span", "d", it.detail));
      if (it.status !== "pass") li.append(el("span", "w", it.why));
      rows.push(li);
    }
    $("#resItems").replaceChildren(...rows);
    $("#meo").hidden = !r.suggestBookingMeo;
    $("#leadOk").hidden = true;
    $("#leadErr").textContent = "";
    $("#leadForm").querySelector("button").disabled = false;
    $("#result").hidden = false;
    $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  $("#leadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector("button");
    $("#leadErr").textContent = "";
    if (!f.consentPrivacy.checked) {
      $("#leadErr").textContent = "개인정보 수집·이용에 동의해 주세요 (필수)";
      return;
    }
    btn.disabled = true;
    try {
      const data = await post("/api/lead", {
        checkId,
        email: f.email.value,
        consentPrivacy: f.consentPrivacy.checked,
        consentMarketing: f.consentMarketing.checked,
        website: f.website.value,
      });
      $("#leadOk").textContent = data.duplicate ? "이미 신청하셨습니다. 메일함을 확인해 주세요." : "리포트를 보냈습니다. 메일함(스팸함 포함)을 확인해 주세요.";
      $("#leadOk").hidden = false;
    } catch (err) {
      $("#leadErr").textContent = err.message;
      btn.disabled = false;
    }
  });

  $("#again").addEventListener("click", () => {
    setTimeout(() => $("#checkForm").elements.namedItem("name").focus(), 300);
  });
})();
