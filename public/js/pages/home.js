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

      // ถ้าเป็นช่าง — โหลด stats จาก /workers/:id โดยใช้ worker_id ที่ resolve ได้
      if (fresh.user_role === 'worker') {
        try {
          const wid = await resolveWorkerId(fresh);
          if (wid) {
            const detail = await Api.get('/workers/' + wid);
            document.getElementById('worker-stats').classList.remove('hidden');
            document.getElementById('stat-tickets').textContent = detail.worker.worker_job_tickets;
            document.getElementById('stat-jobs').textContent = detail.worker.worker_total_jobs;
          }
        } catch {}
      }
    } catch (err) {
      // เน็ตหลุดบ่อย — เงียบ
      console.warn('[home] refresh failed', err);
    }
  })();
})();
