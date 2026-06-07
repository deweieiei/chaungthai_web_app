// ============================================================
//  chat-nav.js — อัปเดต unread badge บน bottom-nav ทุกหน้า
//  - poll ทุก 30s (สำรอง)
//  - ถ้า socket.io มี (หน้า chat room) — จะถูก override โดย event ของ socket
//  - ทำงานเฉพาะหน้าที่ login + มี element badge
// ============================================================
(function () {
  'use strict';

  const badge = document.getElementById('chat-unread-badge');
  if (!badge) return;
  if (!window.Auth || !Auth.isLoggedIn()) return;

  let timer = null;

  async function refresh() {
    try {
      const res = await Api.get('/chat/unread-count');
      const n = Number(res.unread_count || 0);
      if (n > 0) {
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    } catch {
      // ignore — badge ไม่ใช่ critical
    }
  }

  // โหลดครั้งแรก
  refresh();

  // poll ทุก 30s (เผื่อ socket ขาด)
  timer = setInterval(refresh, 30000);

  // อัปเดตทันทีเมื่อกลับมาดูแท็บ
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });

  window.addEventListener('beforeunload', () => {
    if (timer) clearInterval(timer);
  });
})();
