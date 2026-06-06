// /profile/password
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const form = document.getElementById('password-form');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearFieldErrors(form);
    UI.setFormError(form, null);

    const oldP = document.getElementById('old').value;
    const newP = document.getElementById('new').value;
    const confP = document.getElementById('confirm').value;

    const errs = {
      old: UI.Validators.required(oldP, 'รหัสผ่านเดิม'),
      new: UI.Validators.password(newP),
      confirm: UI.Validators.match(confP, newP, 'รหัสผ่าน'),
    };
    let hasErr = false;
    for (const [k, v] of Object.entries(errs)) {
      if (v) { UI.setFieldError(k, v); hasErr = true; }
    }
    if (hasErr) return;
    if (oldP === newP) {
      UI.setFormError(form, 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม');
      return;
    }

    const u = Auth.getUser();
    if (!u) return;

    UI.setBtnLoading(submitBtn, true);
    try {
      await Api.patch('/users/' + u.user_id + '/password', {
        old_password: oldP,
        new_password: newP,
      });
      UI.toast('เปลี่ยนรหัสผ่านสำเร็จ', 'success');
      setTimeout(() => location.assign('/profile'), 600);
    } catch (err) {
      if (err.status === 401) {
        UI.setFieldError('old', err.message || 'รหัสผ่านเดิมไม่ถูกต้อง');
      } else {
        UI.setFormError(form, err.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
      }
    } finally {
      UI.setBtnLoading(submitBtn, false);
    }
  });
})();
