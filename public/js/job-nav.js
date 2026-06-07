// ============================================================
//  job-nav.js — อัปเดต badge "งานใหม่" (pending) บน bottom-nav
//  - poll ทุก 30s
//  - ทำงานเฉพาะหน้าที่มี element badge + login แล้ว
// ============================================================
(function () {
  'use strict';

  const badge = document.getElementById('job-unread-badge');
  if (!badge) return;
  if (!window.Auth || !Auth.isLoggedIn()) return;

  let timer = null;

  async function refresh() {
    try {
      const res = await Api.get('/jobs/unread-count');
      const n = Number(res.unread_count || 0);
      if (n > 0) {
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    } catch {
      // ignore
    }
  }

  refresh();
  timer = setInterval(refresh, 30000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  window.addEventListener('beforeunload', () => {
    if (timer) clearInterval(timer);
  });
})();
