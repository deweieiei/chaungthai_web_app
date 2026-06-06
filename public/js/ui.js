// ============================================================
//  ui.js — UI helpers
//  - toast(message, type)
//  - showLoading() / hideLoading()
//  - confirm() — promise-based modal
//  - $ / $$ shortcuts
//  - form helpers (setError, setLoading)
// ============================================================
(function (global) {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toast(message, type = 'info', durationMs = 2800) {
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' toast--' + type : '');
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.2s';
      setTimeout(() => t.remove(), 200);
    }, durationMs);
  }

  let loadingEl = null;
  function showLoading(text) {
    hideLoading();
    loadingEl = document.createElement('div');
    loadingEl.className = 'loading-overlay';
    loadingEl.innerHTML = `
      <div class="loading-overlay__card">
        <div class="spinner"></div>
        ${text ? `<div class="text-small text-muted">${escapeHtml(text)}</div>` : ''}
      </div>`;
    document.body.appendChild(loadingEl);
  }

  function hideLoading() {
    if (loadingEl) {
      loadingEl.remove();
      loadingEl = null;
    }
  }

  /** confirm dialog → resolve true/false */
  function confirmModal({ title, message, confirmLabel = 'ตกลง', cancelLabel = 'ยกเลิก', danger = false }) {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal__card">
          <h3 class="modal__title">${escapeHtml(title || 'ยืนยัน')}</h3>
          <div class="modal__body">${escapeHtml(message || '')}</div>
          <div class="modal__actions">
            <button class="btn btn--ghost" data-act="cancel">${escapeHtml(cancelLabel)}</button>
            <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-act="confirm">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>`;
      modal.addEventListener('click', (e) => {
        const act = e.target.closest('[data-act]');
        if (act) {
          modal.remove();
          resolve(act.dataset.act === 'confirm');
        } else if (e.target === modal) {
          modal.remove();
          resolve(false);
        }
      });
      document.body.appendChild(modal);
    });
  }

  /** ปุ่มแสดง loading state */
  function setBtnLoading(btn, loading, busyText) {
    if (!btn) return;
    if (loading) {
      btn.dataset._origText = btn.textContent;
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
      btn.innerHTML = '<span class="btn__spinner"></span>' + (busyText ? ` <span>${escapeHtml(busyText)}</span>` : '');
    } else {
      btn.removeAttribute('aria-busy');
      btn.disabled = false;
      if (btn.dataset._origText) {
        btn.textContent = btn.dataset._origText;
        delete btn.dataset._origText;
      }
    }
  }

  /** แสดง error ใต้ฟิลด์ที่มี id `${name}-error` */
  function setFieldError(name, message) {
    const el = document.getElementById(name + '-error');
    if (el) {
      el.textContent = message || '';
      el.style.display = message ? 'block' : 'none';
    }
    const input = document.getElementById(name);
    if (input) {
      input.classList.toggle('input--error', !!message);
    }
  }

  function clearFieldErrors(form) {
    if (!form) return;
    $$('.field__error', form).forEach((el) => {
      el.textContent = '';
      el.style.display = 'none';
    });
    $$('.input--error', form).forEach((el) => el.classList.remove('input--error'));
  }

  function setFormError(form, message) {
    const el = $('[data-form-error]', form);
    if (!el) return;
    if (!message) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }
    el.style.display = '';
    el.innerHTML = `<div class="alert alert--danger"><span class="alert__icon">⚠</span><span>${escapeHtml(message)}</span></div>`;
  }

  /** Validate ภาษาไทย */
  const Validators = {
    email(v) {
      if (!v || !v.trim()) return 'กรุณากรอกอีเมล';
      if (!/^[\w.\-]+@[\w\-]+(\.[\w\-]+)+$/.test(v.trim())) return 'รูปแบบอีเมลไม่ถูกต้อง';
      return null;
    },
    password(v) {
      if (!v) return 'กรุณากรอกรหัสผ่าน';
      if (v.length < 8) return 'รหัสผ่านอย่างน้อย 8 ตัวอักษร';
      return null;
    },
    required(v, field) {
      if (!v || !String(v).trim()) return 'กรุณากรอก' + (field || 'ข้อมูล');
      return null;
    },
    phone(v) {
      if (!v || !v.trim()) return null;
      const digits = v.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 10) return 'เบอร์โทรไม่ถูกต้อง';
      return null;
    },
    match(v, other, label) {
      if (v !== other) return (label || 'ค่า') + 'ไม่ตรงกัน';
      return null;
    },
    otp(v) {
      if (!v) return 'กรุณากรอกรหัส OTP';
      if (!/^\d{6}$/.test(v)) return 'OTP ต้องเป็นตัวเลข 6 หลัก';
      return null;
    },
  };

  /** วันที่ไทย — "2001-05-09" → "9 พ.ค. 2544" */
  const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  function formatThaiDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
  }

  /** initial ของชื่อ → '?' fallback */
  function initial(name) {
    if (!name) return '?';
    const ch = String(name).trim()[0];
    return ch ? ch.toUpperCase() : '?';
  }

  /** Render avatar HTML — รับ user object หรือ {image,name} */
  function avatar(u, size = 'md') {
    const cls = 'avatar avatar--' + size;
    const name = u && (u.fullName || u.user_name || u.name) || '';
    const img = u && (u.image || u.user_image);
    const url = img && global.resolveImageUrl ? global.resolveImageUrl(img) : img;
    if (url) {
      return `<span class="${cls}"><img src="${escapeHtml(url)}" alt=""></span>`;
    }
    return `<span class="${cls}">${escapeHtml(initial(name))}</span>`;
  }

  global.UI = {
    $, $$,
    escapeHtml,
    toast,
    showLoading, hideLoading,
    confirm: confirmModal,
    setBtnLoading,
    setFieldError, clearFieldErrors, setFormError,
    Validators,
    formatThaiDate,
    initial,
    avatar,
  };
})(window);
