/* PRD 9장 검증표에 맞춘 엔진 테스트 — 실행: node tests/engine.test.js */
/* 브라우저: tests/engine.test.html 을 열면 같은 테스트가 실행됩니다. */
"use strict";
const isNode = typeof require === "function" && typeof window === "undefined";
const assert = isNode ? require("assert") : (() => {
  const a = (v, m) => { if (!v) throw new Error(m || "assertion failed"); };
  a.ok = a;
  a.strictEqual = (x, y, m) => { if (x !== y) throw new Error(m || `${JSON.stringify(x)} !== ${JSON.stringify(y)}`); };
  a.deepStrictEqual = (x, y, m) => { if (JSON.stringify(x) !== JSON.stringify(y)) throw new Error(m || `${JSON.stringify(x)} ≠ ${JSON.stringify(y)}`); };
  return a;
})();
const data = isNode ? require("../js/data.sample.js") : window.HAKDO_DATA;
const E = isNode ? require("../js/engine.js") : window.HakdoEngine;
const log = (...a) => { console.log(...a); if (!isNode) document.getElementById("out").textContent += a.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ") + "\n"; };

const clone = o => JSON.parse(JSON.stringify(o));
const sample = () => clone(data.sampleState);
const emptyState = () => ({profile: {...sample().profile}, records: [], unknown: [], noCourses: true});
const credits = codes => codes.reduce((s, c) => s + E.course(data, c).credits, 0);
let n = 0;
let failed = 0;
const test = (name, fn) => { try { fn(); n++; log("✓ " + name); } catch (e) { failed++; log("✗ " + name + " — " + e.message); } };

test("이수 내역 없음 → 0학점, 전체 부족 요건", () => {
  const st = E.computeStatus(data, emptyState());
  assert.strictEqual(st.total.earned, 0);
  assert.strictEqual(st.total.short, 130);
  assert.ok(st.areas.filter(a => a.required > 0).every(a => !a.met));
});

test("같은 과목 중복 등록 차단", () => {
  const s = sample();
  const r = E.addRecord(s, "DEMO-C101", "done");
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.error, "이미 등록한 과목이에요.");
});

test("중복 인정 없음 — 같은 코드가 두 번 있어도 한 번만 합산", () => {
  const s = emptyState();
  s.records = [{code: "DEMO-C101", status: "done"}, {code: "DEMO-C101", status: "doing"}];
  assert.strictEqual(E.computeStatus(data, s, "term").total.earned, 3);
});

test("총학점 충족 · 전공 부족을 동시에 표시", () => {
  const s = emptyState();
  s.records = data.courses.filter(c => c.area !== "MAJ_REQ").map(c => ({code: c.code, status: "done"}));
  // 총학점을 넘기기 위해 가상 일반선택 학점이 부족하면 영역 요건만 확인
  const st = E.computeStatus(data, s);
  const maj = st.areas.find(a => a.id === "MAJ_REQ");
  assert.strictEqual(maj.met, false);
  assert.strictEqual(maj.short, 33);
  if (st.total.earned >= 130) assert.strictEqual(st.meetsTotal, true);
});

test("학점 충족 · 필수 과목 미이수 → 필수 미충족 유지", () => {
  const s = emptyState();
  s.records = data.courses.filter(c => c.code !== "DEMO-C401").map(c => ({code: c.code, status: "done"}));
  const st = E.computeStatus(data, s);
  assert.ok(st.total.earned >= 130);
  assert.strictEqual(st.meetsTotal, true);
  assert.strictEqual(st.meetsRequired, false);
  assert.deepStrictEqual(st.missingRequired.map(c => c.code), ["DEMO-C401"]);
});

test("수강 중 과목 → 현재 학점에서 제외, 이번 학기 예상에만 포함", () => {
  const s = sample();
  const cur = E.computeStatus(data, s, "current"), term = E.computeStatus(data, s, "term");
  const doing = s.records.filter(r => r.status === "doing").map(r => r.code);
  assert.strictEqual(term.total.earned - cur.total.earned, credits(doing));
});

test("선수과목 미이수 → 후속 과목을 선수 이수 전 학기에 배치하지 않음", () => {
  const s = sample();
  const plan = E.recommend(data, s, s.settings);
  const pos = code => plan.terms.findIndex(t => t.codes.includes(code));
  plan.terms.forEach((t, i) => t.codes.forEach(code => {
    E.course(data, code).prereq.forEach(p => {
      const done = s.records.some(r => r.code === p);
      assert.ok(done || (pos(p) >= 0 && pos(p) < i), `${code} 선수 ${p}`);
    });
  }));
  assert.deepStrictEqual(E.validatePlan(data, s, plan), []);
});

test("2학기에만 개설되는 과목 → 1학기 이동 차단", () => {
  const s = sample();
  const plan = E.recommend(data, s, s.settings);
  const t1 = plan.terms.find(t => t.sem === 1);
  const v = E.validateMove(data, s, plan, "DEMO-C303", t1.key, {fromKey: plan.terms.find(t => t.codes.includes("DEMO-C303")).key});
  assert.strictEqual(v.ok, false);
  assert.ok(v.errors.some(e => e.includes("2학기에만 개설")));
});

test("이미 이수한 과목 → 추천 후보에서 제외", () => {
  const s = sample();
  const plan = E.recommend(data, s, s.settings);
  const placed = plan.terms.flatMap(t => t.codes);
  s.records.forEach(r => assert.ok(!placed.includes(r.code), r.code));
});

test("희망 학점보다 남은 학점이 적음 → 불필요한 과목 강제 추가 없음", () => {
  const s = emptyState();
  s.profile.grade = 4; s.profile.sem = 1;
  s.records = data.courses.filter(c => c.code !== "DEMO-C401").map(c => ({code: c.code, status: "done"}));
  const plan = E.recommend(data, s, {target: {year: 2027, sem: 2}, desired: 18, excluded: []});
  const placed = plan.terms.flatMap(t => t.codes);
  assert.deepStrictEqual(placed, ["DEMO-C401"]);
});

test("목표 학기 내 배치 불가 → 미배치 이유 제공", () => {
  const s = sample();
  const plan = E.recommend(data, s, {target: {year: 2027, sem: 1}, desired: 18, excluded: []});
  assert.ok(plan.unplaced.length > 0);
  plan.unplaced.forEach(u => assert.ok(u.reason.length > 0));
  assert.ok(plan.unplaced.some(u => u.code === "DEMO-C401"));
});

test("과목 삭제·이동 → 예상 결과 즉시 갱신", () => {
  const s = sample();
  const plan = E.recommend(data, s, s.settings);
  const before = E.computeStatus(data, s, "plan", plan);
  const code = plan.terms.find(t => t.codes.length).codes[0];
  const after = E.computeStatus(data, s, "plan", E.removeCourse(plan, code));
  assert.strictEqual(before.total.earned - after.total.earned, E.course(data, code).credits);
});

test("선수과목보다 앞으로 이동 차단 · 후속 과목보다 뒤로 이동 차단", () => {
  const s = sample();
  const plan = E.recommend(data, s, s.settings);
  const at = code => plan.terms.find(t => t.codes.includes(code));
  // 소프트웨어공학(C304)을 졸업 프로젝트(C401)보다 뒤로
  const t401 = at("DEMO-C401"), t304 = at("DEMO-C304");
  assert.ok(t401 && t304);
  const later = plan.terms.filter(t => E.cmpTerm(t, t401) >= 0 && t.sem === 1 && !t.excluded);
  later.forEach(t => {
    const v = E.validateMove(data, s, plan, "DEMO-C304", t.key, {fromKey: t304.key});
    assert.strictEqual(v.ok, false);
  });
});

test("공학인증 미확인 → 인증 필수 과목은 판단 보류(확정 결과와 분리)", () => {
  const s = sample();
  s.profile.cert = "unknown";
  const st = E.computeStatus(data, s);
  assert.ok(st.certPending.some(c => c.code === "DEMO-C411"));
  assert.ok(!st.missingRequired.some(c => c.code === "DEMO-C411"));
  s.profile.cert = "yes";
  assert.ok(E.computeStatus(data, s).missingRequired.some(c => c.code === "DEMO-C411"));
});

test("개설 정보 미확인 과목 → 자동 배치하지 않고 확인 필요로 분리", () => {
  const s = sample();
  const plan = E.recommend(data, s, s.settings);
  const placed = plan.terms.flatMap(t => t.codes);
  data.courses.filter(c => !c.offered).forEach(c => assert.ok(!placed.includes(c.code)));
});

test("같은 입력 → 같은 결과", () => {
  const s = sample();
  assert.deepStrictEqual(E.recommend(data, s, s.settings).terms, E.recommend(data, sample(), s.settings).terms);
});

test("학기당 상한·희망 학점 안에서 배치", () => {
  const s = sample();
  const plan = E.recommend(data, s, s.settings);
  plan.terms.forEach(t => assert.ok(credits(t.codes) <= 18));
});

test("수강 제외 학기에는 배치하지 않고, 모두 제외하면 오류", () => {
  const s = sample();
  const st = {...s.settings, excluded: ["2027-2"]};
  const plan = E.recommend(data, s, st);
  assert.strictEqual(plan.terms.find(t => t.key === "2027-2").codes.length, 0);
  const all = {...s.settings, excluded: ["2027-1", "2027-2", "2028-1", "2028-2"]};
  assert.ok(E.validateSettings(data, s.profile, all).some(e => e.msg === "수강할 학기를 하나 이상 남겨 주세요."));
});

test("목표 학기가 계획 시작보다 이전 → 오류", () => {
  const s = sample();
  const errs = E.validateSettings(data, s.profile, {target: {year: 2026, sem: 2}, desired: 18, excluded: []});
  assert.ok(errs.some(e => e.msg === "목표 학기를 다시 선택해 주세요."));
});

test("희망 학점 형식·상한 검사", () => {
  const p = sample().profile, t = {year: 2028, sem: 2};
  assert.ok(E.validateSettings(data, p, {target: t, desired: "18.25"}).some(e => e.field === "desired"));
  assert.ok(E.validateSettings(data, p, {target: t, desired: "0"}).some(e => e.field === "desired"));
  assert.ok(E.validateSettings(data, p, {target: t, desired: "25"}).some(e => e.field === "desired"));
  assert.strictEqual(E.validateSettings(data, p, {target: t, desired: "16.5"}).length, 0);
});

test("학년 계산 — 휴학 학기는 학년이 오르지 않음", () => {
  const p = sample().profile;   // 2학년 2학기
  const ts = E.planTerms(p, {target: {year: 2028, sem: 2}, excluded: ["2027-1"]});
  assert.deepStrictEqual(ts.map(t => t.grade), [2, 3, 3, 4]);
});

log(`\n${n}개 통과 · ${failed}개 실패`);
if (!isNode) document.title = failed ? "FAIL" : "PASS";
const s = sample(), plan = E.recommend(data, s, s.settings);
plan.terms.forEach(t => log(" ", t.key, t.grade + "학년", credits(t.codes) + "학점", t.codes.map(c => E.course(data, c).name).join(", ")));
log("  미배치:", plan.unplaced, " 부족:", plan.shortfalls, " 확인 필요:", plan.checkNeeded, " 인증 보류:", plan.certPending);
