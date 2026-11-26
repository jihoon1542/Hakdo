/* 學道 — 브라우저 저장소 (이 기기의 localStorage에만 저장)
   db = { mode: "mine" | "sample", mine: 슬롯|null, sample: 슬롯|null }
   샘플 체험과 내 내역은 서로 다른 슬롯이라 섞이지 않습니다. */
(function (root) {
  "use strict";
  const KEY = "hakdo:v1";
  const Store = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const db = JSON.parse(raw);
        return db && typeof db === "object" ? db : null;
      } catch (e) { return null; }
    },
    save(db) {
      try { localStorage.setItem(KEY, JSON.stringify({...db, savedAt: new Date().toISOString()})); return true; }
      catch (e) { return false; }
    },
    clear() {
      try { localStorage.removeItem(KEY); return true; } catch (e) { return false; }
    }
  };
  root.HakdoStore = Store;
})(window);
