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

  function showError(title, subtitle, actionHtml = '') {
    loadingArea.innerHTML = `<div class="empty-state">
      <div class="empty-state__icon">⚠</div>
      <div class="empty-state__title">${UI.escapeHtml(title)}</div>
      ${subtitle ? `<p class="text-muted text-small">${UI.escapeHtml(subtitle)}</p>` : ''}
      ${actionHtml}
    </div>`;
  }

  (async () => {
    const u = Auth.getUser();
    if (!u) {
      showError('ยังไม่ได้เข้าสู่ระบบ', '');
      return;
    }
    if (u.user_role !== 'worker') {
      showError(
        'ยังไม่ได้เป็นช่าง',
        'สมัครเป็นช่างก่อน',
        '<a href="/become-worker" class="btn btn--primary btn--sm" style="margin-top: 12px;">สมัครเป็นช่าง</a>'
      );
      return;
    }

    try {
      // หา worker_id ของตัวเอง (จาก localStorage หรือ search ผ่าน skill tree)
      workerId = await resolveWorkerId(u);
      if (!workerId) {
        showError(
          'หา worker_id ไม่เจอ',
          'ลองออกจากระบบแล้วเข้าใหม่ หรือสมัครเป็นช่างใหม่',
          '<a href="/profile" class="btn btn--outline btn--sm" style="margin-top: 12px;">กลับโปรไฟล์</a>'
        );
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
      showError('โหลดข้อมูลไม่ได้', err.message || '');
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
