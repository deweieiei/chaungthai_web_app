// /register
(function () {
  'use strict';
  if (!Auth.guestOnly()) return;

  const form = document.getElementById('register-form');
  const submitBtn = form.querySelector('button[type="submit"]');

  // toggle password
  form.querySelector('[data-toggle-password]')?.addEventListener('click', (e) => {
    const inputs = [document.getElementById('password'), document.getElementById('confirm')];
    const isPwd = inputs[0].type === 'password';
    inputs.forEach((el) => (el.type = isPwd ? 'text' : 'password'));
    e.currentTarget.textContent = isPwd ? '🙈' : '👁';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearFieldErrors(form);
    UI.setFormError(form, null);

    const name = document.getElementById('name').value.trim();
    const lastname = document.getElementById('lastname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;

    const errs = {
      name: UI.Validators.required(name, 'ชื่อ'),
      email: UI.Validators.email(email),
      password: UI.Validators.password(password),
      confirm: UI.Validators.match(confirm, password, 'รหัสผ่าน'),
    };
    let hasErr = false;
    for (const [k, v] of Object.entries(errs)) {
      if (v) { UI.setFieldError(k, v); hasErr = true; }
    }
    if (hasErr) return;

    UI.setBtnLoading(submitBtn, true);
    try {
      await Api.post('/auth/register', {
        user_name: name,
        user_lastname: lastname || undefined,
        user_email: email,
        user_password: password,
      });
      UI.toast('สมัครสมาชิกสำเร็จ — เข้าสู่ระบบได้เลย', 'success');
      setTimeout(() => location.replace('/login'), 800);
    } catch (err) {
      if (err.status === 409) {
        UI.setFieldError('email', err.message || 'อีเมลนี้ถูกใช้แล้ว');
      } else {
        UI.setFormError(form, err.message || 'สมัครไม่สำเร็จ');
      }
    } finally {
      UI.setBtnLoading(submitBtn, false);
    }
  });
})();
