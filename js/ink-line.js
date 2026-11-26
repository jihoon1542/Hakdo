/* 學道 — 졸업 여정 화면의 세로 먹선
   학기 지점들을 잇는 가는 붓선. 장식이므로 정보(과목·학점)는 담지 않습니다. */
(function (root) {
  "use strict";
  const rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const noise = seed => { const r = rng(seed), v = Array.from({length: 512}, r);
    return x => { const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f); return v[i & 511] * (1 - s) + v[(i + 1) & 511] * s; }; };

  /* canvas: 대상 캔버스, x: 선의 x, ys: 지나갈 지점들의 y (위→아래) */
  function draw(canvas, x, ys, opts = {}) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = Math.ceil(W * dpr); canvas.height = Math.ceil(H * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (ys.length < 2) return;
    const y0 = ys[0], y1 = ys[ys.length - 1], L = y1 - y0;
    const base = opts.width || 2.4;
    const nX = noise(3), nW = noise(7), nE = noise(11), nD = noise(19);
    const pts = [];
    for (let y = y0; y <= y1; y += 1.5) {
      const t = (y - y0) / L;
      const sway = Math.sin(y / 170) * 3.5 + (nX(y / 90) - 0.5) * 4;
      // 학기 지점 근처에서 붓을 살짝 누름
      const near = ys.reduce((m, yy) => Math.max(m, Math.exp(-Math.pow((y - yy) / 26, 2))), 0);
      const hw = base * (0.7 + 0.5 * nW(y / 140) + 0.55 * near) * (t < 0.02 ? 0.6 + 20 * t : 1) * (t > 0.97 ? 1 - (t - 0.97) * 20 : 1);
      pts.push({x: x + sway, y, hw, dry: nD(y / 60)});
    }
    g.fillStyle = "#0a0a0a";
    // 몸통: 먹이 마른 구간은 끊김(비백)
    let run = [];
    const flush = () => {
      if (run.length < 3) { run = []; return; }
      g.beginPath();
      run.forEach((p, i) => { const e = (nE(p.y / 3) - 0.5) * 0.5; i ? g.lineTo(p.x - p.hw + e, p.y) : g.moveTo(p.x - p.hw + e, p.y); });
      for (let i = run.length - 1; i >= 0; i--) { const p = run[i], e = (nE(p.y / 3 + 70) - 0.5) * 0.5; g.lineTo(p.x + p.hw + e, p.y); }
      g.closePath(); g.fill(); run = [];
    };
    pts.forEach(p => { if (p.dry > 0.83) flush(); else run.push(p); });
    flush();
    // 마른 구간을 잇는 가는 붓털 두 가닥
    g.strokeStyle = "rgba(10,10,10,.55)"; g.lineWidth = 0.7;
    [-0.6, 0.5].forEach(u => {
      g.beginPath(); let on = false;
      pts.forEach(p => { const v = p.dry > 0.78; if (!v) { on = false; return; }
        const xx = p.x + u * p.hw; if (on) g.lineTo(xx, p.y); else { g.moveTo(xx, p.y); on = true; } });
      g.stroke();
    });
  }
  root.HakdoInkLine = {draw};
})(window);
