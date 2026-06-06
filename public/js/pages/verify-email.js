// /verify-email
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const elIcon = document.getElementById('email-icon');
  const elTitle = document.getElementById('email-title');
  const elDisplay = document.getElementById('email-display');
  const elContent = document.getElementById('content-area');

  function render() {
    const u = Auth.getUser() || {};
    elDisplay.textContent = u.user_email || '-';
    const verified = !!u.user_email_verified_at;
    elIcon.textContent = verified ? '✅' : '✉';
    elTitle.textContent = verified ? 'ยืนยันอีเมลแล้ว' : 'อีเมลของคุณ';

    if (verified) {
      elContent.innerHTML = `<a href="/profile" class="btn btn--primary btn--block">กลับ</a>`;
    } else {
      elContent.innerHTML = `
        <div id="msg-area"></div>
        <button class="btn btn--primary btn--block" id="request-btn">ส่งลิงก์ยืนยันไปที่อีเมล</button>
        <div id="dev-area" class="hidden" style="margin-top: var(--space-md);"></div>
      `;
      document.getElementById('request-btn').addEventListener('click', requestVerify);
    }
  }

  async function requestVerify(e) {
    const btn = e.currentTarget;
    document.getElementById('msg-area').innerHTML = '';
    UI.setBtnLoading(btn, true);
    try {
      const res = await Api.post('/auth/verify-email/request');
      document.getElementById('msg-area').innerHTML = `
        <div class="alert alert--info">
          <span class="alert__icon">ℹ</span>
          <span>${UI.escapeHtml(res.message || 'ส่งลิงก์ยืนยันไปยังอีเมลแล้ว')}</span>
        </div>`;

      if (res.verify_token) {
        const dev = document.getElementById('dev-area');
        dev.classList.remove('hidden');
        dev.innerHTML = `
          <div class="alert alert--dev">
            <span class="alert__icon">🛠</span>
            <div>
              <div><strong>Dev mode</strong> — production จะส่งทางอีเมลจริง</div>
              <button class="btn btn--soft btn--sm" id="auto-confirm-btn" style="margin-top: 8px;">Auto-confirm (mock)</button>
            </div>
          </div>`;
        document.getElementById('auto-confirm-btn').addEventListener('click', () => confirmVerify(res.verify_token));
      }
    } catch (err) {
      if (err.status === 409) {
        await refreshUser();
        render();
      } else {
        document.getElementById('msg-area').innerHTML = `
          <div class="alert alert--danger"><span class="alert__icon">⚠</span><span>${UI.escapeHtml(err.message)}</span></div>`;
      }
    } finally {
      UI.setBtnLoading(btn, false);
    }
  }

  async function confirmVerify(token) {
    UI.showLoading();
    try {
      await Api.post('/auth/verify-email/confirm', { token });
      await refreshUser();
      UI.toast('ยืนยันอีเมลสำเร็จ', 'success');
      setTimeout(() => location.assign('/profile'), 700);
    } catch (err) {
      UI.toast(err.message || 'ยืนยันไม่สำเร็จ', 'danger');
    } finally {
      UI.hideLoading();
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
