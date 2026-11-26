/* 學道 — 시작 화면의 붓길(一筆)과 수묵 산수 렌더러 */
(() => {
  /* ─────────────────────────────────────────────
     수묵 길 렌더러 (canvas)
     - 원근: 위(먼 산)는 좁고 흐리게 → 아래로 올수록 넓고 짙게
     - 빛: 왼쪽 위에서. 그늘진 쪽 둑은 짙은 농묵 + 길 위로 그림자
     - 길 바깥 땅은 담묵, 길 바닥은 밝게 비워 오목한 입체감
     ───────────────────────────────────────────── */
  const road = document.getElementById("road");
  const DPR = Math.min(window.devicePixelRatio || 1, 1.75), TILE = 1100;
  

  const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const noise = seed => { const r = rng(seed), v = Array.from({length: 1024}, r);
    return x => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return v[i & 1023] * (1 - s) + v[(i + 1) & 1023] * s; }; };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

  /* ── 그리기 명령 기록 → 타일별 재생 ── */
  let ops = [];
  const dab = (img, x, y, w, h, rot, a) => { if (a < 0.004 || w < 0.3) return; const R = Math.max(w, h) * 0.6; ops.push({t: 0, img, x, y, w, h, rot, a, y0: y - R, y1: y + R}); };
  const fn = (y0, y1, f) => ops.push({t: 1, f, y0, y1});
  function play(g, o) {
    if (o.t === 2) { g.drawImage(o.img, o.x, o.y, o.w, o.h); return; }
    if (o.t === 0) { g.save(); g.globalAlpha = o.a; g.translate(o.x, o.y); if (o.rot) g.rotate(o.rot); g.drawImage(o.img, -o.w / 2, -o.h / 2, o.w, o.h); g.restore(); }
    else { g.save(); o.f(g); g.restore(); }
  }

  /* ── 경유점: 블럭 사이를 비켜 지나가는 큰 S자 ── */
  function waypoints(W) {
    const mobile = W < 768, pts = [];
    const top = el => el.getBoundingClientRect().top + scrollY;
    const hero = document.querySelector('[data-way="hero"]');
    const heroTxt = hero.querySelector("[data-block]").getBoundingClientRect();
    const hx = mobile ? W * 0.8 : Math.max(heroTxt.right + 90, W * 0.66);
    const hb = top(hero) + hero.offsetHeight;
    pts.push({x: hx + W * 0.035, y: 92});
    pts.push({x: hx - W * 0.005, y: hb * 0.42});
    let prev = {x: hx - W * 0.04, y: hb * 0.8};
    pts.push(prev);
    document.querySelectorAll('[data-way="step"]').forEach(sec => {
      const card = sec.querySelector(".card").getBoundingClientRect();
      const right = sec.classList.contains("r");
      const x = mobile ? (right ? W * 0.12 : W * 0.88) : right ? card.left * 0.5 : card.right + (W - card.right) * 0.5;
      const y = top(sec) + sec.offsetHeight / 2;
      pts.push({x: (prev.x + x) / 2 + (right ? W * 0.008 : -W * 0.008), y: (prev.y + y) / 2});
      pts.push(prev = {x, y, node: true});
    });
    const end = document.querySelector('[data-way="end"]'), eTop = top(end);
    const seal = end.querySelector(".seal").getBoundingClientRect().top + scrollY;
    pts.push({x: (prev.x + W * 0.5) / 2 + W * 0.02, y: (prev.y + eTop) / 2 + 60});
    pts.push({x: W * 0.5, y: seal - 16, end: true});
    return pts;
  }

  function sample(pts) {
    const raw = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(16, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y)));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        raw.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    raw.push({x: pts.at(-1).x, y: pts.at(-1).y});
    // 1.5px 간격으로 균일하게 재표본
    const out = [raw[0]]; let acc = 0, STEP = 1.5;
    for (let i = 1; i < raw.length; i++) {
      let a = out.at(-1), b = raw[i], d = Math.hypot(b.x - a.x, b.y - a.y);
      while (acc + d >= STEP) { const t = (STEP - acc) / d; a = {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t}; out.push(a); d = Math.hypot(b.x - a.x, b.y - a.y); acc = 0; }
      acc += d;
    }
    out.forEach((p, i) => {
      p.s = i * STEP;
      const a = out[Math.max(0, i - 4)], b = out[Math.min(out.length - 1, i + 4)];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      p.nx = -dy / d; p.ny = dx / d; p.ang = Math.atan2(dy, dx);
    });
    // 곡률 → 붓이 느려지는 곳(굽이)은 굵고 젖게, 빠른 직선은 가늘고 마르게
    const K = 14, raw2 = out.map((p, i) => {
      const a = out[Math.max(0, i - K)], b = out[Math.min(out.length - 1, i + K)];
      let da = b.ang - a.ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      return Math.abs(da) / Math.max(1, b.s - a.s);
    });
    const R = 60; let sum = 0; const pre = raw2.map(v => sum += v);
    out.forEach((p, i) => { const a = Math.max(0, i - R), b = Math.min(out.length - 1, i + R);
      p.k = clamp(((pre[b] - (a ? pre[a - 1] : 0)) / (b - a + 1)) * 230); });
    return out;
  }

  let samples = [], H = 0, current = 0, target = 0, raf = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INK = "#0a0a0a";

  function build(W) {
    ops = [];
    const mobile = W < 768;
    const pts = waypoints(W);
    samples = sample(pts);
    const S = samples, L = S.length, total = S.at(-1).s;
    const r = rng(7), nW = noise(11), nI = noise(23), nE1 = noise(31), nE2 = noise(37);

    /* 굵기: 기필(起筆)에서 눌렀다가, 굽이에서 무겁게, 수필(收筆)에서 뾰족하게 */
    const base = mobile ? 6.5 : 11.5;
    const startP = s => 0.55 + 0.75 * smooth(0, 26, s) - 0.3 * smooth(26, 120, s);
    const endP = s => (1 + 0.35 * smooth(total - 420, total - 170, s)) * (1 - 0.68 * smooth(total - 150, total, s));
    const HW = S.map(p => base * (0.4 + 1.0 * p.k) * (0.74 + 0.52 * nW(p.s / 300)) * startP(p.s) * endP(p.s));

    /* 먹: 굽이(느림)는 흠뻑, 굽이 사이 빠른 사선은 비백, 끝으로 갈수록 마름 */
    const INKV = S.map(p => {
      const fast = 1 - p.k;
      const dry = 0.5 * Math.pow(fast, 1.7) * (0.5 + 0.5 * nI(p.s / 520));
      const fade = 0.3 * smooth(total - 300, total, p.s);
      return clamp(Math.max(0.5, 1.08 - dry - 0.06 * nI(p.s / 90 + 40)) - fade);
    });
    INKV.forEach((v, i) => { if (S[i].s < 160) INKV[i] = Math.max(v, 1 - S[i].s / 900); });

    /* 붓털 */
    const N = mobile ? 28 : 44;
    const brs = Array.from({length: N}, (_, b) => {
      const u = ((b + 0.5) / N) * 2 - 1;
      return {u: u + (r() - 0.5) * 1.2 / N, n: noise(100 + b * 7), w: noise(400 + b * 5),
        f: 70 + r() * 190, off: r() * 800, s0: r() * 10 + Math.abs(u) * 14,
        s1: total - (Math.pow(Math.abs(u), 1.6) * 34 + r() * 10)};
    });

    const gaps = Array.from({length: mobile ? 8 : 14}, (_, j) => {
      const u = (r() * 2 - 1) * 0.9;
      return {u, au: Math.abs(u), n: noise(900 + j * 11), f: 60 + r() * 160, off: r() * 900, w: 0.5 + r() * 0.8, a: 0.35 + r() * 0.35};
    });

    // 청크 단위로 기록해 타일마다 필요한 부분만 그림
    const CH = 120;
    for (let c0 = 0; c0 < L - 1; c0 += CH) {
      const c1 = Math.min(L - 1, c0 + CH + 2);
      let y0 = 1e9, y1 = -1e9;
      for (let i = c0; i <= c1; i++) { y0 = Math.min(y0, S[i].y - HW[i] * 1.4); y1 = Math.max(y1, S[i].y + HW[i] * 1.4); }
      fn(y0 - 3, y1 + 3, g => {
        g.fillStyle = g.strokeStyle = INK; g.lineCap = "round"; g.lineJoin = "round";
        // 1) 먹이 충분한 몸통 — 가장자리는 미세하게 떨리는 붓 자국
        const A = [], B = [];
        for (let i = c0; i <= c1; i++) {
          const p = S[i], c = smooth(0.42, 0.86, INKV[i]);
          if (c <= 0.01) { A.push(null); B.push(null); continue; }
          const ha = HW[i] * c * (0.95 + 0.1 * nE1(p.s / 24 + 600)) + (nE1(p.s / 2.2) - 0.5) * 0.7 + (nE1(p.s / 60 + 300) - 0.5) * 1.4;
          const hb = HW[i] * c * (0.95 + 0.1 * nE2(p.s / 24 + 600)) + (nE2(p.s / 2.2) - 0.5) * 0.7 + (nE2(p.s / 60 + 300) - 0.5) * 1.4;
          A.push([p.x + p.nx * ha, p.y + p.ny * ha]); B.push([p.x - p.nx * hb, p.y - p.ny * hb]);
        }
        let i = 0;
        while (i < A.length) {
          if (!A[i]) { i++; continue; }
          let j = i; while (j + 1 < A.length && A[j + 1]) j++;
          if (j > i) { g.beginPath(); g.moveTo(A[i][0], A[i][1]);
            for (let k = i + 1; k <= j; k++) g.lineTo(A[k][0], A[k][1]);
            for (let k = j; k >= i; k--) g.lineTo(B[k][0], B[k][1]);
            g.closePath(); g.fill(); }
          i = j + 1;
        }
        // 2) 붓털 가닥 — 먹이 마를수록 가장자리부터 끊겨 비백이 생김
        for (const b of brs) {
          const au = Math.abs(b.u);
          let on = false, seg = 0, lw = 0;
          g.beginPath();
          for (let k = c0; k <= c1; k++) {
            const p = S[k];
            const ink = INKV[k];
            const vis = p.s >= b.s0 && p.s <= b.s1 && b.n(p.s / b.f + b.off) < ink * 1.32 - 0.34 * Math.pow(au, 1.8);
            if (!vis) { if (on) { g.lineWidth = lw; g.stroke(); g.beginPath(); } on = false; continue; }
            const spread = 0.97 + 0.16 * (1 - ink);               // 마른 붓은 살짝 벌어짐
            const o = b.u * HW[k] * spread + (b.w(p.s / 9) - 0.5) * 0.35;
            const x = p.x + p.nx * o, y = p.y + p.ny * o;
            if (!on) { g.moveTo(x, y); on = true; seg = 0; lw = Math.max(0.6, (HW[k] * 2 / N) * 2.1); }
            else g.lineTo(x, y);
            if (++seg > 10) { g.lineWidth = lw; g.stroke(); g.beginPath(); g.moveTo(x, y); seg = 0; lw = Math.max(0.6, (HW[k] * 2 / N) * 2.1); }
          }
          if (on) { g.lineWidth = lw; g.stroke(); }
        }
        // 3) 젖은 획 속에도 남는 가는 붓털 결(흰 실금) — 바깥 가닥일수록, 마를수록 많이
        g.globalCompositeOperation = "destination-out";
        for (const q of gaps) {
          let on = false; g.beginPath();
          for (let k = c0; k <= c1; k++) {
            const p = S[k], ink = INKV[k];
            const vis = q.n(p.s / q.f + q.off) > 0.8 + 0.22 * ink - 0.3 * q.au;
            if (!vis) { on = false; continue; }
            const o = q.u * HW[k], x = p.x + p.nx * o, y = p.y + p.ny * o;
            if (on) g.lineTo(x, y); else { g.moveTo(x, y); on = true; }
          }
          g.globalAlpha = q.a; g.lineWidth = q.w; g.stroke();
        }
        g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
      });
    }

    /* 기필의 먹 머금은 머리 */
    const p0 = S[0], h0 = HW[Math.min(L - 1, 14)];
    fn(p0.y - 40, p0.y + 40, g => {
      g.fillStyle = INK; g.beginPath();
      g.ellipse(p0.x + Math.cos(p0.ang) * h0 * 0.5, p0.y + Math.sin(p0.ang) * h0 * 0.5, h0 * 0.95, h0 * 0.78, p0.ang + 0.5, 0, 7); g.fill();
    });

    /* 비묵(飛墨) — 굽이 바깥쪽과 기필 근처에만 몇 점 */
    for (let k = 0; k < L; k += 3) {
      const p = S[k];
      const chance = p.s < 90 ? 0.04 : 0;
      if (r() > chance) continue;
      const side = r() < 0.5 ? -1 : 1, d = HW[k] * (1.25 + r() * 1.6);
      const x = p.x + p.nx * side * d + Math.cos(p.ang) * (r() - 0.5) * 10, y = p.y + p.ny * side * d + Math.sin(p.ang) * (r() - 0.5) * 10;
      const rad = 0.6 + Math.pow(r(), 2) * 2.4, rot = p.ang;
      fn(y - 6, y + 6, g => { g.fillStyle = INK; g.beginPath(); g.ellipse(x, y, rad * 1.5, rad, rot, 0, 7); g.fill(); });
    }
  }

  /* ─────────────────────────────────────────────
     산수(山水) — 섹션마다 여백에 먼 산·대나무·난초·바위
     오프스크린에 한 번 그려 한 장으로 배치
     ───────────────────────────────────────────── */
  const ink = a => `rgba(10,10,10,${Math.min(1, Math.max(0, a))})`;
  function paint(x, y, w, h, draw, {l = 0, r = 0, b = 0, t = 0} = {}) {
    w = Math.ceil(w); h = Math.ceil(h);
    if (w < 8 || h < 8) return;
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR);
    const g = c.getContext("2d"); g.scale(DPR, DPR); g.lineCap = "round"; g.lineJoin = "round";
    draw(g, w, h);
    g.globalCompositeOperation = "destination-in";
    if (l || r) { const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, l ? "rgba(0,0,0,0)" : "#000"); gr.addColorStop(Math.max(0.001, l), "#000");
      gr.addColorStop(Math.min(0.999, 1 - r), "#000"); gr.addColorStop(1, r ? "rgba(0,0,0,0)" : "#000");
      g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    if (t || b) { const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, t ? "rgba(0,0,0,0)" : "#000"); gr.addColorStop(Math.max(0.001, t), "#000");
      gr.addColorStop(Math.min(0.999, 1 - b), "#000"); gr.addColorStop(1, b ? "rgba(0,0,0,0)" : "#000");
      g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    ops.unshift({t: 2, img: c, x, y, w, h, y0: y, y1: y + h});
  }

  /* 산: 둥근 봉우리가 겹겹이. 능선에서 짙고 아래로 금세 안개에 묻힘 */
  function mountains(g, w, h, {layers, seed}) {
    const r = rng(seed);
    layers.forEach((L, li) => {
      const n1 = noise(seed * 7 + li * 13), n2 = noise(seed * 7 + li * 13 + 5), n3 = noise(seed * 7 + li * 13 + 9);
      const sc = document.createElement("canvas"); sc.width = 1; sc.height = 128;
      const sg = sc.getContext("2d"), gr = sg.createLinearGradient(0, 0, 0, 128);
      gr.addColorStop(0, ink(L.alpha)); gr.addColorStop(0.08, ink(L.alpha * 0.8)); gr.addColorStop(0.4, ink(L.alpha * 0.3)); gr.addColorStop(1, ink(0));
      sg.fillStyle = gr; sg.fillRect(0, 0, 1, 128);
      const R = [];
      for (let x = 0; x <= w; x += 2) {
        let v = 0;
        L.peaks.forEach(([c, ph, pw], k) => { let d = (x / w - c) / pw; d *= (d < 0) === (k % 2 === 0) ? 0.8 : 1.3;
          d = clamp(d, -1, 1); v = Math.max(v, ph * Math.pow((1 + Math.cos(Math.PI * d)) / 2, 1.1)); });
        const rid = q => 1 - Math.abs(2 * q - 1);
        const f = 0.45 * rid(n1(x / 110)) + 0.35 * rid(n2(x / 38)) + 0.2 * n3(x / 9);
        v *= 0.6 + 0.62 * f;
        R.push([x, h * L.base - h * v]);
      }
      const fade = h * (L.fade || 0.3);
      R.forEach(([x, y]) => { g.globalAlpha = smooth(0, h * 0.12, h * L.base - y); g.drawImage(sc, x, y, 2.4, fade); });
      g.globalAlpha = 1;
      // 능선 붓선 — 봉우리 근처는 굵고 짙게, 골짜기는 끊기듯
      for (let i = 1; i < R.length; i++) {
        const hgt = clamp((h * L.base - R[i][1]) / (h * 0.5));
        if (hgt < 0.06 || n2(R[i][0] / 38 + 200) > 0.5 + 0.45 * hgt) continue;
        g.strokeStyle = ink(L.line * (0.55 + 0.45 * hgt));
        g.lineWidth = L.lw * (0.4 + 0.9 * hgt) * (0.7 + 0.6 * n1(R[i][0] / 20 + 99));
        g.beginPath(); g.moveTo(R[i - 1][0], R[i - 1][1]); g.lineTo(R[i][0], R[i][1]); g.stroke();
      }
      // 준(皴) — 봉우리 비탈을 따라 짧게 내리긋는 결
      if (L.tex) for (let i = 3; i < R.length - 3; i += 2) {
        const hgt = clamp((h * L.base - R[i][1]) / (h * 0.45));
        if (r() > L.tex * hgt * hgt) continue;
        const [x, y] = R[i], sl = clamp((R[i + 2][1] - R[i - 2][1]) / 8, -1.2, 1.2);
        const len = 8 + r() * 26 * hgt;
        g.lineWidth = 0.5 + r() * 0.8; g.strokeStyle = ink(L.line * (0.3 + r() * 0.3));
        g.beginPath(); g.moveTo(x, y + 1.5); g.quadraticCurveTo(x + sl * len * 0.25, y + len * 0.5, x + sl * len * 0.55 + (r() - .5) * 3, y + len); g.stroke();
      }
      // 미점(米點) — 봉우리 머리의 숲
      if (L.trees) for (let i = 2; i < R.length - 2; i += 2) {
        const [x, y] = R[i], hgt = clamp((h * L.base - y) / (h * 0.45));
        if (r() > L.trees * hgt) continue;
        g.fillStyle = ink((0.35 + r() * 0.45) * (L.dot || 1));
        g.beginPath(); g.ellipse(x + (r() - .5) * 6, y + 0.5 + r() * 5, 1.4 + r() * 2.2, 0.8 + r() * 0.9, (r() - .5) * 0.25, 0, 7); g.fill();
      }
    });
  }

  /* 댓잎 — 밑동은 좁고, 1/3에서 배가 부르고, 끝은 칼끝처럼 */
  function leaf(g, x, y, ang, len, a, r) {
    const wd = len * (0.1 + r() * 0.035), bend = (r() - 0.5) * len * 0.16;
    g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = ink(a);
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.26, -wd * 1.3, len, bend);
    g.quadraticCurveTo(len * 0.4, wd * 1.0, 0, 0);
    g.fill(); g.restore();
  }

  /* 대나무 */
  function bamboo(g, w, h, {stalks, seed}) {
    const r = rng(seed);
    stalks.forEach(st => {
      const H0 = st.height, unit = H0 / 7.2;
      const cx = t => st.x + st.lean * H0 * Math.pow(t, 1.6);
      const segs = []; let y = h + 6, i = 0;
      while (h - y < H0 - unit * 0.35) {
        const L = unit * (i === 0 ? 0.6 : i < 3 ? 0.82 + i * 0.08 : Math.max(0.55, 1.06 - 0.06 * (i - 3))) * (0.93 + 0.14 * r());
        segs.push([y, Math.max(y - L, h - H0)]); y -= L + st.width * 0.32; i++;
      }
      const tips = [];
      segs.forEach(([yb, yt], k) => {
        const tb = (h - yb) / H0, tt = (h - yt) / H0;
        const wb = st.width * (1 - 0.4 * tb), wt = st.width * (1 - 0.4 * tt);
        const xb = cx(tb), xt = cx(tt), xm = (xb + xt) / 2, ym = (yb + yt) / 2, wm = (wb + wt) / 2 * 0.86;
        g.fillStyle = ink(st.alpha);
        g.beginPath();
        g.moveTo(xb - wb / 2, yb); g.quadraticCurveTo(xm - wm / 2, ym, xt - wt / 2, yt);
        g.lineTo(xt + wt / 2, yt); g.quadraticCurveTo(xm + wm / 2, ym, xb + wb / 2, yb);
        g.closePath(); g.fill();
        // 줄기 한쪽에 남은 붓의 흰 결 → 둥근 입체감
        g.save(); g.globalCompositeOperation = "destination-out";
        g.strokeStyle = "rgba(0,0,0,0.42)"; g.lineWidth = Math.max(0.6, wm * 0.13);
        g.beginPath(); g.moveTo(xb - wb * 0.2, yb - wb * 0.6); g.quadraticCurveTo(xm - wm * 0.24, ym, xt - wt * 0.2, yt + wt * 0.6); g.stroke();
        g.restore();
        // 마디
        if (k < segs.length - 1) {
          g.strokeStyle = ink(st.alpha * 1.15); g.lineWidth = Math.max(0.9, wt * 0.2);
          g.beginPath(); g.moveTo(xt - wt * 0.72, yt + wt * 0.05);
          g.quadraticCurveTo(xt - wt * 0.2, yt - wt * 0.3, xt + wt * 0.05, yt - wt * 0.05);
          g.moveTo(xt + wt * 0.15, yt - wt * 0.02);
          g.quadraticCurveTo(xt + wt * 0.45, yt - wt * 0.3, xt + wt * 0.72, yt + wt * 0.1);
          g.stroke();
          if (tt > 0.34 && r() < 0.85) tips.push([xt, yt, k]);
        }
      });
      // 가지와 잎
      const top = segs.at(-1), topT = (h - top[1]) / H0;
      tips.forEach(([x, y, k]) => {
        const side = (k % 2 ? 1 : -1) * (st.flip || 1);
        const bl = unit * (0.5 + r() * 0.55), ang = -Math.PI / 2 + side * (0.55 + r() * 0.35);
        const mx = x + Math.cos(ang) * bl * 0.5, my = y + Math.sin(ang) * bl * 0.5;
        const ex = x + Math.cos(ang + side * 0.12) * bl, ey = y + Math.sin(ang + side * 0.12) * bl;
        g.strokeStyle = ink(st.alpha); g.lineWidth = Math.max(0.8, st.width * 0.13);
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx + side * 3, my, ex, ey); g.stroke();
        [[ex, ey, 1], [mx, my, 0.75]].forEach(([lx, ly, m]) => {
          const n = Math.round((2 + r() * 3) * m);
          const base = side > 0 ? 0.55 : Math.PI - 0.55;
          for (let q = 0; q < n; q++) {
            const a = base + side * ((q / Math.max(1, n - 1)) - 0.35) * 1.2 + (r() - .5) * 0.25;
            leaf(g, lx, ly, a, st.leaf * (0.7 + r() * 0.5) * m, st.alpha * (0.85 + r() * 0.15), r);
          }
        });
      });
      // 끝순
      const tx = cx(topT), ty = top[1];
      for (let q = 0; q < 3; q++) leaf(g, tx, ty, -Math.PI / 2 + (q - 1) * 0.45 + (r() - .5) * 0.2, st.leaf * (0.55 + r() * 0.3), st.alpha, r);
    });
  }

  /* 난초 — 한 획 안에서 가늘다 굵다 다시 가늘어지는 잎(螳螂肚) */
  function orchid(g, bx, by, s, seed) {
    const r = rng(seed);
    const leaves = [[270, -40, 120, -250, 8], [-200, -70, -50, -260, 7], [330, 60, 230, -150, 6.5],
      [-70, -300, -40, -180, 5.5], [150, -290, 90, -220, 5.5], [-280, 40, -190, -110, 6], [30, -210, -10, -120, 4.5]];
    leaves.forEach(([ex, ey, qx, qy, wd]) => {
      const P = [], Q = [];
      for (let i = 0; i <= 70; i++) {
        const t = i / 70, it = 1 - t;
        const x = bx + s * (2 * it * t * qx + t * t * ex), y = by + s * (2 * it * t * qy + t * t * ey);
        const dx = 2 * it * qx + 2 * t * (ex - qx), dy = 2 * it * qy + 2 * t * (ey - qy), d = Math.hypot(dx, dy) || 1;
        const tw = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.02)), 0.65) * (1 - 0.7 * Math.exp(-Math.pow((t - 0.42 - r() * 0.04) / 0.07, 2))) * (t < 0.06 ? t / 0.06 * 0.6 + 0.4 : 1);
        const hw = wd * s * tw / 2;
        P.push([x - dy / d * hw, y + dx / d * hw]); Q.push([x + dy / d * hw, y - dx / d * hw]);
      }
      g.fillStyle = ink(0.92); g.beginPath();
      P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
      for (let i = Q.length - 1; i >= 0; i--) g.lineTo(Q[i][0], Q[i][1]);
      g.closePath(); g.fill();
    });
    // 꽃 두 송이 — 담묵 꽃잎, 농묵 점심(點心)
    [[60, -170, -0.3], [-40, -130, 0.4]].forEach(([fx, fy, rot]) => {
      const x = bx + fx * s, y = by + fy * s;
      g.strokeStyle = ink(0.4); g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(bx + fx * 0.15 * s, by - 6); g.quadraticCurveTo(bx + fx * 0.8 * s, by + fy * 0.5 * s, x, y + 6); g.stroke();
      for (let q = 0; q < 5; q++) {
        const a = rot - Math.PI / 2 + (q - 2) * 0.62;
        g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = ink(0.3 + r() * 0.12);
        const L = (30 + r() * 12) * s, wdp = L * 0.32;
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * 0.4, -wdp, L, (r() - .5) * 4); g.quadraticCurveTo(L * 0.45, wdp * 0.8, 0, 0); g.fill(); g.restore();
      }
      g.fillStyle = ink(0.95);
      [[-2, -3, 1.6], [2.5, -1, 1.3], [0, 2, 1.4]].forEach(([dx, dy, rr]) => { g.beginPath(); g.ellipse(x + dx * s, y + dy * s, rr * s * 1.3, rr * s, 0.4, 0, 7); g.fill(); });
    });
  }

  /* 땅 — 난초 밑동의 짧은 가로 붓질과 태점 */
  function ground(g, x, y, s, seed) {
    const r = rng(seed);
    [[-120, 6, -30, 3, 2.4], [-20, 4, 90, 7, 3], [70, 9, 170, 10, 1.6], [-190, 10, -140, 9, 1.2]].forEach(([a, ay, b, by, wd]) => {
      const x0 = x + a * s, x1 = x + b * s, y0 = y + ay * s, y1 = y + by * s;
      g.fillStyle = ink(0.85); g.beginPath(); g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2, y0 - wd * 1.2, x1, y1); g.quadraticCurveTo((x0 + x1) / 2, y1 + wd * 0.6, x0, y0); g.fill();
    });
    for (let q = 0; q < 8; q++) { g.fillStyle = ink(0.8 + r() * 0.2); g.beginPath();
      g.ellipse(x + (r() - 0.5) * 300 * s, y + (2 + r() * 10) * s, 1.3 + r() * 1.8, 0.8 + r() * 0.7, (r() - .5) * 0.4, 0, 7); g.fill(); }
  }

  function birds(g, list) {
    g.strokeStyle = ink(0.75); g.lineWidth = 1.1;
    list.forEach(([x, y, s]) => { g.beginPath(); g.moveTo(x - 7 * s, y - 2 * s); g.quadraticCurveTo(x - 3 * s, y - 4.5 * s, x, y);
      g.quadraticCurveTo(x + 3.5 * s, y - 5 * s, x + 8 * s, y - 3 * s); g.stroke(); });
  }

  function scenery(W, S) {
    const top = el => el.getBoundingClientRect().top + scrollY;
    const xAt = y => { let best = S[0]; for (const p of S) if (Math.abs(p.y - y) < Math.abs(best.y - y)) best = p; return best.x; };
    const minXIn = (y0, y1) => { let m = 1e9; for (const p of S) if (p.y >= y0 && p.y <= y1) m = Math.min(m, p.x); return m; };
    const maxXIn = (y0, y1) => { let m = -1e9; for (const p of S) if (p.y >= y0 && p.y <= y1) m = Math.max(m, p.x); return m; };

    /* 1. 히어로 — 길 뒤로 겹겹이 물러나는 먼 산과 새 */
    const hero = document.querySelector('[data-way="hero"]');
    const hTxt = hero.querySelector("[data-block]").getBoundingClientRect();
    const hb = top(hero) + hero.offsetHeight, mx = hTxt.right + 30, mh = Math.min(460, hero.offsetHeight * 0.52);
    paint(mx, hb - mh, W - mx, mh + 40, (g, w, h) => mountains(g, w, h, {seed: 3, layers: [
      {base: 0.6, alpha: 0.06, line: 0.18, lw: 1, peaks: [[0.32, 0.26, 0.2], [0.58, 0.36, 0.17], [0.86, 0.3, 0.2]], fade: 0.34},
      {base: 0.78, alpha: 0.1, line: 0.34, lw: 1.3, peaks: [[0.48, 0.3, 0.14], [0.7, 0.42, 0.13], [0.98, 0.3, 0.16]], tex: 0.35, fade: 0.3, trees: 0.18, dot: 0.6},
      {base: 0.95, alpha: 0.16, line: 0.6, lw: 1.8, peaks: [[0.74, 0.28, 0.12], [0.9, 0.44, 0.11], [1.08, 0.3, 0.14]], tex: 0.6, fade: 0.26, trees: 0.4}
    ]}), {l: 0.38, b: 0.16});
    paint(W * 0.74, hb - mh - 120, 160, 80, g => birds(g, [[40, 40, 1.1], [70, 52, 0.8], [100, 34, 0.65], [126, 46, 0.5]]));

    const [s1, s2, s3] = document.querySelectorAll('[data-way="step"]');
    /* 2. 壹 — 왼쪽 여백의 대나무 */
    if (s1) {
      const y0 = top(s1), h = s1.offsetHeight, room = minXIn(y0, y0 + h) - 60;
      if (room > 160) paint(0, y0 + h * 0.04, room, h * 0.96, (g, w, hh) => bamboo(g, w, hh, {seed: 5, stalks: [
        {x: w * 0.6, height: hh * 0.62, lean: 0.06, width: 6, alpha: 0.2, leaf: 50, flip: -1},
        {x: w * 0.18, height: hh * 0.78, lean: -0.02, width: 7, alpha: 0.38, leaf: 58},
        {x: w * 0.38, height: hh * 0.96, lean: 0.07, width: 10, alpha: 0.94, leaf: 78}
      ]}), {r: 0.06, b: 0.18});
      else { // 좁은 화면: 오른쪽 끝에서 카드 뒤로 솟는 대나무
        const rw = Math.min(320, W * 0.32);
        paint(W - rw, y0 + h * 0.02, rw, h * 0.98, (g, w, hh) => bamboo(g, w, hh, {seed: 5, stalks: [
          {x: w * 0.3, height: hh * 0.7, lean: -0.05, width: 6, alpha: 0.22, leaf: 48},
          {x: w * 0.82, height: hh * 0.8, lean: 0.02, width: 7, alpha: 0.4, leaf: 54, flip: -1},
          {x: w * 0.62, height: hh * 0.98, lean: -0.07, width: 9, alpha: 0.94, leaf: 70, flip: -1}
        ]}), {l: 0.06, b: 0.18});
      }
    }
    /* 3. 貳 — 오른쪽으로 솟은 산봉우리, 길이 그 앞을 지나감 */
    if (s2) {
      const y0 = top(s2), h = s2.offsetHeight, card = s2.querySelector(".card").getBoundingClientRect();
      const x0 = card.right + 40, ph = h * 0.82;
      paint(x0, y0 + h - ph + 40, W - x0, ph, (g, w, hh) => mountains(g, w, hh, {seed: 9, layers: [
        {base: 0.6, alpha: 0.055, line: 0.16, lw: 1, peaks: [[0.22, 0.2, 0.2], [0.55, 0.34, 0.18], [0.9, 0.42, 0.2]], fade: 0.34},
        {base: 0.8, alpha: 0.1, line: 0.36, lw: 1.3, peaks: [[0.45, 0.24, 0.15], [0.76, 0.5, 0.13], [1.02, 0.36, 0.15]], tex: 0.4, trees: 0.2, fade: 0.3, dot: 0.65},
        {base: 0.97, alpha: 0.17, line: 0.62, lw: 1.9, peaks: [[0.58, 0.18, 0.13], [0.88, 0.36, 0.11], [1.06, 0.48, 0.12]], tex: 0.65, trees: 0.45, fade: 0.26}
      ]}), {l: 0.3, b: 0.2});
    }
    /* 4. 參 — 왼쪽 아래 바위와 난초 */
    if (s3) {
      const y0 = top(s3), h = s3.offsetHeight, room = minXIn(y0 + h * 0.3, y0 + h) - 50;
      if (room > 180) paint(0, y0 + h * 0.3, room, h * 0.7, (g, w, hh) => {
        const bx = w * 0.46, by = hh - 70;
        orchid(g, bx, by, Math.min(0.85, w / 520), 17);
        ground(g, bx, by, Math.min(0.85, w / 520), 4);
      }, {r: 0.04, b: 0.06});
      else { // 좁은 화면: 카드 아래 오른쪽 구석의 난초
        const rw = Math.min(380, W * 0.42), rh = Math.min(300, h * 0.42);
        paint(W - rw, y0 + h - rh, rw, rh, (g, w, hh) => { const sc = Math.min(0.7, w / 560);
          orchid(g, w * 0.55, hh - 40, sc, 17); ground(g, w * 0.55, hh - 40, sc, 4); }, {l: 0.04, b: 0.04});
      }
    }
    /* 5. 끝 — 낮게 깔린 먼 산 */
    const end = document.querySelector('[data-way="end"]');
    if (end) {
      const eb = top(end) + end.offsetHeight, eh = 240;
      paint(0, eb - eh, W, eh, (g, w, hh) => mountains(g, w, hh, {seed: 21, layers: [
        {base: 0.72, alpha: 0.05, line: 0.14, lw: 1, peaks: [[0.06, 0.26, 0.12], [0.2, 0.34, 0.1], [0.8, 0.36, 0.1], [0.95, 0.28, 0.12]], fade: 0.36},
        {base: 0.98, alpha: 0.1, line: 0.32, lw: 1.3, peaks: [[0.0, 0.32, 0.1], [0.13, 0.44, 0.08], [0.87, 0.48, 0.08], [1.0, 0.36, 0.1]], tex: 0.4, trees: 0.2, fade: 0.3, dot: 0.6}
      ]}), {l: 0.04, r: 0.04, b: 0.1});
    }
  }

  function render(W) {
    road.innerHTML = "";
    road.style.height = H + "px";
    for (let top = 0; top < H; top += TILE) {
      const h = Math.min(TILE, H - top);
      const c = document.createElement("canvas");
      c.width = Math.ceil(W * DPR); c.height = Math.ceil(h * DPR);
      c.style.cssText = `position:absolute;left:0;top:${top}px;width:${W}px;height:${h}px`;
      const g = c.getContext("2d");
      g.setTransform(DPR, 0, 0, DPR, 0, -top * DPR);
      for (const o of ops) if (o.y1 >= top && o.y0 <= top + h) play(g, o);
      road.appendChild(c);
    }
  }

  function draw() {
    road.style.height = "0px"; road.innerHTML = "";
    if (document.body.classList.contains("is-app")) return;    // 앱 화면에서는 그리지 않음
    const W = document.documentElement.clientWidth;
    H = document.documentElement.scrollHeight;
    build(W);
    if (W >= 768) scenery(W, samples);
    render(W);
    update();
  }

  /* 스크롤에 따라 길이 아래로 이어지는 마스크 */
  function update() {
    const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    target = atBottom ? H + 400 : scrollY + innerHeight * 0.88;
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    current += (target - current) * (reduced ? 1 : 0.07);
    if (Math.abs(target - current) < 0.5) current = target;
    road.style.setProperty("--rv", current.toFixed(1) + "px");
    raf = current !== target ? requestAnimationFrame(tick) : 0;
  }

  addEventListener("scroll", update, {passive: true});
  let rt, lastW = 0;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (document.documentElement.clientWidth !== lastW) { lastW = document.documentElement.clientWidth; draw(); } }, 180); });

  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), {threshold: 0.15});
  document.querySelectorAll(".reveal").forEach((n, i) => { n.style.transitionDelay = (n.closest(".hero") ? i * 90 : 0) + "ms"; io.observe(n); });

  // 글꼴 교체 등으로 레이아웃 높이가 바뀌면 길을 다시 맞춤
  let lastMainH = 0, ro;
  new ResizeObserver(([e]) => { const hh = Math.round(e.contentRect.height); if (lastMainH && hh !== lastMainH) { clearTimeout(ro); ro = setTimeout(draw, 200); } lastMainH = hh; }).observe(document.querySelector("#landing main"));
  const start = () => { lastW = document.documentElement.clientWidth; draw();
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else addEventListener("load", start);
  window.HakdoRoad = {redraw: () => { lastW = document.documentElement.clientWidth; draw(); }, observeReveal: el => io.observe(el)};
})();
