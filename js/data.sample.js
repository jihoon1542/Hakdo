/* ─────────────────────────────────────────────────────────────
   學道 — 샘플 기준 데이터 (DEMO)

   ⚠ 이 파일의 졸업 학점·영역 요건·과목·선수과목·개설 학기·학기 상한은
     모두 화면 시연을 위한 "가상 데이터"입니다.
     명지대학교 컴퓨터공학과의 실제 교육과정이 아니며, 공식 판정에 쓰면 안 됩니다.
     학교 기준이 확보되면 이 파일만 같은 구조로 교체하세요.

   구조
   - meta        : 출처·버전·확인일 (확인일 null = 미검증)
   - curriculum  : 총 요구 학점, 영역별 요구 학점, 학기당 상한
   - courses     : 과목 목록
       code       과목 코드 (DEMO- 접두어 = 가상 과목)
       area       영역 id
       required   필수 여부
       cert       공학인증 적용 시에만 필수
       prereq     선수과목 코드 목록
       recYear    권장 학년 (제한 아님)
       minYear    수강 제한 학년 (null = 제한 없음)
       offered    개설 학기 [1], [2], [1,2] / null = 개설 정보 미확인
   ───────────────────────────────────────────────────────────── */
(function (root) {
  "use strict";
  const C = (code, name, credits, area, o = {}) => ({
    code, name, credits, area,
    required: !!o.req, cert: !!o.cert,
    prereq: o.pre || [], recYear: o.y || null, minYear: o.min || null,
    offered: o.off === undefined ? [1, 2] : o.off
  });

  const data = {
    meta: {
      id: "DEMO-MJU-NAT-CSE-2023",
      school: "명지대학교 자연캠퍼스",
      dept: "컴퓨터공학과",
      entryYear: 2023,
      sample: true,
      version: "demo-1",
      source: "학도 시연용 가상 데이터 (실제 교육과정 아님)",
      verifiedAt: null
    },
    supported: [{dept: "컴퓨터공학과", entryYear: 2023}],
    curriculum: {
      totalCredits: 130,      // 샘플 값
      creditCap: 19,          // 샘플 학기당 상한 — 실제 규정 미확인
      areas: [
        {id: "GE_REQ", name: "교양필수", required: 13},
        {id: "GE_SEL", name: "교양선택", required: 12},
        {id: "MSC",    name: "전공기초(수학·과학)", required: 18},
        {id: "MAJ_REQ", name: "전공필수", required: 33},
        {id: "MAJ_SEL", name: "전공선택", required: 30},
        {id: "FREE",   name: "일반선택", required: 0}
      ]
    },
    courses: [
      // 교양필수
      C("DEMO-G101", "대학글쓰기", 2, "GE_REQ", {req: 1, y: 1}),
      C("DEMO-G102", "영어 1", 2, "GE_REQ", {req: 1, y: 1, off: [1]}),
      C("DEMO-G103", "영어 2", 2, "GE_REQ", {req: 1, y: 1, off: [2], pre: ["DEMO-G102"]}),
      C("DEMO-G104", "진로와 자기설계", 1, "GE_REQ", {req: 1, y: 1}),
      C("DEMO-G105", "사고와 토론", 2, "GE_REQ", {req: 1, y: 2}),
      C("DEMO-G106", "디지털 리터러시", 2, "GE_REQ", {req: 1, y: 1}),
      C("DEMO-G107", "공동체와 윤리", 2, "GE_REQ", {req: 1, y: 2}),
      // 교양선택
      C("DEMO-G201", "철학과 삶", 3, "GE_SEL"),
      C("DEMO-G202", "한국사의 이해", 3, "GE_SEL"),
      C("DEMO-G203", "경제학의 이해", 3, "GE_SEL"),
      C("DEMO-G204", "심리학 입문", 3, "GE_SEL"),
      C("DEMO-G205", "미술과 사회", 3, "GE_SEL", {off: [2]}),
      C("DEMO-G206", "과학기술과 사회", 3, "GE_SEL", {off: [1]}),
      C("DEMO-G207", "글로벌 문화 탐구", 3, "GE_SEL", {off: null}),
      C("DEMO-G208", "문학과 영화", 3, "GE_SEL"),
      C("DEMO-G209", "음악의 이해", 3, "GE_SEL"),
      // 전공기초(수학·과학)
      C("DEMO-M101", "미적분학 1", 3, "MSC", {req: 1, y: 1, off: [1]}),
      C("DEMO-M102", "미적분학 2", 3, "MSC", {req: 1, y: 1, off: [2], pre: ["DEMO-M101"]}),
      C("DEMO-M103", "선형대수", 3, "MSC", {req: 1, y: 2}),
      C("DEMO-M104", "확률과 통계", 3, "MSC", {req: 1, y: 2, off: [1]}),
      C("DEMO-M105", "일반물리", 3, "MSC", {y: 1}),
      C("DEMO-M106", "이산수학", 3, "MSC", {req: 1, y: 1, off: [2]}),
      C("DEMO-M107", "수치해석", 3, "MSC", {y: 3, off: [2], pre: ["DEMO-M102"]}),
      // 전공필수
      C("DEMO-C101", "프로그래밍 기초", 3, "MAJ_REQ", {req: 1, y: 1, off: [1]}),
      C("DEMO-C102", "객체지향 프로그래밍", 3, "MAJ_REQ", {req: 1, y: 1, off: [2], pre: ["DEMO-C101"]}),
      C("DEMO-C201", "자료구조", 3, "MAJ_REQ", {req: 1, y: 2, off: [1], pre: ["DEMO-C102"]}),
      C("DEMO-C202", "컴퓨터구조", 3, "MAJ_REQ", {req: 1, y: 2, off: [1]}),
      C("DEMO-C203", "알고리즘", 3, "MAJ_REQ", {req: 1, y: 2, off: [2], pre: ["DEMO-C201"]}),
      C("DEMO-C204", "시스템 프로그래밍", 3, "MAJ_REQ", {req: 1, y: 2, off: [2], pre: ["DEMO-C102"]}),
      C("DEMO-C301", "운영체제", 3, "MAJ_REQ", {req: 1, y: 3, off: [1], pre: ["DEMO-C201", "DEMO-C204"]}),
      C("DEMO-C302", "데이터베이스", 3, "MAJ_REQ", {req: 1, y: 3, off: [1], pre: ["DEMO-C201"]}),
      C("DEMO-C303", "컴퓨터네트워크", 3, "MAJ_REQ", {req: 1, y: 3, off: [2], pre: ["DEMO-C201"]}),
      C("DEMO-C304", "소프트웨어공학", 3, "MAJ_REQ", {req: 1, y: 3, off: [1]}),
      C("DEMO-C401", "졸업 프로젝트", 3, "MAJ_REQ", {req: 1, y: 4, min: 4, off: [2], pre: ["DEMO-C304"]}),
      // 전공선택
      C("DEMO-C211", "웹 프로그래밍", 3, "MAJ_SEL", {y: 2, pre: ["DEMO-C101"]}),
      C("DEMO-C212", "리눅스 활용", 3, "MAJ_SEL", {y: 2, off: [1]}),
      C("DEMO-C311", "인공지능", 3, "MAJ_SEL", {y: 3, off: [1], pre: ["DEMO-C203", "DEMO-M103"]}),
      C("DEMO-C312", "기계학습", 3, "MAJ_SEL", {y: 3, off: [2], pre: ["DEMO-C311"]}),
      C("DEMO-C313", "컴퓨터그래픽스", 3, "MAJ_SEL", {y: 3, off: [2], pre: ["DEMO-M103", "DEMO-C201"]}),
      C("DEMO-C314", "모바일 프로그래밍", 3, "MAJ_SEL", {y: 3, off: [1], pre: ["DEMO-C102"]}),
      C("DEMO-C316", "컴파일러", 3, "MAJ_SEL", {y: 3, off: null, pre: ["DEMO-C203"]}),
      C("DEMO-C320", "인간-컴퓨터 상호작용", 3, "MAJ_SEL", {y: 3}),
      C("DEMO-C321", "소프트웨어 테스팅", 3, "MAJ_SEL", {y: 3, off: [2], pre: ["DEMO-C304"]}),
      C("DEMO-C322", "임베디드 시스템", 3, "MAJ_SEL", {y: 3, off: [1], pre: ["DEMO-C202"]}),
      C("DEMO-C315", "정보보안", 3, "MAJ_SEL", {y: 4, off: [1], pre: ["DEMO-C303"]}),
      C("DEMO-C317", "클라우드 컴퓨팅", 3, "MAJ_SEL", {y: 4, off: [2], pre: ["DEMO-C303"]}),
      C("DEMO-C318", "딥러닝", 3, "MAJ_SEL", {y: 4, off: [1], pre: ["DEMO-C312"]}),
      C("DEMO-C319", "데이터마이닝", 3, "MAJ_SEL", {y: 4, off: [2], pre: ["DEMO-C302"]}),
      C("DEMO-C411", "캡스톤디자인 1", 3, "MAJ_SEL", {y: 4, min: 4, off: [1], cert: 1}),
      C("DEMO-C412", "캡스톤디자인 2", 3, "MAJ_SEL", {y: 4, min: 4, off: [2], cert: 1, pre: ["DEMO-C411"]}),
      // 일반선택
      C("DEMO-F101", "창업과 혁신", 2, "FREE"),
      C("DEMO-F102", "현장실습", 3, "FREE", {off: null}),
      C("DEMO-F103", "리더십과 소통", 2, "FREE"),
      C("DEMO-F104", "외국어 회화", 2, "FREE")
    ]
  };

  /* 샘플 체험용 학생 상태 — 2023학번, 2026년 2학기 현재 2학년 2학기라고 가정 */
  data.sampleState = {
    profile: {dept: "컴퓨터공학과", entryYear: 2023, grade: 2, year: 2026, sem: 2, cert: "unknown"},
    records: [
      // 1학년 1학기
      ...["DEMO-G101", "DEMO-G102", "DEMO-G104", "DEMO-M101", "DEMO-M105", "DEMO-C101", "DEMO-G201"].map(code => ({code, status: "done"})),
      // 1학년 2학기
      ...["DEMO-G103", "DEMO-G106", "DEMO-M102", "DEMO-M106", "DEMO-C102", "DEMO-G202"].map(code => ({code, status: "done"})),
      // 2학년 1학기
      ...["DEMO-C201", "DEMO-C202", "DEMO-M103", "DEMO-M104", "DEMO-C211", "DEMO-C212"].map(code => ({code, status: "done"})),
      // 2학년 2학기 (수강 중)
      ...["DEMO-C203", "DEMO-C204", "DEMO-G105", "DEMO-G107", "DEMO-G203"].map(code => ({code, status: "doing"}))
    ],
    unknown: [],
    noCourses: false,
    settings: {target: {year: 2028, sem: 2}, desired: 18, excluded: []}
  };

  root.HAKDO_DATA = data;
  if (typeof module !== "undefined" && module.exports) module.exports = data;
})(typeof window !== "undefined" ? window : globalThis);
