// /worker/crime-document
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const root = document.getElementById('crime-root');

  function statusBlock(w) {
    if (w && w.worker_crime_checked_at) {
      return `
        <div class="alert alert--success">
          <span class="alert__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </span>
          <span>ยื่นเอกสารแล้ว · ${UI.formatThaiDate(w.worker_crime_checked_at)}</span>
        </div>`;
    }
    return `
      <div class="alert alert--warning">
        <span class="alert__icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
        </span>
        <span>ยังไม่ได้ยืนยัน — กรุณาอัพโหลดเอกสารเพื่อเปิดรับงาน</span>
      </div>`;
  }

  function render(w) {
    const hasDoc = !!(w && w.worker_crime_checked_at);
    root.innerHTML = `
      <div class="text-center" style="margin-top: var(--space-md);">
        <div style="width: 88px; height: 88px; margin: 0 auto var(--space-md); background: var(--primary-soft); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary);">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
        </div>
        <h2 style="font-weight: 800;">ประวัติอาชญากรรม</h2>
        <p class="text-muted text-small">อัพโหลดเอกสารตรวจประวัติเพื่อยืนยันตัวตน</p>
      </div>

      ${statusBlock(w)}

      <div class="card">
        <h3 class="card__title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
          ${hasDoc ? 'อัพโหลดใหม่' : 'อัพโหลดเอกสาร'}
        </h3>
        <p class="text-small text-muted" style="margin-top: 4px;">
          รองรับไฟล์ PDF, JPG, PNG, WEBP — ขนาดไม่เกิน 5 MB
        </p>

        <form id="crime-form" novalidate style="margin-top: var(--space-md);">
          <div data-form-error></div>

          <div class="field">
            <label class="field__label" for="document">เลือกไฟล์</label>
            <input class="input" type="file" id="document" accept=".pdf,image/jpeg,image/png,image/webp">
            <span class="field__hint">เลือกใบรับรองประวัติอาชญากรรมหรือสำเนาที่ขีดคร่อม</span>
            <div class="field__error" id="document-error"></div>
          </div>

          <button type="submit" class="btn btn--primary btn--block btn--lg" id="upload-btn">
            อัพโหลด
          </button>
        </form>
      </div>

      <div class="card card--flat" style="margin-top: var(--space-md);">
        <p class="text-tiny text-faint">
          * ระบบจะบันทึกวันที่ยื่นเอกสารโดยอัตโนมัติ และเจ้าหน้าที่จะตรวจสอบในภายหลัง
          การยื่นเอกสารเท็จอาจทำให้บัญชีถูกระงับ
        </p>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    const form = document.getElementById('crime-form');
    const btn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('document');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      UI.clearFieldErrors(form);
      UI.setFormError(form, null);

      const file = fileInput.files[0];
      if (!file) {
        UI.setFieldError('document', 'กรุณาเลือกไฟล์');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        UI.setFieldError('document', 'ไฟล์ใหญ่เกิน 5 MB');
        return;
      }

      UI.setBtnLoading(btn, true);
      try {
        const u = Auth.getUser();
        const wid = await resolveWorkerId(u);
        if (!wid) throw new Error('หา worker_id ไม่เจอ');

        const fd = new FormData();
        fd.append('document', file);
        const res = await Api.upload('/workers/' + wid + '/crime-document', fd);
        UI.toast('อัพโหลดสำเร็จ', 'success');
        // re-render with new state
        await load();
      } catch (err) {
        UI.setFormError(form, err.message || 'อัพโหลดไม่สำเร็จ');
      } finally {
        UI.setBtnLoading(btn, false);
      }
    });
  }

  async function load() {
    const u = Auth.getUser();
    if (!u || u.user_role !== 'worker') {
      root.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">⚠</div>
        <div class="empty-state__title">ยังไม่ได้เป็นช่าง</div>
        <a href="/profile" class="btn btn--outline btn--sm" style="margin-top: 12px;">กลับโปรไฟล์</a>
      </div>`;
      return;
    }
    try {
      const wid = await resolveWorkerId(u);
      if (!wid) {
        root.innerHTML = `<div class="empty-state">
          <div class="empty-state__icon">⚠</div>
          <div class="empty-state__title">หา worker_id ไม่เจอ</div>
        </div>`;
        return;
      }
      const detail = await Api.get('/workers/' + wid);
      render(detail.worker);
    } catch (err) {
      root.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">⚠</div>
        <div class="empty-state__title">โหลดข้อมูลไม่ได้</div>
        <p class="text-muted text-small">${UI.escapeHtml(err.message || '')}</p>
      </div>`;
    }
  }

  load();
})();
