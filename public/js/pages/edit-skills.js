// /worker/edit-skills
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const form = document.querySelector('.app-shell');
  const submitBtn = document.getElementById('submit-btn');
  const loadingArea = document.getElementById('loading-area');
  const skillMount = document.getElementById('skill-mount');
  const submitArea = document.getElementById('submit-area');

  let selectedSet = new Set();
  let workerId = null;

  function updateBtn() {
    submitBtn.textContent = `บันทึก (${selectedSet.size} สกิล)`;
  }

  // หา worker_id ของตัวเอง via search
  (async () => {
    const u = Auth.getUser();
    if (!u || u.user_role !== 'worker') {
      loadingArea.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">🚫</div>
        <div class="empty-state__title">ยังไม่ได้เป็นช่าง</div>
        <a href="/become-worker" class="btn btn--primary btn--sm" style="margin-top: 12px;">สมัครเป็นช่าง</a>
      </div>`;
      return;
    }
    try {
      // search by skill 1 + province → หาเอง
      const sRes = await Api.get('/workers/search', {
        query: {
          skill_id: 1,
          province_id: u.user_province_id || 1,
          auto_expand: 'true',
          limit: 100,
        },
      });
      const me = (sRes.workers || []).find((w) => w.worker_user_id === u.user_id);
      if (me) workerId = me.worker_id;

      if (!workerId) {
        loadingArea.innerHTML = `<div class="empty-state">
          <div class="empty-state__icon">⚠</div>
          <div class="empty-state__title">หา worker_id ไม่เจอ</div>
          <p class="text-muted text-small">ลองรีเฟรชหน้า</p>
        </div>`;
        return;
      }

      // โหลด detail → สกิลปัจจุบัน
      const detail = await Api.get('/workers/' + workerId);
      const currentSkillIds = (detail.skills || []).map((s) => s.skill_id);

      loadingArea.classList.add('hidden');
      skillMount.classList.remove('hidden');
      submitArea.classList.remove('hidden');

      SkillTree.mount('#skill-mount', {
        selected: currentSkillIds,
        max: 50,
        onChange: (s) => {
          selectedSet = s;
          updateBtn();
        },
      });
      selectedSet = new Set(currentSkillIds);
      updateBtn();
    } catch (err) {
      loadingArea.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">⚠</div>
        <div class="empty-state__title">โหลดข้อมูลไม่ได้</div>
        <p class="text-muted text-small">${UI.escapeHtml(err.message || '')}</p>
      </div>`;
    }
  })();

  submitBtn.addEventListener('click', async () => {
    UI.setFormError(form, null);
    if (selectedSet.size === 0) {
      UI.setFormError(form, 'กรุณาเลือกสกิลอย่างน้อย 1 อัน');
      return;
    }
    UI.setBtnLoading(submitBtn, true);
    try {
      await Api.put('/workers/' + workerId + '/skills', {
        skill_ids: Array.from(selectedSet),
      });
      UI.toast('บันทึกสกิลสำเร็จ', 'success');
      setTimeout(() => location.assign('/profile'), 600);
    } catch (err) {
      UI.setFormError(form, err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      UI.setBtnLoading(submitBtn, false);
    }
  });
})();
