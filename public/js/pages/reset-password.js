// /reset-password
(function () {
  'use strict';

  const form = document.getElementById('reset-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const tokenInput = document.getElementById('reset-token');

  if (!tokenInput.value) {
    UI.setFormError(form, 'ไม่พบ token รีเซ็ตรหัสผ่าน — กรุณาขอลิงก์ใหม่');
    submitBtn.disabled = true;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearFieldErrors(form);
    UI.setFormError(form, null);

    const newPwd = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm').value;

    const errs = {
      'new-password': UI.Validators.password(newPwd),
      confirm: UI.Validators.match(confirm, newPwd, 'รหัสผ่าน'),
    };
    let hasErr = false;
    for (const [k, v] of Object.entries(errs)) {
      if (v) { UI.setFieldError(k, v); hasErr = true; }
    }
    if (hasErr) return;

    UI.setBtnLoading(submitBtn, true);
    try {
      await Api.post('/auth/reset-password', {
        token: tokenInput.value,
        new_password: newPwd,
      });
      UI.toast('รีเซ็ตรหัสผ่านสำเร็จ — เข้าสู่ระบบใหม่ได้เลย', 'success');
      setTimeout(() => location.replace('/login'), 900);
    } catch (err) {
      if (err.status === 400) {
        UI.setFormError(form, err.message + ' — กรุณาขอลิงก์ใหม่');
      } else {
        UI.setFormError(form, err.message || 'รีเซ็ตไม่สำเร็จ');
      }
    } finally {
      UI.setBtnLoading(submitBtn, false);
    }
  });
})();
