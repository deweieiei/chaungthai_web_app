// /home
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const user = Auth.getUser();
  const nameEl = document.getElementById('hero-name');
  if (user) nameEl.textContent = user.user_name || 'ผู้ใช้';

  function applyRole(u) {
    const isWorker = u && u.user_role === 'worker';
    document.getElementById('become-worker-card').classList.toggle('hidden', isWorker);
    document.getElementById('edit-skills-card').classList.toggle('hidden', !isWorker);
  }
  applyRole(user);

  // refresh user profile + worker stats (ถ้าเป็นช่าง)
  (async () => {
    if (!user) return;
    try {
      const res = await Api.get('/users/' + user.user_id);
      const fresh = res.user;
      Auth.setUser(fresh);
      nameEl.textContent = fresh.user_name || 'ผู้ใช้';
      applyRole(fresh);

      // ถ้าเป็นช่าง — ลอง search หา worker_id ของตัวเอง
      if (fresh.user_role === 'worker' && fresh.user_province_id) {
        // เรียก search แบบ broad → หา worker_id ของตัวเอง
        try {
          const sRes = await Api.get('/workers/search', {
            query: {
              skill_id: 1,
              province_id: fresh.user_province_id,
              auto_expand: 'true',
              limit: 100,
            },
          });
          const me = (sRes.workers || []).find((w) => w.worker_user_id === fresh.user_id);
          if (me) {
            document.getElementById('worker-stats').classList.remove('hidden');
            document.getElementById('stat-tickets').textContent = me.worker_job_tickets;
            document.getElementById('stat-jobs').textContent = me.worker_total_jobs;
          }
        } catch {}
      }
    } catch (err) {
      // เน็ตหลุดบ่อย — เงียบ
      console.warn('[home] refresh failed', err);
    }
  })();
})();
