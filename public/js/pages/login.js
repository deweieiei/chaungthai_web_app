// /login
(function () {
  'use strict';
  if (!Auth.guestOnly()) return;

  const LABEL = { employer: 'ผู้ว่าจ้าง', worker: 'ช่าง' };

  const picker = document.getElementById('side-picker');
  const form = document.getElementById('login-form');
  const lead = document.getElementById('login-lead');
  const badgeText = document.getElementById('side-badge-text');
  const submitBtn = document.getElementById('login-submit');

  let side = null;   // 'employer' | 'worker'

  // ------------------------------------------------------------
  //  ขั้นที่ 1: เลือกฝั่ง
  //  บัญชีช่างกับผู้ว่าจ้างแยกกันสมบูรณ์ — ต้องบอกระบบก่อนว่าจะเข้าอันไหน
  // ------------------------------------------------------------
  function pickSide(next) {
    side = next;
    picker.hidden = true;
    form.hidden = false;
    lead.textContent = 'เข้าสู่ระบบฝั่ง' + LABEL[side];
    badgeText.textContent = (side === 'worker' ? '🛠️ ' : '🔍 ') + 'บัญชี' + LABEL[side];
    submitBtn.textContent = 'เข้าสู่ระบบฝั่ง' + LABEL[side];
    document.getElementById('email').focus();
    // จำไว้ให้หน้า "ลืมรหัสผ่าน" ใช้ต่อ
    try { sessionStorage.setItem('ct_login_side', side); } catch (e) { /* ปิด storage อยู่ */ }
  }

  picker.querySelectorAll('.sidebtn').forEach(function (btn) {
    btn.addEventListener('click', function () { pickSide(btn.dataset.side); });
  });

  document.getElementById('side-change').addEventListener('click', function () {
    side = null;
    form.hidden = true;
    picker.hidden = false;
    lead.textContent = 'เข้าสู่ระบบเพื่อใช้งาน ช่างไทย';
    UI.setFormError(form, null);
  });

  // มาจากลิงก์ /login?side=worker (เช่นกดจากหน้าแรก)
  const fromUrl = new URLSearchParams(location.search).get('side');
  if (fromUrl === 'worker' || fromUrl === 'employer') pickSide(fromUrl);

  // ------------------------------------------------------------
  //  toggle password
  // ------------------------------------------------------------
  const toggle = form.querySelector('[data-toggle-password]');
  const passInput = document.getElementById('password');
  toggle?.addEventListener('click', () => {
    const isPwd = passInput.type === 'password';
    passInput.type = isPwd ? 'text' : 'password';
    toggle.textContent = isPwd ? '🙈' : '👁';
  });

  // ------------------------------------------------------------
  //  ขั้นที่ 2: ล็อกอิน
  // ------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearFieldErrors(form);
    UI.setFormError(form, null);
    if (!side) return;

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
        user_account_type: side,
      });
      Auth.setToken(res.token);
      Auth.setUser(res.user);

      // บัญชีช่างที่ยังไม่ได้สร้างโปรไฟล์ช่าง → พาไปตั้งค่าก่อน
      if (res.user.user_account_type === 'worker' && res.user.user_role !== 'worker') {
        location.replace('/become-worker');
        return;
      }
      location.replace('/home');
    } catch (err) {
      // กดผิดฝั่ง — backend บอกมาว่าอีเมลนี้อยู่ฝั่งไหน ให้ปุ่มสลับไปเลย
      if (err.data && err.data.wrong_side) {
        const correct = err.data.correct_account_type;
        UI.setFormError(form, err.message);
        UI.toast('กำลังสลับไปฝั่ง' + LABEL[correct] + ' ให้', 'info');
        setTimeout(function () {
          pickSide(correct);
          document.getElementById('email').value = email;
          document.getElementById('password').value = password;
          UI.setFormError(form, null);
        }, 1200);
        return;
      }
      UI.setFormError(form, err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      UI.setBtnLoading(submitBtn, false);
    }
  });
})();
