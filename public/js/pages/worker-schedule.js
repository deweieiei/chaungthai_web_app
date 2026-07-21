// /worker/schedule — แก้เวลาทำงานประจำสัปดาห์
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const form = document.querySelector('.app-shell');
  const mount = document.getElementById('schedule-mount');
  const saveBtn = document.getElementById('save-btn');

  if (!Auth.isWorkerAccount()) {
    mount.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-state__icon">🛠️</div>' +
        '<div class="empty-state__title">ต้องใช้บัญชีช่าง</div>' +
        '<p class="text-muted text-small">หน้านี้สำหรับฝั่งช่างเท่านั้น</p>' +
      '</div>';
    saveBtn.hidden = true;
    return;
  }

  let schedule = [];
  let workerId = null;

  (async function start() {
    const u = Auth.getUser();
    workerId = await resolveWorkerId(u);

    if (!workerId) {
      mount.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-state__icon">📝</div>' +
          '<div class="empty-state__title">ยังไม่ได้ตั้งโปรไฟล์ช่าง</div>' +
          '<p class="text-muted text-small">เลือกสกิลและปักหมุดให้เสร็จก่อน</p>' +
          '<a href="/become-worker" class="btn btn--primary" style="margin-top:var(--space-md)">ไปตั้งโปรไฟล์ช่าง</a>' +
        '</div>';
      saveBtn.hidden = true;
      return;
    }

    // ดึงเวลาเดิมมาแสดง
    let current = [];
    try {
      const detail = await Api.get('/workers/' + workerId);
      current = detail.schedule || [];
    } catch (err) {
      UI.toast('โหลดเวลาเดิมไม่ได้ — เริ่มตั้งใหม่ได้เลย', 'warning');
    }

    schedule = current;
    SchedulePicker.mount('#schedule-mount', {
      value: current,
      onChange: (list) => { schedule = list; },
    });
  })();

  saveBtn.addEventListener('click', async function () {
    if (!workerId) return;
    UI.setFormError(form, null);
    UI.setBtnLoading(saveBtn, true);
    try {
      const res = await Api.put('/workers/' + workerId + '/schedule', { schedule });
      UI.toast(res.message, 'success');
      setTimeout(() => location.assign('/profile'), 800);
    } catch (err) {
      UI.setFormError(form, err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      UI.setBtnLoading(saveBtn, false);
    }
  });
})();
