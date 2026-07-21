// /worker/portfolio
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const root = document.getElementById('portfolio-root');
  let workerId = null;
  let images = [];

  const MAX_IMAGES = 20;

  function imgUrl(p) {
    return (window.resolveImageUrl || ((x) => x))(p.worker_resume_image_url);
  }

  function render() {
    const isFull = images.length >= MAX_IMAGES;

    const grid = images.length === 0
      ? `<div class="empty-state">
          <div class="empty-state__icon" aria-hidden="true">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>
          </div>
          <div class="empty-state__title">ยังไม่มีรูปผลงาน</div>
          <p class="text-muted text-small">อัพโหลดภาพผลงานเพื่อให้ลูกค้าเห็นฝีมือคุณ</p>
        </div>`
      : `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-sm);">
          ${images.map((p) => `
            <div class="portfolio-tile">
              <a href="${UI.escapeHtml(imgUrl(p))}" target="_blank" class="portfolio-tile__img">
                <img src="${UI.escapeHtml(imgUrl(p))}" alt="${UI.escapeHtml(p.worker_resume_image_caption || '')}">
              </a>
              ${p.worker_resume_image_caption ? `<div class="portfolio-tile__caption">${UI.escapeHtml(p.worker_resume_image_caption)}</div>` : ''}
              <button type="button" class="portfolio-tile__delete" data-img-id="${p.worker_resume_image_id}" aria-label="ลบ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          `).join('')}
        </div>`;

    const uploadForm = isFull
      ? `<div class="alert alert--info">
          <span class="alert__icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          </span>
          <span>มีรูปครบ ${MAX_IMAGES} ภาพแล้ว — ลบบางอันก่อนเพื่อเพิ่มใหม่</span>
        </div>`
      : `<div class="card card--elevated">
          <h3 class="card__title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            อัพโหลดรูปผลงาน (${images.length}/${MAX_IMAGES})
          </h3>
          <form id="upload-form" novalidate style="margin-top: var(--space-sm);">
            <div data-form-error></div>
            <div class="field">
              <label class="field__label" for="image">ไฟล์รูป</label>
              <input class="input" type="file" id="image" accept="image/jpeg,image/png,image/webp">
              <span class="field__hint">jpg/png/webp · ไม่เกิน 5 MB</span>
              <div class="field__error" id="image-error"></div>
            </div>
            <div class="field" style="margin-bottom: 0;">
              <label class="field__label" for="caption">คำบรรยาย (ไม่บังคับ)</label>
              <input class="input" type="text" id="caption" placeholder="เช่น ติดตั้งโคมไฟห้องนอน" maxlength="255">
            </div>
            <button type="submit" class="btn btn--primary btn--block" id="upload-btn" style="margin-top: var(--space-md);">
              อัพโหลด
            </button>
          </form>
        </div>`;

    root.innerHTML = `
      <div style="margin-bottom: var(--space-md);">
        <h2 style="margin-bottom: 4px;">รีซูเม่ / ผลงาน</h2>
        <p class="text-small text-muted" style="margin: 0;">ผลงานช่วยให้ลูกค้ามั่นใจในฝีมือของคุณ</p>
      </div>

      ${uploadForm}

      <h3 class="section-title">ภาพผลงาน (${images.length})</h3>
      ${grid}
    `;

    bindEvents();
  }

  function bindEvents() {
    const form = document.getElementById('upload-form');
    if (form) {
      const btn = document.getElementById('upload-btn');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        UI.clearFieldErrors(form);
        UI.setFormError(form, null);

        const picked = document.getElementById('image').files[0];
        const caption = document.getElementById('caption').value.trim();

        if (!picked) {
          UI.setFieldError('image', 'กรุณาเลือกรูป');
          return;
        }

        UI.setBtnLoading(btn, true);

        // ย่อก่อนส่ง — รูปจากมือถือมักเกิน 5 MB จนอัปไม่ผ่าน
        // 1600px พอสำหรับดูผลงานเต็มจอ
        const file = await ImageCompress.prepareForUpload(picked, {
          maxSize: 1600, quality: 0.82,
        });
        if (!file) { UI.setBtnLoading(btn, false); return; }

        try {
          const fd = new FormData();
          fd.append('image', file);
          if (caption) fd.append('caption', caption);
          await Api.upload('/workers/' + workerId + '/resume-images', fd);
          UI.toast('อัพโหลดสำเร็จ', 'success');
          await loadImages();
        } catch (err) {
          UI.setFormError(form, err.message || 'อัพโหลดไม่สำเร็จ');
        } finally {
          UI.setBtnLoading(btn, false);
        }
      });
    }

    // delete buttons
    document.querySelectorAll('.portfolio-tile__delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const imgId = btn.dataset.imgId;
        const ok = await UI.confirm({
          title: 'ลบรูปนี้?',
          message: 'รูปจะหายถาวร',
          confirmLabel: 'ลบ',
          danger: true,
        });
        if (!ok) return;
        UI.showLoading();
        try {
          await Api.delete('/workers/' + workerId + '/resume-images/' + imgId);
          UI.toast('ลบสำเร็จ', 'success');
          await loadImages();
        } catch (err) {
          UI.toast(err.message || 'ลบไม่สำเร็จ', 'danger');
        } finally {
          UI.hideLoading();
        }
      });
    });
  }

  async function loadImages() {
    try {
      const detail = await Api.get('/workers/' + workerId);
      images = detail.portfolio_images || [];
      render();
    } catch (err) {
      root.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">⚠</div>
        <div class="empty-state__title">โหลดรูปไม่ได้</div>
        <p class="text-muted text-small">${UI.escapeHtml(err.message || '')}</p>
      </div>`;
    }
  }

  async function init() {
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
      workerId = await resolveWorkerId(u);
      if (!workerId) {
        root.innerHTML = `<div class="empty-state">
          <div class="empty-state__icon">⚠</div>
          <div class="empty-state__title">หา worker_id ไม่เจอ</div>
        </div>`;
        return;
      }
      await loadImages();
    } catch (err) {
      root.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">⚠</div>
        <div class="empty-state__title">โหลดข้อมูลไม่ได้</div>
        <p class="text-muted text-small">${UI.escapeHtml(err.message || '')}</p>
      </div>`;
    }
  }

  init();
})();
