// /home
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const user = Auth.getUser();
  const nameEl = document.getElementById('hero-name');
  if (user) nameEl.textContent = user.user_name || 'ผู้ใช้';

  // refresh user profile เงียบๆ
  (async () => {
    if (!user) return;
    try {
      const res = await Api.get('/users/' + user.user_id);
      const fresh = res.user;
      Auth.setUser(fresh);
      nameEl.textContent = fresh.user_name || 'ผู้ใช้';
    } catch (err) {
      console.warn('[home] refresh failed', err);
    }
  })();

  // ---------- section: ช่างของคุณ (favorites) ----------
  const favSection = document.getElementById('fav-section');
  const favScroller = document.getElementById('fav-scroller');

  function favCard(f) {
    const fullName = ((f.user_name || '') + ' ' + (f.user_lastname || '')).trim() || 'ช่าง';
    return `
      <div class="fav-card">
        <a class="fav-card__link" href="/worker/${f.worker_id}">
          ${UI.avatar({ user_name: f.user_name, user_image: f.user_image }, 'lg')}
          <div class="fav-card__name">${UI.escapeHtml(fullName)}</div>
          ${f.user_identity_verified_at ? '<div class="fav-card__verified">🪪 ยืนยันแล้ว</div>' : ''}
        </a>
        <div class="fav-card__actions">
          <a href="/chat/${f.user_id}" class="fav-card__btn" aria-label="แชต" title="แชต">💬</a>
          <button type="button" class="fav-card__btn" data-hire-user="${f.user_id}" data-hire-name="${UI.escapeHtml(fullName)}" aria-label="จ้างงาน" title="จ้างงาน">💼</button>
        </div>
      </div>
    `;
  }

  (async () => {
    try {
      const res = await Api.get('/favorites/workers');
      const list = res.favorites || [];
      if (list.length === 0) {
        favSection.hidden = true;
        return;
      }
      favSection.hidden = false;
      favScroller.innerHTML = list.map(favCard).join('');

      // bind ปุ่มจ้างงาน
      favScroller.querySelectorAll('button[data-hire-user]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          JobHelpers.openHireModal({
            workerUserId: Number(btn.dataset.hireUser),
            workerName: btn.dataset.hireName,
          });
        });
      });
    } catch (err) {
      // เงียบ — section นี้ไม่ critical
      favSection.hidden = true;
      console.warn('[home] favorites failed', err.message);
    }
  })();
})();
