// /forgot-password
(function () {
  'use strict';

  const form = document.getElementById('forgot-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const resultArea = document.getElementById('result-area');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearFieldErrors(form);
    UI.setFormError(form, null);
    resultArea.classList.add('hidden');

    const email = document.getElementById('email').value.trim();
    const err = UI.Validators.email(email);
    if (err) {
      UI.setFieldError('email', err);
      return;
    }

    UI.setBtnLoading(submitBtn, true);
    try {
      const res = await Api.post('/auth/forgot-password', { user_email: email });
      resultArea.classList.remove('hidden');
      resultArea.innerHTML = `
        <div class="alert alert--success">
          <span class="alert__icon">✓</span>
          <span>${UI.escapeHtml(res.message || 'ถ้ามีอีเมลนี้ในระบบ ลิงก์รีเซ็ตจะถูกส่งให้')}</span>
        </div>
        ${res.reset_token ? `
          <div class="alert alert--dev">
            <span class="alert__icon">🛠</span>
            <div>
              <div><strong>Dev mode</strong> — production จะส่งทางอีเมลจริง</div>
              <a href="/reset-password?token=${encodeURIComponent(res.reset_token)}" class="btn btn--soft btn--sm" style="margin-top: 8px;">
                ใช้ token ที่ได้รับ
              </a>
            </div>
          </div>
        ` : ''}
      `;
    } catch (err) {
      UI.setFormError(form, err.message || 'ขอลิงก์ไม่สำเร็จ');
    } finally {
      UI.setBtnLoading(submitBtn, false);
    }
  });
})();
