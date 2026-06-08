// /verify-email — ใช้ OTP 6 หลัก (เลียนแบบ verify-phone)
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const elIcon = document.getElementById('email-icon');
  const elTitle = document.getElementById('email-title');
  const elDisplay = document.getElementById('email-display');
  const elContent = document.getElementById('content-area');

  let countdown = 0;
  let countdownTimer = null;

  function render() {
    const u = Auth.getUser() || {};
    const email = u.user_email || '';
    const verified = !!u.user_email_verified_at;
    elDisplay.textContent = email || '-';
    elIcon.textContent = verified ? '✅' : '✉';
    elTitle.textContent = verified ? 'ยืนยันอีเมลแล้ว' : 'อีเมลของคุณ';

    if (verified) {
      elContent.innerHTML = `<a href="/profile" class="btn btn--primary btn--block">กลับ</a>`;
      return;
    }
    if (!email) {
      elContent.innerHTML = `
        <p class="text-muted text-center">ไม่มีอีเมลในระบบ</p>`;
      return;
    }

    elContent.innerHTML = `
      <button class="btn btn--soft btn--block" id="request-btn">ส่งรหัส OTP</button>
      <div id="dev-area" class="hidden" style="margin-top: var(--space-md);"></div>
      <div class="field" style="margin-top: var(--space-md);">
        <label class="field__label" for="otp">รหัส OTP (6 หลัก)</label>
        <input class="input otp-input" type="text" id="otp" maxlength="6" inputmode="numeric" pattern="[0-9]*">
        <div class="field__error" id="otp-error"></div>
      </div>
      <button class="btn btn--primary btn--block" id="confirm-btn">ยืนยัน OTP</button>
    `;

    document.getElementById('request-btn').addEventListener('click', requestOtp);
    document.getElementById('confirm-btn').addEventListener('click', confirmOtp);
    const otpInput = document.getElementById('otp');
    otpInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
  }

  function setRequestBtnState() {
    const btn = document.getElementById('request-btn');
    if (!btn) return;
    if (countdown > 0) {
      btn.disabled = true;
      btn.textContent = `ขอใหม่ใน ${countdown} วินาที`;
    } else {
      btn.disabled = false;
      btn.textContent = 'ส่งรหัส OTP';
    }
  }

  function startCountdown(seconds) {
    countdown = seconds;
    setRequestBtnState();
    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      countdown--;
      setRequestBtnState();
      if (countdown <= 0) clearInterval(countdownTimer);
    }, 1000);
  }

  async function requestOtp(e) {
    const btn = e.currentTarget;
    UI.setBtnLoading(btn, true);
    try {
      const res = await Api.post('/auth/verify-email/request');
      UI.toast('ส่งรหัส OTP ไปยังอีเมลแล้ว');
      startCountdown(60);
      if (res.otp_code) {
        const dev = document.getElementById('dev-area');
        dev.classList.remove('hidden');
        dev.innerHTML = `
          <div class="alert alert--dev">
            <span class="alert__icon">🛠</span>
            <div>
              <div><strong>Dev mode — OTP:</strong> ${UI.escapeHtml(res.otp_code)}</div>
              <button class="btn btn--soft btn--sm" id="auto-fill-btn" style="margin-top: 8px;">Auto-fill OTP</button>
            </div>
          </div>`;
        document.getElementById('auto-fill-btn').addEventListener('click', () => {
          document.getElementById('otp').value = res.otp_code;
        });
      }
    } catch (err) {
      UI.setBtnLoading(btn, false);
      if (err.status === 409) {
        // ยืนยันแล้ว → refresh
        await refreshUser();
        render();
        return;
      }
      UI.toast(err.message || 'ขอ OTP ไม่สำเร็จ', 'danger');
      return;
    }
    UI.setBtnLoading(btn, false);
    setRequestBtnState();
  }

  async function confirmOtp(e) {
    const btn = e.currentTarget;
    const otp = document.getElementById('otp').value.trim();
    UI.setFieldError('otp', null);
    const err = UI.Validators.otp(otp);
    if (err) {
      UI.setFieldError('otp', err);
      return;
    }
    UI.setBtnLoading(btn, true);
    try {
      await Api.post('/auth/verify-email/confirm', { otp_code: otp });
      await refreshUser();
      UI.toast('ยืนยันอีเมลสำเร็จ', 'success');
      setTimeout(() => location.assign('/profile'), 700);
    } catch (e2) {
      UI.setFieldError('otp', e2.message || 'OTP ไม่ถูกต้อง');
    } finally {
      UI.setBtnLoading(btn, false);
    }
  }

  async function refreshUser() {
    const u = Auth.getUser();
    if (!u) return;
    try {
      const res = await Api.get('/users/' + u.user_id);
      Auth.setUser(res.user);
    } catch {}
  }

  render();
})();
