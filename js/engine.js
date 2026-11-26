/* ─────────────────────────────────────────────────────────────
   學道 — 계산·추천 엔진 (화면과 분리된 순수 함수)

   - computeStatus : 시나리오별(현재 / 이번 학기 이수 예상 / 계획 완료 예상) 충족 현황
   - planTerms     : 다음 학기부터 목표 학기까지의 학기 목록
   - recommend     : 조건 기반 학기별 배치 (생성형 AI 없음, 같은 입력 → 같은 결과)
   - validateMove  : 과목 이동·추가 시 선수과목·개설 학기·학년 제한·학점 상한·중복 검사
   - validatePlan  : 계획 전체 재검사 (이수 내역이 바뀐 뒤 등)

   state = {
     profile: {dept, entryYear, grade(1~4, 5=초과학기), year, sem(1|2), cert("yes"|"no"|"unknown")},
     records: [{code, status: "done"|"doing"}],
     unknown: [{name}]           // 목록에 없는 과목 — 학점·추천에서 제외
   }
   ───────────────────────────────────────────────────────────── */
(function (root) {
  "use strict";

  /* ── 기본 도구 ── */
  const termKey = t => `${t.year}-${t.sem}`;
  const nextTerm = t => (t.sem === 1 ? {year: t.year, sem: 2} : {year: t.year + 1, sem: 1});
  const cmpTerm = (a, b) => a.year - b.year || a.sem - b.sem;
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const index = data => data._idx || (data._idx = new Map(data.courses.map(c => [c.code, c])));
  const course = (data, code) => index(data).get(code);
  const areaName = (data, id) => (data.curriculum.areas.find(a => a.id === id) || {name: id}).name;
  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, "");

  const isRequired = (c, profile) => c.required || (c.cert && profile.cert === "yes");
  const isCertPending = (c, profile) => c.cert && !c.required && profile.cert === "unknown";

  const doneSet = state => new Set(state.records.filter(r => r.status === "done").map(r => r.code));
  const doingSet = state => new Set(state.records.filter(r => r.status === "doing").map(r => r.code));
  const takenSet = state => new Set(state.records.map(r => r.code));

  /* ── 지원 범위 ── */
  function isSupported(data, profile) {
    return data.supported.some(s => s.dept === profile.dept && s.entryYear === Number(profile.entryYear));
  }

  /* ── 과목 검색 (이름·코드) ── */
  function searchCourses(data, q, limit = 30) {
    const n = norm(q).slice(0, 100);
    if (!n) return [];
    return data.courses.filter(c => norm(c.name).includes(n) || norm(c.code).includes(n)).slice(0, limit);
  }

  /* ── 이수 내역 등록 (중복 차단) ── */
  function addRecord(state, code, status) {
    if (state.records.some(r => r.code === code)) return {ok: false, error: "이미 등록한 과목이에요."};
    return {ok: true, state: {...state, records: [...state.records, {code, status}], noCourses: false}};
  }

  /* ── 시나리오별 충족 현황 ──
     scenario: "current" = 이수 완료만, "term" = + 수강 중, "plan" = + 계획 과목 */
  function computeStatus(data, state, scenario = "current", plan = null) {
    const counted = new Set(doneSet(state));
    if (scenario !== "current") doingSet(state).forEach(c => counted.add(c));
    if (scenario === "plan" && plan) plan.terms.forEach(t => t.codes.forEach(c => counted.add(c)));

    const list = [...counted].map(c => course(data, c)).filter(Boolean);   // 중복 없이, 목록에 있는 과목만
    const byArea = {};
    list.forEach(c => { byArea[c.area] = (byArea[c.area] || 0) + c.credits; });

    const areas = data.curriculum.areas.map(a => {
      const earned = byArea[a.id] || 0;
      return {id: a.id, name: a.name, required: a.required, earned, short: Math.max(a.required - earned, 0), met: earned >= a.required};
    });
    const earned = sum(list, c => c.credits);
    const totalRequired = data.curriculum.totalCredits;
    const missingRequired = data.courses.filter(c => isRequired(c, state.profile) && !counted.has(c.code));
    const certPending = data.courses.filter(c => isCertPending(c, state.profile) && !counted.has(c.code));

    return {
      scenario,
      total: {required: totalRequired, earned, short: Math.max(totalRequired - earned, 0)},
      areas,
      areaShortSum: sum(areas, a => a.short),
      missingRequired,
      certPending,
      unknown: state.unknown || [],
      meetsTotal: earned >= totalRequired,
      meetsRequired: missingRequired.length === 0,
      meetsAreas: areas.every(a => a.met)
    };
  }

  /* ── 계획 학기 목록 ── 기준 학기의 다음 학기 ~ 목표 학기 */
  function planTerms(profile, settings) {
    const out = [];
    const excluded = new Set(settings.excluded || []);
    const g0 = Math.min(Number(profile.grade) || 1, 4);
    let idx = (g0 - 1) * 2 + (Number(profile.sem) - 1);                // 지금 몇 번째 학기인지 (0부터)
    const over = Number(profile.grade) >= 5;
    let t = nextTerm({year: Number(profile.year), sem: Number(profile.sem)});
    const target = settings.target;
    let guard = 0;
    while (cmpTerm(t, target) <= 0 && guard++ < 20) {
      const key = termKey(t), ex = excluded.has(key);
      if (!ex) idx++;
      const grade = over ? 4 : Math.min(4, Math.floor(idx / 2) + 1);
      out.push({key, year: t.year, sem: t.sem, grade, excluded: ex, codes: []});
      t = nextTerm(t);
    }
    return out;
  }

  /* ── 설정 검증 ── */
  function validateSettings(data, profile, settings) {
    const errors = [];
    const start = nextTerm({year: Number(profile.year), sem: Number(profile.sem)});
    if (!settings.target || cmpTerm(settings.target, start) < 0) errors.push({field: "target", msg: "목표 학기를 다시 선택해 주세요."});
    const d = String(settings.desired ?? "").trim();
    if (!/^\d+(\.\d)?$/.test(d) || Number(d) <= 0) errors.push({field: "desired", msg: "희망 학점은 양의 숫자로 입력해 주세요. (소수 첫째 자리까지)"});
    else if (Number(d) > data.curriculum.creditCap) errors.push({field: "desired", msg: `학기당 상한 ${data.curriculum.creditCap}학점(샘플 기준)을 넘어요.`});
    if (!errors.some(e => e.field === "target")) {
      const terms = planTerms(profile, settings);
      if (terms.length && terms.every(t => t.excluded)) errors.push({field: "excluded", msg: "수강할 학기를 하나 이상 남겨 주세요."});
    }
    return errors;
  }

  /* ── 학기별 계획 추천 ── */
  function recommend(data, state, settings) {
    const profile = state.profile;
    const terms = planTerms(profile, settings);
    const cap = Math.min(Number(settings.desired), data.curriculum.creditCap);
    const taken = takenSet(state);                                       // 이수 완료 + 수강 중(이수 예정 전제)
    const base = computeStatus(data, state, "term");
    const areaShort = Object.fromEntries(base.areas.map(a => [a.id, a.short]));
    let totalShort = base.total.short;

    const reqRem = new Set(data.courses.filter(c => isRequired(c, profile) && !taken.has(c.code)).map(c => c.code));
    const placedAt = new Map();
    const reasons = {};

    // 남은 과목 중 이 과목을 선수로 요구하는 과목
    const dependents = code => data.courses.filter(d => d.prereq.includes(code) && !taken.has(d.code));

    const reqCreditsByArea = () => {
      const m = {};
      reqRem.forEach(code => { if (!placedAt.has(code)) { const c = course(data, code); m[c.area] = (m[c.area] || 0) + c.credits; } });
      return m;
    };
    const needInfo = () => {
      const rq = reqCreditsByArea();
      const reqTotal = sum(Object.values(rq), x => x);
      const after = {};
      let areaRest = 0;
      data.curriculum.areas.forEach(a => { after[a.id] = (areaShort[a.id] || 0) - (rq[a.id] || 0); areaRest += Math.max(after[a.id], 0); });
      return {after, extra: totalShort - reqTotal - areaRest};
    };
    const prereqOk = (c, ti) => c.prereq.every(p => taken.has(p) || (placedAt.has(p) && placedAt.get(p) < ti));

    terms.forEach((t, ti) => {
      if (t.excluded) return;
      let credits = 0;
      for (;;) {
        const need = needInfo();
        const cands = data.courses.filter(c => {
          if (taken.has(c.code) || placedAt.has(c.code)) return false;
          if (!c.offered || !c.offered.includes(t.sem)) return false;         // 개설 정보 미확인 과목은 자동 배치하지 않음
          if (c.minYear && t.grade < c.minYear) return false;
          if (credits + c.credits > cap) return false;
          if (!prereqOk(c, ti)) return false;
          if (isCertPending(c, profile)) return false;                       // 인증 여부 모름 → 판단 보류
          return reqRem.has(c.code) || need.after[c.area] > 0 || need.extra > 0;
        });
        if (!cands.length) break;
        const score = c => {
          const deps = dependents(c.code);
          return [
            reqRem.has(c.code) ? 1 : 0,                                          // 1. 필수 미이수
            deps.filter(d => reqRem.has(d.code)).length,                         // 2. 필수 후속 과목의 선수과목
            c.offered.length === 1 ? 1 : 0,                                      // 3. 개설 시기 제한
            need.after[c.area] > 0 ? 1 : 0,                                      // 4. 부족 영역 충족
            deps.length,
            c.recYear && c.recYear <= t.grade ? 1 : 0                            // 권장 학년 도달
          ];
        };
        cands.sort((a, b) => {
          const sa = score(a), sb = score(b);
          for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i] - sa[i];
          return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;                  // 같은 조건 → 과목 코드 순
        });
        const c = cands[0];
        // 추천 이유 (데이터 근거)
        const why = [];
        if (reqRem.has(c.code)) why.push(c.cert ? "공학인증 필수(적용 기준)" : `${areaName(data, c.area)} 미이수`);
        const deps = dependents(c.code);
        if (deps.length) why.push(`후속 과목 ${deps.slice(0, 2).map(d => d.name).join("·")}${deps.length > 2 ? " 외" : ""}의 선수과목`);
        if (c.offered.length === 1) why.push(`${c.offered[0]}학기에만 개설(예상)`);
        if (!reqRem.has(c.code) && need.after[c.area] > 0) why.push(`부족한 ${areaName(data, c.area)} 영역 충족`);
        if (!why.length) why.push("남은 총 학점 충족");
        reasons[c.code] = why;

        t.codes.push(c.code);
        placedAt.set(c.code, ti);
        credits += c.credits;
        areaShort[c.area] = (areaShort[c.area] || 0) - c.credits;
        totalShort -= c.credits;
      }
    });

    // 배치하지 못한 필수 과목과 이유
    const maxGrade = Math.max(0, ...terms.filter(t => !t.excluded).map(t => t.grade));
    const diagnose = c => {
      if (!c.offered) return "개설 학기 정보를 확인할 수 없어요.";
      if (!terms.some(t => !t.excluded && c.offered.includes(t.sem))) return `목표 기간 안에 ${c.offered.join("·")}학기가 없어요.`;
      if (c.minYear && maxGrade < c.minYear) return `${c.minYear}학년부터 수강할 수 있어요.`;
      const miss = c.prereq.filter(p => !taken.has(p) && !placedAt.has(p));
      if (miss.length) return `선수과목 ${miss.map(p => course(data, p).name).join("·")}을(를) 먼저 배치할 수 없어요.`;
      const late = c.prereq.filter(p => placedAt.has(p));
      if (late.length) return `선수과목 이후에 남은 ${c.offered.join("·")}학기가 없어요.`;
      return "학기당 희망 학점 안에 자리가 없어요.";
    };
    const unplaced = [...reqRem].filter(code => !placedAt.has(code)).map(code => ({code, reason: diagnose(course(data, code))}));
    const shortfalls = data.curriculum.areas.filter(a => areaShort[a.id] > 0).map(a => ({area: a.id, name: a.name, short: areaShort[a.id]}));
    const checkNeeded = data.courses.filter(c => !taken.has(c.code) && !placedAt.has(c.code) && !c.offered && (reqRem.has(c.code) || (base.areas.find(a => a.id === c.area) || {}).short > 0)).map(c => c.code);
    const certPending = data.courses.filter(c => isCertPending(c, profile) && !taken.has(c.code)).map(c => c.code);

    return {
      terms, reasons, unplaced, shortfalls, checkNeeded, certPending,
      totalShortLeft: Math.max(totalShort, 0),
      settings: JSON.parse(JSON.stringify(settings)),
      edited: false
    };
  }

  /* ── 이동·추가 검증 ── */
  function validateMove(data, state, plan, code, toKey, opts = {}) {
    const errors = [], warnings = [];
    const c = course(data, code);
    if (!c) return {ok: false, errors: ["목록에 없는 과목이에요."], warnings};
    const ti = plan.terms.findIndex(t => t.key === toKey);
    const t = plan.terms[ti];
    if (!t) return {ok: false, errors: ["계획 기간에 없는 학기예요."], warnings};
    if (t.excluded) errors.push("수강하지 않기로 한 학기예요.");

    const taken = takenSet(state);
    if (taken.has(code)) errors.push(doneSet(state).has(code) ? "이미 이수한 과목이에요." : "이번 학기에 수강 중인 과목이에요.");
    const elsewhere = plan.terms.find(x => x.key !== opts.fromKey && x.codes.includes(code));
    if (elsewhere && elsewhere.key !== toKey) errors.push("이미 다른 학기에 배치된 과목이에요.");
    if (elsewhere && elsewhere.key === toKey && opts.fromKey !== toKey) errors.push("이미 이 학기에 있는 과목이에요.");

    if (!c.offered) warnings.push("개설 정보를 확인해 주세요.");
    else if (!c.offered.includes(t.sem)) errors.push(`${c.offered.join("·")}학기에만 개설돼요(예상 개설 기준).`);
    if (c.minYear && t.grade < c.minYear) errors.push(`${c.minYear}학년부터 수강할 수 있어요.`);

    const posOf = x => plan.terms.findIndex(tt => tt.codes.includes(x) && x !== code);
    c.prereq.forEach(p => {
      if (taken.has(p)) return;
      const pi = posOf(p);
      if (pi < 0 || pi >= ti) errors.push(`선수과목 ${course(data, p).name}을(를) 먼저 이수해야 해요.`);
    });
    plan.terms.forEach((tt, i) => tt.codes.forEach(d => {
      if (d === code || i > ti) return;
      const dc = course(data, d);
      if (dc && dc.prereq.includes(code)) errors.push(`후속 과목 ${dc.name}보다 앞 학기에 있어야 해요.`);
    }));

    const termCredits = sum(t.codes.filter(x => x !== code).map(x => course(data, x)).filter(Boolean), x => x.credits) + c.credits;
    if (termCredits > data.curriculum.creditCap) errors.push(`학기당 상한 ${data.curriculum.creditCap}학점(샘플 기준)을 넘어요.`);
    else if (termCredits > Number(plan.settings.desired)) warnings.push(`희망 학점 ${plan.settings.desired}학점을 넘어요.`);
    if (isCertPending(c, state.profile)) warnings.push("공학인증 적용 여부를 모르면 이 과목의 인증 요건은 판단을 보류해요.");

    return {ok: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)]};
  }

  const clonePlan = plan => ({...plan, terms: plan.terms.map(t => ({...t, codes: [...t.codes]})), reasons: {...plan.reasons}});

  function moveCourse(plan, code, toKey) {
    const p = clonePlan(plan);
    p.terms.forEach(t => { t.codes = t.codes.filter(c => c !== code); });
    p.terms.find(t => t.key === toKey).codes.push(code);
    p.edited = true;
    return p;
  }
  function removeCourse(plan, code) {
    const p = clonePlan(plan);
    p.terms.forEach(t => { t.codes = t.codes.filter(c => c !== code); });
    p.edited = true;
    return p;
  }

  /* ── 계획 전체 재검사 ── */
  function validatePlan(data, state, plan) {
    const conflicts = [];
    plan.terms.forEach(t => t.codes.forEach(code => {
      const v = validateMove(data, state, plan, code, t.key, {fromKey: t.key});
      if (!v.ok) conflicts.push({code, term: t.key, errors: v.errors});
    }));
    return conflicts;
  }

  /* 계획에 넣을 수 있는 후보 (이수·수강 중·배치 과목 제외) */
  function addableCourses(data, state, plan) {
    const taken = takenSet(state);
    const placed = new Set(plan.terms.flatMap(t => t.codes));
    return data.courses.filter(c => !taken.has(c.code) && !placed.has(c.code));
  }

  const termLabel = t => `${t.year}년 ${t.sem}학기`;
  const gradeLabel = t => `${t.grade}학년 ${t.sem}학기`;

  const api = {
    termKey, nextTerm, cmpTerm, termLabel, gradeLabel, course, areaName, isRequired, isCertPending, isSupported,
    searchCourses, addRecord, computeStatus, planTerms, validateSettings, recommend,
    validateMove, moveCourse, removeCourse, validatePlan, addableCourses
  };
  root.HakdoEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
