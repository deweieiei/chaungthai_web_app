// /register
(function () {
  'use strict';
  if (!Auth.guestOnly()) return;

  const LABEL = { employer: 'ผู้ว่าจ้าง', worker: 'ช่าง' };

  const form = document.getElementById('register-form');
  const submitBtn = document.getElementById('reg-submit');
  const picker = document.getElementById('side-picker');
  const lead = document.getElementById('reg-lead');
  const badgeText = document.getElementById('side-badge-text');

  let side = null;   // 'employer' | 'worker'

  // ------------------------------------------------------------
  //  ขั้นที่ 1: เลือกฝั่ง — 2 ฝั่งเป็นคนละบัญชีกันสมบูรณ์
  // ------------------------------------------------------------
  function pickSide(next) {
    side = next;
    picker.hidden = true;
    form.hidden = false;
    lead.textContent = 'สมัครบัญชี' + LABEL[side];
    badgeText.textContent = (side === 'worker' ? '🛠️ ' : '🔍 ') + 'บัญชี' + LABEL[side];
    submitBtn.textContent = 'สมัครบัญชี' + LABEL[side];
    document.getElementById('name').focus();
  }

  picker.querySelectorAll('.sidebtn').forEach(function (btn) {
    btn.addEventListener('click', function () { pickSide(btn.dataset.side); });
  });

  document.getElementById('side-change').addEventListener('click', function () {
    side = null;
    form.hidden = true;
    picker.hidden = false;
    lead.textContent = 'เริ่มใช้งาน ช่างไทย ฟรี';
    UI.setFormError(form, null);
  });

  // มาจากลิงก์ /register?side=worker (ปุ่ม "สมัครเป็นช่าง" ในหน้าแรก)
  const fromUrl = new URLSearchParams(location.search).get('side');
  if (fromUrl === 'worker' || fromUrl === 'employer') pickSide(fromUrl);

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
    if (!side) return;

    const name = document.getElementById('name').value.trim();
    const lastname = document.getElementById('lastname').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;
    const agreeEl = document.getElementById('agree');
    const agreed = !!(agreeEl && agreeEl.checked);

    const errs = {
      name: UI.Validators.required(name, 'ชื่อ'),
      email: UI.Validators.email(email),
      password: UI.Validators.password(password),
      confirm: UI.Validators.match(confirm, password, 'รหัสผ่าน'),
      agree: agreed ? null : 'กรุณายอมรับข้อตกลงและนโยบายความเป็นส่วนตัว',
    };
    let hasErr = false;
    for (const [k, v] of Object.entries(errs)) {
      if (v) { UI.setFieldError(k, v); hasErr = true; }
    }
    // visual error สำหรับ checkbox (ไม่มี id="agree-error" แบบ field)
    const agreeLabel = document.querySelector('label[for="agree"]');
    if (agreeLabel) agreeLabel.classList.toggle('check--error', !agreed);
    if (hasErr) return;

    UI.setBtnLoading(submitBtn, true);
    try {
      await Api.post('/auth/register', {
        user_name: name,
        user_lastname: lastname || undefined,
        user_email: email,
        user_password: password,
        user_account_type: side,
      });
      UI.toast('สมัครบัญชี' + LABEL[side] + 'สำเร็จ — เข้าสู่ระบบได้เลย', 'success');
      setTimeout(() => location.replace('/login?side=' + side), 800);
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
