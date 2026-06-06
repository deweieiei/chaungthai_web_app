// /become-worker
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const form = document.querySelector('.app-shell');
  const submitBtn = document.getElementById('submit-btn');
  let selectedSet = new Set();

  function updateBtn() {
    submitBtn.textContent = `สมัครเป็นช่าง (${selectedSet.size} สกิล)`;
  }

  let picker;
  SkillTree.mount('#skill-mount', {
    selected: [],
    max: 50,
    onChange: (s) => {
      selectedSet = s;
      updateBtn();
    },
  }).then((p) => { picker = p; });

  submitBtn.addEventListener('click', async () => {
    UI.setFormError(form, null);
    if (selectedSet.size === 0) {
      UI.setFormError(form, 'กรุณาเลือกสกิลอย่างน้อย 1 อัน');
      return;
    }
    const resume = document.getElementById('resume').value.trim();

    UI.setBtnLoading(submitBtn, true);
    try {
      const res = await Api.post('/workers', {
        worker_resume: resume || undefined,
        skill_ids: Array.from(selectedSet),
      });
      // อัปเดต role ใน storage
      const u = Auth.getUser();
      if (u) Auth.setUser({ ...u, user_role: 'worker' });

      const ok = await new Promise((resolve) => {
        const m = document.createElement('div');
        m.className = 'modal';
        m.innerHTML = `
          <div class="modal__card text-center">
            <div style="font-size: 56px;">🎉</div>
            <h3 class="modal__title">สมัครเป็นช่างสำเร็จ!</h3>
            <div class="modal__body">
              คุณได้รับบัตรรับงานเริ่มต้น <strong>${res.worker_job_tickets} ใบ</strong><br>
              เลือกสกิลแล้ว <strong>${res.skill_count} อัน</strong>
            </div>
            <button class="btn btn--primary btn--block" data-act="ok">ไปหน้าหลัก</button>
          </div>`;
        m.addEventListener('click', (e) => {
          if (e.target.dataset.act === 'ok') { m.remove(); resolve(true); }
        });
        document.body.appendChild(m);
      });
      if (ok) location.replace('/home');
    } catch (err) {
      if (err.status === 409) {
        const u = Auth.getUser();
        if (u) Auth.setUser({ ...u, user_role: 'worker' });
        await UI.confirm({
          title: 'คุณเป็นช่างอยู่แล้ว',
          message: 'สามารถแก้ไขสกิลได้ในหน้าโปรไฟล์',
          confirmLabel: 'ตกลง',
          cancelLabel: 'ปิด',
        });
        location.replace('/home');
      } else {
        UI.setFormError(form, err.message || 'สมัครไม่สำเร็จ');
      }
    } finally {
      UI.setBtnLoading(submitBtn, false);
    }
  });
})();
