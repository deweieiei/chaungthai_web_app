// /login
(function () {
  'use strict';
  if (!Auth.guestOnly()) return;

  const form = document.getElementById('login-form');
  const submitBtn = form.querySelector('button[type="submit"]');

  // toggle password
  const toggle = form.querySelector('[data-toggle-password]');
  const passInput = document.getElementById('password');
  toggle?.addEventListener('click', () => {
    const isPwd = passInput.type === 'password';
    passInput.type = isPwd ? 'text' : 'password';
    toggle.textContent = isPwd ? '🙈' : '👁';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearFieldErrors(form);
    UI.setFormError(form, null);

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const eErr = UI.Validators.email(email);
    const pErr = UI.Validators.password(password);
    if (eErr) UI.setFieldError('email', eErr);
    if (pErr) UI.setFieldError('password', pErr);
    if (eErr || pErr) return;

    UI.setBtnLoading(submitBtn, true);
    try {
      const res = await Api.post('/auth/login', {
        user_email: email,
        user_password: password,
      });
      Auth.setToken(res.token);
      Auth.setUser(res.user);
      location.replace('/home');
    } catch (err) {
      if (err.status === 403) {
        UI.setFormError(form, err.message || 'บัญชีนี้ใช้งานไม่ได้');
      } else {
        UI.setFormError(form, err.message || 'เข้าสู่ระบบไม่สำเร็จ');
      }
    } finally {
      UI.setBtnLoading(submitBtn, false);
    }
  });
})();
