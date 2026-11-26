/* ─────────────────────────────────────────────────────────────
   學道 — 화면 (라우팅 · 렌더링 · 사용자 조작)
   계산은 HakdoEngine, 기준은 HAKDO_DATA, 저장은 HakdoStore 가 담당합니다.
   ───────────────────────────────────────────────────────────── */
(function () {
  "use strict";
  const D = window.HAKDO_DATA, E = window.HakdoEngine, Store = window.HakdoStore;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const C = code => E.course(D, code);
  const AREA = id => E.areaName(D, id);
  const creditsOf = codes => codes.reduce((s, c) => s + (C(c) ? C(c).credits : 0), 0);
  const fmt = n => (Math.round(n * 10) / 10).toString();
  const arrow = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6"/></svg>';
  const ICON = {
    ok: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    warn: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2 14.5 13.5h-13z" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M8 6.5v3.4M8 11.3v.9" stroke="currentColor" stroke-width="1.5"/></svg>',
    short: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5 8h6" stroke="currentColor" stroke-width="1.6"/></svg>',
    check: '<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.2v.6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>'
  };

  /* ── 상태 ── */
  const today = new Date();
  const defaultTerm = () => {
    const m = today.getMonth() + 1;
    if (m === 1) return {year: today.getFullYear() - 1, sem: 2};
    return {year: today.getFullYear(), sem: m >= 8 ? 2 : 1};
  };
  const blank = () => ({
    profile: {dept: "컴퓨터공학과", entryYear: 2023, grade: null, ...defaultTerm(), cert: null},
    records: [], unknown: [], noCourses: false, settings: null, plan: null, planSavedAt: null, needsReview: false
  });
  let db = Store.load() || {mode: "mine", mine: null, sample: null};
  const cur = () => db[db.mode];
  const isSample = () => db.mode === "sample";
  let saveFailed = false;

  function persist() {
    const ok = Store.save(db);
    saveFailed = !ok;
    renderSaveState();
    return ok;
  }
  function renderSaveState() {
    const el = $("#save-state");
    if (saveFailed) { el.className = "saved fail"; el.textContent = "저장하지 못했어요. 다시 시도해 주세요"; return; }
    el.className = "saved";
    if (isSample() && cur()) el.innerHTML = "<i></i>샘플 체험 중";
    else if (db.mine && (db.mine.records.length || db.mine.plan)) el.innerHTML = "<i></i>이 기기의 브라우저에 저장돼요";
    else el.textContent = "";
  }
  const profileReady = st => st && E.isSupported(D, st.profile) && st.profile.grade && st.profile.sem && /^\d{4}$/.test(String(st.profile.year)) && st.profile.cert;
  const recordsReady = st => st && (st.records.length > 0 || st.noCourses);

  /* ── 라우팅 ── */
  const ROUTES = ["register", "status", "setup", "journey"];
  const go = r => { if (location.hash === "#/" + r) render(); else location.hash = "#/" + r; };
  addEventListener("hashchange", render);

  function render() {
    closeDrawer(true);
    const r = location.hash.replace(/^#\/?/, "").split("?")[0];
    const view = ROUTES.includes(r) ? r : "landing";
    $$("[data-nav]").forEach(a => {
      const on = a.dataset.nav === view || (view === "setup" && a.dataset.nav === "journey");
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.body.classList.toggle("is-app", view !== "landing");
    $("#landing").hidden = view !== "landing";
    $("#app").hidden = view === "landing";
    renderSaveState();
    if (view === "landing") {
      $("#resume-btn").hidden = !(db.mine && (db.mine.records.length || db.mine.noCourses || db.mine.plan));
      document.title = "學道 (학도) — 배움을 잇고, 졸업으로 향하는 길";
      requestAnimationFrame(() => window.HakdoRoad && window.HakdoRoad.redraw());
      return;
    }
    if (!cur()) { db.mode = "mine"; db.mine = db.mine || blank(); }
    const st = cur();
    if (view !== "register" && (!profileReady(st) || !recordsReady(st))) { go("register"); return; }
    if (view === "journey" && !st.plan) { go("setup"); return; }
    renderBanner();
    ({register: viewRegister, status: viewStatus, setup: viewSetup, journey: viewJourney})[view]();
    scrollTo(0, 0);
    const h = $("#content h1"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({preventScroll: true}); }
  }

  function renderBanner() {
    $("#banner").innerHTML = isSample()
      ? `<div class="banner sample"><div class="wrap"><span class="bdg">샘플</span><span><b>샘플 데이터로 보는 졸업 여정</b> — 가상의 학생 내역과 가상의 졸업 기준이에요.</span><button class="link-btn" type="button" data-act="start">내 내역으로 시작하기</button></div></div>`
      : `<div class="banner"><div class="wrap"><span class="bdg">샘플 기준</span><span>졸업 학점·과목·개설 학기는 <b>아직 검증되지 않은 가상 데이터</b>로 계산해요. 실제 학과의 공식 기준이 아니에요.</span></div></div>`;
  }

  /* ── 공통 조각 ── */
  const pageHead = (eyebrow, title, sub) => `<header class="page-head"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ""}</header>`;
  const seg = (name, options, value, label) => `
    <fieldset class="field"><legend>${label}</legend><div class="seg" role="radiogroup">
      ${options.map(([v, t]) => `<label class="seg-i"><input type="radio" name="${name}" value="${v}" ${String(value) === String(v) ? "checked" : ""}><span>${t}</span></label>`).join("")}
    </div><p class="f-err" id="err-${name}" role="alert"></p></fieldset>`;
  const badge = (kind, text) => `<span class="badge b-${kind}">${ICON[kind] || ""}${text}</span>`;
  const courseTags = c => [
    E.isRequired(c, cur().profile) ? `<em class="tag">필수</em>` : "",
    E.isCertPending(c, cur().profile) ? `<em class="tag soft">인증 시 필수</em>` : "",
    !c.offered ? `<em class="tag check">개설 확인 필요</em>` : ""
  ].join("");

  /* ════════════ 1. 이수 내역 등록 ════════════ */
  let regArea = "ALL", regQuery = "";
  function viewRegister() {
    const st = cur(), p = st.profile;
    const years = Array.from({length: 8}, (_, i) => 2019 + i);
    $("#content").innerHTML = `
    <div class="page">
      ${pageHead("이수 내역", "지금까지의 배움을 기록해요", "과목을 고르면 학점과 영역은 기준 데이터에서 자동으로 채워져요.")}
      <ol class="steps" aria-label="진행 단계"><li class="on">기본 정보</li><li class="on">이수 과목</li><li>나의 현재 위치</li><li>졸업 여정</li></ol>

      <section class="panel" aria-labelledby="h-prof">
        <h2 id="h-prof"><span class="num">一</span>기본 정보</h2>
        <div class="form-grid">
          <label class="field"><span class="lbl">학과</span>
            <select data-pf="dept">${["컴퓨터공학과", "그 외 학과"].map(d => `<option ${p.dept === d ? "selected" : ""}>${d}</option>`).join("")}</select></label>
          <label class="field"><span class="lbl">입학년도</span>
            <select data-pf="entryYear">${years.map(y => `<option value="${y}" ${Number(p.entryYear) === y ? "selected" : ""}>${y}년</option>`).join("")}</select></label>
          <div class="span2" id="support-msg" aria-live="polite"></div>
          ${seg("grade", [[1, "1학년"], [2, "2학년"], [3, "3학년"], [4, "4학년"], [5, "초과학기"]], p.grade, "현재 학년")}
          <fieldset class="field"><legend>기준 학기 <small>지금 다니는 학기</small></legend>
            <div class="row"><input class="yr" type="text" inputmode="numeric" maxlength="4" data-pf="year" value="${esc(p.year)}" aria-label="기준 연도 4자리"><span class="unit">년</span>
            <div class="seg" role="radiogroup">${[[1, "1학기"], [2, "2학기"]].map(([v, t]) => `<label class="seg-i"><input type="radio" name="sem" value="${v}" ${Number(p.sem) === v ? "checked" : ""}><span>${t}</span></label>`).join("")}</div></div>
            <p class="f-err" id="err-sem" role="alert"></p></fieldset>
          ${seg("cert", [["yes", "적용"], ["no", "미적용"], ["unknown", "모르겠어요"]], p.cert, "공학인증")}
        </div>
      </section>

      <div class="reg-grid" id="reg-courses">
        <section class="panel" aria-labelledby="h-course">
          <h2 id="h-course"><span class="num">二</span>들은 과목 고르기</h2>
          <div class="search">
            <input id="q" type="search" maxlength="100" placeholder="과목명 또는 코드로 검색" value="${esc(regQuery)}" aria-label="과목 검색 (최대 100자)" autocomplete="off">
          </div>
          <div class="chips" role="tablist" aria-label="영역으로 보기">
            ${[["ALL", "전체"], ...D.curriculum.areas.map(a => [a.id, a.name])].map(([id, n]) => `<button type="button" role="tab" class="chip-btn ${regArea === id ? "on" : ""}" aria-selected="${regArea === id}" data-act="area" data-area="${id}">${n}</button>`).join("")}
          </div>
          <div id="results" class="clist"></div>
          <details class="unk">
            <summary>목록에 없는 과목이 있나요?</summary>
            <div class="row"><input id="unk-name" type="text" maxlength="100" placeholder="과목명 (1~100자)" aria-label="목록에 없는 과목명"><button class="sbtn" type="button" data-act="add-unknown">보관하기</button></div>
            <p class="hint">학점 인정과 추천에서는 제외하고 ‘과목 확인 필요’로 표시해요.</p>
            <p class="f-err" id="err-unk" role="alert"></p>
          </details>
        </section>
        <aside class="panel sticky" id="registered" aria-labelledby="h-reg"></aside>
      </div>

      <div class="page-foot">
        <p class="f-err" id="err-reg" role="alert"></p>
        <button class="btn" type="button" data-act="to-status">나의 현재 위치 확인 ${arrow}</button>
      </div>
    </div>`;
    renderSupport(); renderResults(); renderRegistered();
  }

  function renderSupport() {
    const st = cur(), ok = E.isSupported(D, st.profile);
    $("#support-msg").innerHTML = ok ? "" : `
      <div class="notice">${ICON.warn}<div><b>현재 컴퓨터공학과 2023학번을 지원해요.</b><br>다른 학과·학번의 기준 자료는 준비 중이에요. 샘플로 흐름을 먼저 둘러볼 수 있어요.</div>
      <button class="sbtn" type="button" data-act="sample">샘플 체험하기</button></div>`;
    $("#reg-courses").classList.toggle("disabled", !ok);
    $("#reg-courses").inert = !ok;
  }

  function renderResults() {
    const st = cur(), taken = new Map(st.records.map(r => [r.code, r.status]));
    const list = regQuery.trim() ? E.searchCourses(D, regQuery, 60) : D.courses.filter(c => regArea === "ALL" || c.area === regArea);
    const el = $("#results");
    if (!list.length) { el.innerHTML = `<p class="empty">검색 결과가 없어요. 과목명이나 코드를 확인해 주세요.</p>`; return; }
    el.innerHTML = list.map(c => {
      const s = taken.get(c.code);
      return `<div class="crow ${s ? "is-taken" : ""}">
        <div class="crow-main"><b>${esc(c.name)}</b><span class="meta">${c.code} · ${AREA(c.area)} · ${c.credits}학점</span><span class="tags">${courseTags(c)}</span></div>
        <div class="crow-act">${s ? `<span class="state">${s === "done" ? "이수 완료" : "수강 중"}</span>` :
          `<button class="sbtn" type="button" data-act="add-rec" data-code="${c.code}" data-status="done" aria-label="${esc(c.name)} 이수 완료로 등록">이수 완료</button>
           <button class="sbtn ghost" type="button" data-act="add-rec" data-code="${c.code}" data-status="doing" aria-label="${esc(c.name)} 수강 중으로 등록">수강 중</button>`}</div>
      </div>`;
    }).join("");
  }

  function renderRegistered() {
    const st = cur();
    const done = st.records.filter(r => r.status === "done"), doing = st.records.filter(r => r.status === "doing");
    const group = (title, rs, other, otherLabel) => `
      <div class="rgroup"><h3>${title}<span>${rs.length}과목 · ${creditsOf(rs.map(r => r.code))}학점</span></h3>
      ${rs.length ? `<ul>${rs.map(r => `<li><span>${esc(C(r.code).name)} <small>${C(r.code).credits}</small></span>
        <span class="r-act"><button class="mini" type="button" data-act="set-status" data-code="${r.code}" data-status="${other}">${otherLabel}</button>
        <button class="mini x" type="button" data-act="del-rec" data-code="${r.code}" aria-label="${esc(C(r.code).name)} 삭제">삭제</button></span></li>`).join("")}</ul>` : `<p class="empty sm">아직 없어요</p>`}</div>`;
    $("#registered").innerHTML = `
      <h2 id="h-reg">선택한 과목</h2>
      ${group("이수 완료", done, "doing", "수강 중으로")}
      ${group("이번 학기 수강 중", doing, "done", "이수 완료로")}
      ${st.unknown.length ? `<div class="rgroup"><h3>과목 확인 필요<span>${st.unknown.length}개 · 학점 제외</span></h3><ul>${st.unknown.map((u, i) => `<li><span>${esc(u.name)} ${badge("check", "확인 필요")}</span><button class="mini x" type="button" data-act="del-unk" data-i="${i}">삭제</button></li>`).join("")}</ul></div>` : ""}
      ${st.records.length ? "" : `<label class="none-chk"><input type="checkbox" data-act-change="no-courses" ${st.noCourses ? "checked" : ""}> 이수 과목이 없어요 <small>(0학점으로 진행)</small></label>`}
      <p class="hint">${isSample() ? "샘플 체험 내역이에요. 내 내역과 섞이지 않아요." : "이 기기의 브라우저에 저장돼요."}</p>`;
  }

  function touchRecords() {
    const st = cur();
    if (st.plan) st.needsReview = true;
    persist(); renderResults(); renderRegistered();
  }

  /* ════════════ 2. 나의 현재 위치 ════════════ */
  let scen = "current";
  function viewStatus() {
    const st = cur();
    const hasDoing = st.records.some(r => r.status === "doing");
    if (!hasDoing) scen = "current";
    const s = E.computeStatus(D, st, scen);
    const cur0 = E.computeStatus(D, st, "current"), term = E.computeStatus(D, st, "term");
    const pct = v => Math.min(100, v / s.total.required * 100);
    $("#content").innerHTML = `
    <div class="page">
      ${pageHead("나의 현재 위치", "지금까지 쌓아온 배움", "입력 내역 기준 충족 현황이에요.")}
      <div class="seg big-seg" role="radiogroup" aria-label="계산 기준">
        <label class="seg-i"><input type="radio" name="scen" value="current" ${scen === "current" ? "checked" : ""}><span>현재 기준</span></label>
        <label class="seg-i ${hasDoing ? "" : "is-off"}"><input type="radio" name="scen" value="term" ${scen === "term" ? "checked" : ""} ${hasDoing ? "" : "disabled"}><span>이번 학기 이수 예상</span></label>
      </div>
      ${scen === "term" ? `<p class="exp-note">${badge("check", "예상")} 이번 학기에 수강 중인 과목을 모두 이수했다고 가정한 결과예요.</p>` : ""}

      <section class="panel stat3" aria-label="학점 요약">
        <div><span class="k">졸업 요구 학점</span><b>${s.total.required}</b><small>학점 · 샘플 기준</small></div>
        <div><span class="k">${scen === "term" ? "이번 학기까지 이수 예상" : "지금까지 이수"}</span><b>${s.total.earned}</b><small>학점</small></div>
        <div class="${s.total.short ? "is-short" : "is-ok"}"><span class="k">졸업까지 남은 학점</span><b>${s.total.short}</b><small>학점</small></div>
        <div class="gauge-wrap span3">
          <div class="gauge lg" role="img" aria-label="이수 ${cur0.total.earned}학점, 수강 중 포함 ${term.total.earned}학점, 요구 ${s.total.required}학점">
            <span class="done" style="width:${pct(cur0.total.earned)}%"></span><span class="plan" style="width:${Math.max(0, pct(term.total.earned) - pct(cur0.total.earned))}%"></span></div>
          <div class="legend"><span class="l1"><b></b>이수 완료 ${cur0.total.earned}</span>${hasDoing ? `<span class="l2"><b></b>이번 학기 수강 중 ${term.total.earned - cur0.total.earned}</span>` : ""}</div>
        </div>
      </section>

      <div class="two-col">
        <section class="panel" aria-labelledby="h-area">
          <h2 id="h-area">영역별 현황</h2>
          <ul class="areas">${s.areas.map(a => `
            <li class="${a.required === 0 ? "is-none" : a.met ? "is-ok" : "is-short"}">
              <div class="a-top"><span class="a-name">${a.name}</span><span class="a-num"><b>${a.earned}</b> / ${a.required ? a.required + "학점" : "요건 없음"}</span></div>
              ${a.required ? `<div class="abar"><span style="width:${Math.min(100, a.earned / a.required * 100)}%"></span></div>
              <div class="a-st">${a.met ? badge("ok", "입력 내역 기준 충족") : badge("short", `이 영역의 학점이 ${a.short}학점 더 필요해요`)}</div>` : `<p class="hint">남은 총학점을 채울 때 함께 인정돼요 (샘플 기준).</p>`}
            </li>`).join("")}</ul>
          <p class="hint">총 부족 학점(${s.total.short})과 영역별 부족 학점의 합(${s.areaShortSum})은 따로 계산해요. 영역 간 중복 인정은 기준 데이터를 따라요.</p>
        </section>

        <section class="panel" aria-labelledby="h-req">
          <h2 id="h-req">필수 과목</h2>
          <ul class="judge">
            <li class="${s.meetsTotal ? "is-ok" : "is-short"}">${s.meetsTotal ? badge("ok", "총학점 충족") : badge("short", `총학점 ${s.total.short}학점 부족`)}</li>
            <li class="${s.meetsRequired ? "is-ok" : "is-short"}">${s.meetsRequired ? badge("ok", "필수 과목 모두 이수") : badge("short", `필수 과목 ${s.missingRequired.length}개 남음`)}</li>
          </ul>
          <p class="hint">총학점 충족과 필수 과목 충족은 따로 판단해요.</p>
          ${s.missingRequired.length ? `<h3 class="h3">아직 듣지 않은 필수 과목</h3><ul class="plain">${s.missingRequired.map(c => `<li><button class="txt-btn" type="button" data-act="detail" data-code="${c.code}">${esc(c.name)}</button><span>${AREA(c.area)} · ${c.credits}학점</span></li>`).join("")}</ul>` : ""}
          ${s.certPending.length ? `<div class="notice soft">${ICON.check}<div><b>공학인증 판단 보류</b><br>적용 여부를 모르면 인증 필수 과목(${s.certPending.map(c => esc(c.name)).join(", ")})은 계산에 넣지 않아요. 이수 내역에서 공학인증을 선택하면 반영돼요.</div></div>` : ""}
          ${st.unknown.length ? `<div class="notice soft">${ICON.check}<div><b>과목 확인 필요</b><br>${st.unknown.map(u => esc(u.name)).join(", ")} — 목록에 없어 학점에 넣지 않았어요.</div></div>` : ""}
          ${st.noCourses && !st.records.length ? `<p class="hint">‘이수 과목이 없어요’를 선택해 0학점으로 계산했어요.</p>` : ""}
        </section>
      </div>

      <p class="foot-note">${ICON.check} 학점 외 졸업 요건은 별도 확인이 필요해요.</p>
      <div class="page-foot">
        <a class="btn-ghost lg" href="#/register">이수 내역 수정</a>
        <button class="btn" type="button" data-act="to-setup">앞으로의 여정 설계 ${arrow}</button>
      </div>
    </div>`;
  }

  /* ════════════ 3. 여정 설정 ════════════ */
  let draft = null;
  function defaultSettings(p) {
    const g = Math.min(Number(p.grade), 4);
    let t = {year: Number(p.year), sem: Number(p.sem)};
    let left = Number(p.grade) >= 5 ? 1 : (4 - g) * 2 + (2 - Number(p.sem));
    if (left < 1) left = 1;
    for (let i = 0; i < left; i++) t = E.nextTerm(t);
    return {target: t, desired: 18, excluded: []};
  }
  function viewSetup() {
    const st = cur(), p = st.profile;
    draft = clone(st.settings || defaultSettings(p));
    const start = E.nextTerm({year: Number(p.year), sem: Number(p.sem)});
    const years = Array.from({length: 7}, (_, i) => Number(p.year) + i);
    $("#content").innerHTML = `
    <div class="page narrow">
      ${pageHead("졸업 여정", "앞으로의 여정 설계", `${E.termLabel(start)}부터 졸업 목표 학기까지 계획해요.`)}
      <section class="panel">
        <div class="form-grid one">
          <fieldset class="field"><legend>목표 졸업 시점 <small>마지막으로 수강할 학기</small></legend>
            <div class="row">
              <select id="t-year" aria-label="목표 연도">${years.map(y => `<option value="${y}" ${draft.target.year === y ? "selected" : ""}>${y}년</option>`).join("")}</select>
              <select id="t-sem" aria-label="목표 학기">${[1, 2].map(s => `<option value="${s}" ${draft.target.sem === s ? "selected" : ""}>${s}학기</option>`).join("")}</select>
            </div><p class="f-err" id="err-target" role="alert"></p></fieldset>
          <label class="field"><span class="lbl">학기당 희망 학점</span>
            <div class="row"><input id="desired" class="num-in" type="text" inputmode="decimal" value="${esc(draft.desired)}" aria-describedby="cap-note"><span class="unit">학점</span></div>
            <p class="hint" id="cap-note">학기당 상한 ${D.curriculum.creditCap}학점 — 샘플 값이며 실제 규정은 확인되지 않았어요. 희망 학점은 꼭 채우는 값이 아니에요.</p>
            <p class="f-err" id="err-desired" role="alert"></p></label>
          <fieldset class="field"><legend>수강하지 않을 학기 <small>휴학 등</small></legend>
            <div id="ex-list" class="chips wrap"></div>
            <p class="hint">계절학기는 계획하지 않아요.</p>
            <p class="f-err" id="err-excluded" role="alert"></p></fieldset>
        </div>
      </section>
      <div class="page-foot">
        <a class="btn-ghost lg" href="#/status">나의 현재 위치</a>
        <button class="btn" type="button" data-act="recommend">나의 여정 추천받기 ${arrow}</button>
      </div>
    </div>`;
    renderExcluded();
  }
  function renderExcluded() {
    const p = cur().profile;
    const terms = E.cmpTerm(draft.target, E.nextTerm({year: Number(p.year), sem: Number(p.sem)})) < 0 ? [] : E.planTerms(p, {...draft, excluded: []});
    const ex = new Set(draft.excluded);
    $("#ex-list").innerHTML = terms.length ? terms.map(t => `<label class="chk-chip"><input type="checkbox" value="${t.key}" ${ex.has(t.key) ? "checked" : ""} data-act-change="exclude"><span>${E.termLabel(t)} <small>${t.grade}학년</small></span></label>`).join("") : `<p class="hint">목표 학기를 먼저 선택해 주세요.</p>`;
  }
  function readSetup() {
    draft.target = {year: Number($("#t-year").value), sem: Number($("#t-sem").value)};
    draft.desired = $("#desired").value.trim();
    const valid = new Set(E.planTerms(cur().profile, {...draft, excluded: []}).map(t => t.key));
    draft.excluded = draft.excluded.filter(k => valid.has(k));
  }

  /* ════════════ 4. 졸업 여정 ════════════ */
  let flash = null;    // {code, kind, msg}
  function viewJourney() {
    const st = cur(), plan = st.plan, p = st.profile;
    const conflicts = E.validatePlan(D, st, plan);
    const bad = new Map(conflicts.map(c => [c.code, c.errors]));
    const exp = E.computeStatus(D, st, "plan", plan);
    const doing = st.records.filter(r => r.status === "doing");
    const firstActive = plan.terms.findIndex(t => !t.excluded);
    const last = plan.terms[plan.terms.length - 1];
    const placed = new Set(plan.terms.flatMap(t => t.codes));
    const reqUnplaced = exp.missingRequired.filter(c => !placed.has(c.code));
    const termOpts = (code, sel) => plan.terms.map(t => `<option value="${t.key}" ${t.key === sel ? "selected" : ""} ${t.excluded ? "disabled" : ""}>${E.termLabel(t)}${t.excluded ? " (수강 안 함)" : ""}</option>`).join("");

    const card = (code, t) => {
      const c = C(code), errs = bad.get(code), why = plan.reasons[code];
      const f = flash && flash.code === code ? flash : null;
      return `<article class="ccard ${errs ? "bad" : ""}" data-code="${code}">
        <div class="cc-top"><button class="cc-name" type="button" data-act="detail" data-code="${code}">${esc(c.name)}</button><span class="cc-cr">${c.credits}<small>학점</small></span></div>
        <div class="cc-meta">${AREA(c.area)}${courseTags(c)}</div>
        <ul class="why">${(why || ["직접 추가한 과목"]).map(w => `<li>${esc(w)}</li>`).join("")}</ul>
        ${errs ? `<p class="cc-err">${ICON.warn}${errs.map(esc).join(" ")}</p>` : ""}
        <div class="cc-act">
          <label class="mv"><span>학기 이동</span><select data-act-change="move" data-code="${code}" data-from="${t.key}" aria-label="${esc(c.name)} 학기 이동">${termOpts(code, t.key)}</select></label>
          <button class="mini x" type="button" data-act="remove" data-code="${code}" aria-label="${esc(c.name)} 계획에서 빼기">빼기</button>
        </div>
        <p class="cc-msg ${f ? f.kind : ""}" role="status">${f ? f.msg : ""}</p>
      </article>`;
    };

    $("#content").innerHTML = `
    <div class="page wide">
      ${pageHead("졸업 여정", "졸업까지 이어지는 길", `${E.termLabel(plan.terms[0])} ~ ${E.termLabel(last)} · 학기당 희망 ${plan.settings.desired}학점`)}
      <p class="exp-line">${badge("check", "예상")} 계획한 과목을 모두 이수하면 <b>${exp.total.earned}</b> / ${exp.total.required}학점 · ${exp.total.short ? `<span class="t-short">${exp.total.short}학점 부족</span>` : `<span class="t-ok">총학점 충족</span>`}</p>
      ${st.needsReview ? `<div class="notice warn">${ICON.warn}<div><b>이수 내역이 바뀌었어요.</b><br>계획을 다시 검토해 주세요. 충돌한 과목은 빨간 표시로 보여드려요.</div><button class="sbtn" type="button" data-act="rerecommend">다시 추천</button></div>` : ""}
      <div class="journey">
        <div class="timeline" id="timeline">
          <canvas class="ink-line" aria-hidden="true"></canvas>
          <div class="t-node now"><span class="dot" aria-hidden="true"></span>
            <div><h2>지금 · ${E.termLabel({year: p.year, sem: p.sem})}</h2><p class="sub">${Number(p.grade) >= 5 ? "초과학기" : `${p.grade}학년 ${p.sem}학기`} · 수강 중 ${doing.length}과목 ${creditsOf(doing.map(r => r.code))}학점 (이수 예정)</p></div></div>
          ${plan.terms.map((t, i) => {
            const cr = creditsOf(t.codes);
            return `<section class="jterm ${t.excluded ? "off" : ""}" data-key="${t.key}" aria-labelledby="th-${t.key}">
              <span class="dot" aria-hidden="true"></span>
              <header class="term-head">
                <div><h2 id="th-${t.key}">${E.termLabel(t)}</h2><p class="sub">${t.grade}학년 ${t.sem}학기 · ${i === firstActive ? "다음 학기 · " : ""}예상 개설 기준</p></div>
                ${t.excluded ? "" : `<span class="cred ${cr > Number(plan.settings.desired) ? "over" : ""}"><b>${cr}</b> / 희망 ${plan.settings.desired}학점</span>`}
              </header>
              ${t.excluded ? `<p class="off-note">수강하지 않기로 한 학기예요.</p>` : `
                <div class="cards">${t.codes.map(code => card(code, t)).join("") || `<p class="empty">배치된 과목이 없어요.</p>`}</div>
                <button class="add-btn" type="button" data-act="open-add" data-key="${t.key}">+ 이 학기에 과목 추가</button>`}
            </section>`;
          }).join("")}
          <div class="t-node end"><span class="dot seal-dot" aria-hidden="true">道</span>
            <div><h2>졸업 목표 · ${E.termLabel(last)}</h2><p class="sub">${exp.meetsTotal && exp.meetsRequired && exp.meetsAreas ? "계획대로라면 입력 내역 기준 요건을 모두 채워요" : "아직 채우지 못한 요건이 있어요"}</p></div></div>
        </div>

        <aside class="summary" aria-labelledby="h-sum">
          <div class="panel">
            <p class="eyebrow">${badge("check", "예상")}</p>
            <h2 id="h-sum">계획한 과목을 모두 이수했을 때</h2>
            <div class="sum-big"><b>${exp.total.earned}</b><span>/ ${exp.total.required}학점</span></div>
            <ul class="judge">
              <li class="${exp.meetsTotal ? "is-ok" : "is-short"}">${exp.meetsTotal ? badge("ok", "총학점 충족") : badge("short", `총학점 ${exp.total.short}학점 부족`)}</li>
              <li class="${exp.meetsRequired ? "is-ok" : "is-short"}">${exp.meetsRequired ? badge("ok", "필수 과목 모두 배치") : badge("short", `필수 과목 ${exp.missingRequired.length}개 남음`)}</li>
            </ul>
            <ul class="mini-areas">${exp.areas.filter(a => a.required).map(a => `<li class="${a.met ? "is-ok" : "is-short"}"><span>${a.name}</span><span>${a.earned}/${a.required}${a.met ? ICON.ok : ` <em>−${a.short}</em>`}</span></li>`).join("")}</ul>
          </div>

          ${conflicts.length ? `<div class="panel tone-err"><h3>${ICON.warn}계획 조건 위반 ${conflicts.length}건</h3><ul class="plain">${conflicts.map(c => `<li><b>${esc(C(c.code).name)}</b><span>${c.errors.map(esc).join(" ")}</span></li>`).join("")}</ul></div>` : ""}

          ${reqUnplaced.length || plan.unplaced.length ? `<div class="panel tone-short"><h3>${ICON.short}배치하지 못한 필수 과목</h3><ul class="plain">${reqUnplaced.map(c => {
              const u = plan.unplaced.find(x => x.code === c.code);
              return `<li><button class="txt-btn" type="button" data-act="detail" data-code="${c.code}">${esc(c.name)}</button><span>${esc(u ? u.reason : "계획에서 뺀 필수 과목이에요.")}</span></li>`;
            }).join("")}</ul><p class="hint">목표 학기를 늦추거나 희망 학점을 조정해 보세요. <a href="#/setup">여정 설정 바꾸기</a></p></div>` : ""}

          ${!exp.meetsAreas || !exp.meetsTotal ? `<div class="panel tone-short"><h3>${ICON.short}더 필요한 학점</h3><ul class="plain">${exp.areas.filter(a => a.short).map(a => `<li><b>${a.name}</b><span>${a.short}학점 더 필요해요</span></li>`).join("")}${exp.total.short ? `<li><b>총학점</b><span>${exp.total.short}학점 더 필요해요</span></li>` : ""}</ul><p class="hint">과목을 추가하거나 목표 학기를 조정해 보세요.</p></div>` : ""}

          ${plan.checkNeeded.length || plan.certPending.length ? `<div class="panel tone-check"><h3>${ICON.check}확인 필요</h3><ul class="plain">
            ${plan.checkNeeded.map(code => `<li><button class="txt-btn" type="button" data-act="detail" data-code="${code}">${esc(C(code).name)}</button><span>개설 정보를 확인해 주세요. 자동으로 배치하지 않았어요.</span></li>`).join("")}
            ${plan.certPending.map(code => `<li><button class="txt-btn" type="button" data-act="detail" data-code="${code}">${esc(C(code).name)}</button><span>공학인증 적용 여부를 확인하면 필수 여부를 판단할 수 있어요.</span></li>`).join("")}
          </ul></div>` : ""}

          <div class="panel actions-panel">
            <button class="btn full" type="button" data-act="save-plan">계획 저장</button>
            <div class="row2"><button class="btn-ghost lg" type="button" data-act="rerecommend">다시 추천</button><a class="btn-ghost lg" href="#/setup">여정 설정</a></div>
            <p class="save-msg" id="save-msg" role="status">${saveFailed ? `<span class="t-err">저장하지 못했어요. 다시 시도해 주세요</span>` : st.planSavedAt ? `${isSample() ? "샘플 계획 · " : ""}${new Date(st.planSavedAt).toLocaleString("ko-KR", {month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"})}에 저장했어요` : "이 기기의 브라우저에 저장돼요."}</p>
          </div>
          <ul class="caveats">
            <li>좌석·시간표 충돌은 조회하지 않아요. ‘수강 조건 충족 후보’가 수강신청 성공을 뜻하지는 않아요.</li>
            <li>장기 계획은 예상 개설 기준이에요. 실제 개설 자료가 확인된 과목만 ‘개설 확인’으로 표시해요.</li>
            <li>학점 외 졸업 요건은 별도 확인이 필요해요.</li>
          </ul>
        </aside>
      </div>
    </div>`;
    flash = null;
    requestAnimationFrame(drawTimeline);
  }

  function drawTimeline() {
    const tl = $("#timeline"); if (!tl) return;
    const cv = $(".ink-line", tl), box = tl.getBoundingClientRect();
    const dots = $$(".dot", tl).map(d => { const r = d.getBoundingClientRect(); return {x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top}; });
    if (dots.length < 2) return;
    cv.style.height = tl.offsetHeight + "px";
    window.HakdoInkLine.draw(cv, dots[0].x, dots.map(d => d.y), {width: matchMedia("(max-width:767px)").matches ? 1.8 : 2.4});
  }
  let rzT; addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(drawTimeline, 150); });

  /* ── 과목 상세 패널 ── */
  let lastFocus = null;
  function openDrawer(html) {
    lastFocus = document.activeElement;
    const d = $("#drawer"), panel = $(".drawer-panel", d);
    panel.innerHTML = html;
    d.hidden = false;
    requestAnimationFrame(() => { d.classList.add("open"); (panel.querySelector("[autofocus]") || panel).focus(); });
  }
  function closeDrawer(silent) {
    const d = $("#drawer");
    if (d.hidden) return;
    d.classList.remove("open"); d.hidden = true;
    if (!silent && lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  function detailHtml(code) {
    const st = cur(), c = C(code), plan = st.plan;
    const rec = st.records.find(r => r.code === code);
    const at = plan ? plan.terms.find(t => t.codes.includes(code)) : null;
    const preState = p => {
      const r = st.records.find(x => x.code === p);
      if (r) return badge("ok", r.status === "done" ? "이수 완료" : "수강 중");
      const t = plan && plan.terms.find(x => x.codes.includes(p));
      return t ? badge("check", `${E.termLabel(t)} 계획`) : badge("short", "미이수");
    };
    const why = plan && plan.reasons[code];
    return `
      <div class="dr-head"><p class="eyebrow">${c.code} · ${AREA(c.area)}</p><h2 id="drawer-title">${esc(c.name)}</h2>
        <button class="close" type="button" data-act="close-drawer" aria-label="닫기" autofocus>×</button></div>
      <dl class="facts">
        <div><dt>학점</dt><dd>${c.credits}학점</dd></div>
        <div><dt>구분</dt><dd>${E.isRequired(c, st.profile) ? "필수" : E.isCertPending(c, st.profile) ? "공학인증 적용 시 필수 (판단 보류)" : "선택"}</dd></div>
        <div><dt>개설 학기</dt><dd>${c.offered ? `${c.offered.join("·")}학기 <small>(예상 개설 기준)</small>` : badge("check", "개설 정보를 확인해 주세요")}</dd></div>
        <div><dt>권장 학년</dt><dd>${c.recYear ? c.recYear + "학년" : "—"}${c.minYear ? ` · <b>${c.minYear}학년부터 수강 가능</b>` : ""}</dd></div>
        <div><dt>선수과목</dt><dd>${c.prereq.length ? `<ul class="pre">${c.prereq.map(p => `<li>${esc(C(p).name)} ${preState(p)}</li>`).join("")}</ul>` : "없음"}</dd></div>
        <div><dt>현재 상태</dt><dd>${rec ? (rec.status === "done" ? "이수 완료" : "이번 학기 수강 중") : at ? `${E.termLabel(at)}에 계획` : "계획에 없음"}</dd></div>
      </dl>
      ${why ? `<div class="dr-why"><h3>추천 이유</h3><ul class="why">${why.map(w => `<li>${esc(w)}</li>`).join("")}</ul></div>` : ""}
      ${plan && !rec ? `<div class="dr-move"><label class="field"><span class="lbl">${at ? "다른 학기로 이동" : "계획에 넣기"}</span>
        <select id="dr-term">${plan.terms.map(t => `<option value="${t.key}" ${at && at.key === t.key ? "selected" : ""} ${t.excluded ? "disabled" : ""}>${E.termLabel(t)} · ${t.grade}학년</option>`).join("")}</select></label>
        <button class="btn sm" type="button" data-act="dr-move" data-code="${code}" data-from="${at ? at.key : ""}">이 학기로 이동</button>
        <p class="f-err" id="dr-err" role="alert"></p></div>` : ""}
      <p class="source">자료 출처: ${esc(D.meta.source)} · 버전 ${D.meta.version} · 확인일 ${D.meta.verifiedAt || "없음(미검증)"}</p>`;
  }
  function addHtml(key) {
    const st = cur(), t = st.plan.terms.find(x => x.key === key);
    return `
      <div class="dr-head"><p class="eyebrow">${t.grade}학년 ${t.sem}학기</p><h2 id="drawer-title">${E.termLabel(t)}에 과목 추가</h2>
        <button class="close" type="button" data-act="close-drawer" aria-label="닫기">×</button></div>
      <input id="add-q" type="search" maxlength="100" placeholder="과목명 또는 코드" aria-label="추가할 과목 검색" autofocus>
      <p class="f-err" id="add-err" role="alert"></p>
      <div id="add-list" class="clist" data-key="${key}"></div>`;
  }
  function renderAddList(q) {
    const el = $("#add-list"); if (!el) return;
    const st = cur(), key = el.dataset.key, t = st.plan.terms.find(x => x.key === key);
    let list = E.addableCourses(D, st, st.plan);
    if (q && q.trim()) { const hit = new Set(E.searchCourses(D, q, 200).map(c => c.code)); list = list.filter(c => hit.has(c.code)); }
    el.innerHTML = list.length ? list.map(c => {
      const v = E.validateMove(D, st, st.plan, c.code, key);
      return `<div class="crow ${v.ok ? "" : "is-blocked"}">
        <div class="crow-main"><b>${esc(c.name)}</b><span class="meta">${AREA(c.area)} · ${c.credits}학점</span><span class="tags">${courseTags(c)}</span>
        ${v.ok ? (v.warnings.length ? `<span class="c-warn">${v.warnings.map(esc).join(" ")}</span>` : "") : `<span class="c-err">${v.errors.map(esc).join(" ")}</span>`}</div>
        <div class="crow-act"><button class="sbtn" type="button" data-act="add-to-term" data-code="${c.code}" ${v.ok ? "" : "disabled"}>추가</button></div></div>`;
    }).join("") : `<p class="empty">추가할 수 있는 과목이 없어요.</p>`;
  }

  /* ── 확인창 · 로딩 ── */
  function confirmBox(msg, okLabel = "확인") {
    return new Promise(res => {
      const m = $("#modal"); $("#modal-msg").textContent = msg;
      $('[data-modal="yes"]', m).textContent = okLabel;
      const prev = document.activeElement;
      m.hidden = false; $('[data-modal="no"]', m).focus();
      const done = v => { m.hidden = true; m.removeEventListener("click", on); document.removeEventListener("keydown", key); if (prev) prev.focus(); res(v); };
      const on = e => { const b = e.target.closest("[data-modal]"); if (b) done(b.dataset.modal === "yes"); };
      const key = e => { if (e.key === "Escape") done(false); };
      m.addEventListener("click", on); document.addEventListener("keydown", key);
    });
  }
  const loading = ms => new Promise(r => { const l = $("#loading"); l.hidden = false; setTimeout(() => { l.hidden = true; r(); }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms); });

  /* ── 계획 갱신 ── */
  function setPlan(plan, msg) {
    const st = cur();
    st.plan = plan;
    persist();
    flash = msg || null;
    const y = scrollY;
    viewJourney();
    scrollTo(0, y);
    if (msg) { const el = $(`.ccard[data-code="${msg.code}"] .cc-msg`); if (el) el.scrollIntoView({block: "nearest"}); }
  }
  async function doRecommend(fromSetup) {
    const st = cur();
    const settings = fromSetup ? clone(draft) : clone(st.settings || defaultSettings(st.profile));
    if (st.plan && st.plan.edited) {
      const ok = await confirmBox("직접 수정한 계획이 있어요. 새로 추천받으면 지금 계획을 덮어써요.", "덮어쓰고 추천받기");
      if (!ok) return;
    }
    await loading(650);
    st.settings = settings;
    st.plan = E.recommend(D, st, settings);
    st.needsReview = false;
    persist();
    go("journey");
  }

  /* ── 이벤트 ── */
  const actions = {
    start(el, e) {
      e.preventDefault();
      db.mode = "mine"; db.mine = db.mine || blank(); persist();
      go(profileReady(db.mine) && recordsReady(db.mine) ? (db.mine.plan ? "journey" : "status") : "register");
    },
    sample() {
      db.mode = "sample";
      db.sample = {...clone(D.sampleState), plan: null, planSavedAt: null, needsReview: false};
      persist(); go("status");
    },
    resume() { db.mode = "mine"; persist(); go(db.mine.plan ? "journey" : profileReady(db.mine) && recordsReady(db.mine) ? "status" : "register"); },
    area(el) { regArea = el.dataset.area; regQuery = ""; $("#q").value = ""; $$("[data-act=area]").forEach(b => { b.classList.toggle("on", b === el); b.setAttribute("aria-selected", b === el); }); renderResults(); },
    "add-rec"(el) {
      const r = E.addRecord(cur(), el.dataset.code, el.dataset.status);
      if (!r.ok) { $("#err-reg").textContent = r.error; return; }
      db[db.mode] = {...cur(), ...r.state};
      $("#err-reg").textContent = "";
      touchRecords();
    },
    "set-status"(el) { const r = cur().records.find(x => x.code === el.dataset.code); r.status = el.dataset.status; touchRecords(); },
    "del-rec"(el) { const st = cur(); st.records = st.records.filter(x => x.code !== el.dataset.code); touchRecords(); },
    "add-unknown"() {
      const v = $("#unk-name").value.trim(), err = $("#err-unk");
      if (v.length < 1 || v.length > 100) { err.textContent = "과목명을 1~100자로 입력해 주세요."; return; }
      if (cur().unknown.some(u => u.name === v)) { err.textContent = "이미 보관한 과목이에요."; return; }
      cur().unknown.push({name: v}); err.textContent = ""; $("#unk-name").value = ""; touchRecords();
    },
    "del-unk"(el) { cur().unknown.splice(Number(el.dataset.i), 1); touchRecords(); },
    "to-status"() {
      const st = cur(), p = st.profile;
      const set = (id, m) => { const el = $("#" + id); if (el) el.textContent = m; };
      ["err-grade", "err-sem", "err-cert", "err-reg"].forEach(id => set(id, ""));
      let bad = false;
      if (!E.isSupported(D, p)) { set("err-reg", "현재 컴퓨터공학과 2023학번을 지원해요."); bad = true; }
      if (!p.grade) { set("err-grade", "현재 학년을 선택해 주세요."); bad = true; }
      if (!/^\d{4}$/.test(String(p.year)) || !p.sem) { set("err-sem", "현재 학기를 선택해 주세요."); bad = true; }
      if (!p.cert) { set("err-cert", "공학인증 적용 여부를 선택해 주세요. 모르면 ‘모르겠어요’를 골라 주세요."); bad = true; }
      if (!bad && !recordsReady(st)) { set("err-reg", "들은 과목을 등록하거나 ‘이수 과목이 없어요’를 선택해 주세요."); bad = true; }
      if (bad) { const f = $(".f-err:not(:empty)"); if (f) f.scrollIntoView({block: "center", behavior: "smooth"}); return; }
      go("status");
    },
    "to-setup"() { go("setup"); },
    async recommend() {
      readSetup();
      const errs = E.validateSettings(D, cur().profile, draft);
      ["target", "desired", "excluded"].forEach(f => { $("#err-" + f).textContent = (errs.find(e => e.field === f) || {}).msg || ""; });
      if (errs.length) return;
      doRecommend(true);
    },
    rerecommend() { doRecommend(false); },
    remove(el) {
      const code = el.dataset.code, c = C(code);
      setPlan(E.removeCourse(cur().plan, code));
      if (E.isRequired(c, cur().profile)) { const m = $("#save-msg"); if (m) m.textContent = `${c.name}은(는) 필수 과목이라 ‘배치하지 못한 필수 과목’에 다시 표시돼요.`; }
    },
    detail(el) { openDrawer(detailHtml(el.dataset.code)); },
    "close-drawer"() { closeDrawer(); },
    "dr-move"(el) {
      const code = el.dataset.code, to = $("#dr-term").value, st = cur();
      const v = E.validateMove(D, st, st.plan, code, to, {fromKey: el.dataset.from || undefined});
      if (!v.ok) { $("#dr-err").textContent = v.errors.join(" "); return; }
      closeDrawer(true);
      if (location.hash !== "#/journey") { st.plan = E.moveCourse(st.plan, code, to); persist(); go("journey"); return; }
      setPlan(E.moveCourse(st.plan, code, to), {code, kind: v.warnings.length ? "warn" : "ok", msg: `${E.termLabel(st.plan.terms.find(t => t.key === to))}로 옮겼어요. ${v.warnings.join(" ")}`});
    },
    "open-add"(el) { openDrawer(addHtml(el.dataset.key)); renderAddList(""); },
    "add-to-term"(el) {
      const st = cur(), key = $("#add-list").dataset.key, code = el.dataset.code;
      const v = E.validateMove(D, st, st.plan, code, key);
      if (!v.ok) { $("#add-err").textContent = v.errors.join(" "); return; }
      closeDrawer(true);
      setPlan(E.moveCourse(st.plan, code, key), {code, kind: v.warnings.length ? "warn" : "ok", msg: `추가했어요. ${v.warnings.join(" ")}`});
    },
    "save-plan"() {
      const st = cur();
      st.planSavedAt = new Date().toISOString();
      if (!persist()) st.planSavedAt = null;
      const m = $("#save-msg");
      m.innerHTML = saveFailed ? `<span class="t-err">저장하지 못했어요. 다시 시도해 주세요</span>` : `저장했어요. 다음에 이 브라우저에서 이어서 수정할 수 있어요.`;
    },
    async wipe() {
      const ok = await confirmBox(isSample() ? "샘플 체험 내역을 지울까요? 내 내역은 그대로 남아요." : "이 기기의 브라우저에 저장된 내 이수 내역과 계획을 모두 지워요. 되돌릴 수 없어요.", "지우기");
      if (!ok) return;
      if (isSample()) db.sample = null; else db.mine = null;
      db.mode = "mine";
      persist();
      location.hash = "#/";
    }
  };

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.act];
    if (fn) fn(el, e);
  });

  document.addEventListener("change", e => {
    const t = e.target, st = cur();
    if (t.dataset.pf) {
      st.profile[t.dataset.pf] = t.dataset.pf === "entryYear" ? Number(t.value) : t.value;
      persist(); renderSupport(); return;
    }
    if (t.name === "grade" || t.name === "sem") { st.profile[t.name] = Number(t.value); $("#err-" + t.name).textContent = ""; if (st.plan) st.needsReview = true; persist(); return; }
    if (t.name === "cert") { st.profile.cert = t.value; $("#err-cert").textContent = ""; if (st.plan) st.needsReview = true; persist(); renderResults(); return; }
    if (t.name === "scen") { scen = t.value; viewStatus(); $(`input[name=scen][value=${scen}]`).focus(); return; }
    if (t.id === "t-year" || t.id === "t-sem") { readSetup(); renderExcluded(); $("#err-target").textContent = ""; return; }
    const act = t.dataset.actChange;
    if (act === "no-courses") { st.noCourses = t.checked; persist(); return; }
    if (act === "exclude") { readSetup(); draft.excluded = $$("#ex-list input:checked").map(i => i.value); $("#err-excluded").textContent = ""; return; }
    if (act === "move") {
      const code = t.dataset.code, from = t.dataset.from, to = t.value;
      const v = E.validateMove(D, st, st.plan, code, to, {fromKey: from});
      const msg = $(`.ccard[data-code="${code}"] .cc-msg`);
      if (!v.ok) { t.value = from; msg.className = "cc-msg err"; msg.innerHTML = `${ICON.warn}이동하지 않았어요 — ${v.errors.map(esc).join(" ")}`; return; }
      setPlan(E.moveCourse(st.plan, code, to), {code, kind: v.warnings.length ? "warn" : "ok", msg: `${E.termLabel(st.plan.terms.find(x => x.key === to))}로 옮겼어요. ${v.warnings.join(" ")}`});
    }
  });

  document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "q") { regQuery = t.value.slice(0, 100); renderResults(); }
    if (t.id === "add-q") renderAddList(t.value);
    if (t.dataset && t.dataset.pf === "year") {
      t.value = t.value.replace(/\D/g, "").slice(0, 4);
      cur().profile.year = t.value; persist();
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$("#drawer").hidden) closeDrawer();
    if (e.key === "Enter" && e.target.id === "unk-name") actions["add-unknown"]();
    // 패널 안에서 Tab 순환
    if (e.key === "Tab" && !$("#drawer").hidden) {
      const f = $$(".drawer-panel button, .drawer-panel select, .drawer-panel input", $("#drawer")).filter(x => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  render();
})();
