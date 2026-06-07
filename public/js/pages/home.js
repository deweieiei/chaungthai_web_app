// /home
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const user = Auth.getUser();
  const nameEl = document.getElementById('hero-name');
  if (user) nameEl.textContent = user.user_name || 'ผู้ใช้';

  // refresh user profile เงียบๆ (เพื่อให้ name + role ใน localStorage update)
  (async () => {
    if (!user) return;
    try {
      const res = await Api.get('/users/' + user.user_id);
      const fresh = res.user;
      Auth.setUser(fresh);
      nameEl.textContent = fresh.user_name || 'ผู้ใช้';
    } catch (err) {
      // เน็ตหลุดบ่อย — เงียบ
      console.warn('[home] refresh failed', err);
    }
  })();
})();
