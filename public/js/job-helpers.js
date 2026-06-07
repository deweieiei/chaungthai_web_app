// ============================================================
//  job-helpers.js — render helpers สำหรับ job card / detail / modal
//  ใช้ร่วมหลายหน้า (jobs list, job detail, chat composer)
// ============================================================
(function (global) {
  'use strict';

  const STATUS_LABEL = {
    pending:     'รอช่างตอบ',
    not_started: 'ยังไม่เริ่ม',
    in_progress: 'ระหว่างดำเนินงาน',
    completed:   'เสร็จแล้ว',
    declined:    'ปฏิเสธ',
    cancelled:   'ยกเลิก',
  };
  const STATUS_CLASS = {
    pending:     'job-status--pending',
    not_started: 'job-status--not-started',
    in_progress: 'job-status--in-progress',
    completed:   'job-status--completed',
    declined:    'job-status--declined',
    cancelled:   'job-status--cancelled',
  };

  function statusBadge(status) {
    return `<span class="job-status ${STATUS_CLASS[status] || ''}">${UI.escapeHtml(STATUS_LABEL[status] || status)}</span>`;
  }

  function formatPrice(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '0';
    return num.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function formatDate(iso) {
    if (!iso) return '-';
    // ตัด time ออก เก็บแค่ YYYY-MM-DD
    const datePart = String(iso).slice(0, 10);
    return UI.formatThaiDate(datePart);
  }

  // ---------- modal ฟอร์มจ้างงาน ----------
  // opts: { workerUserId, workerName, convId? }
  // returns Promise<boolean> — true ถ้าสร้างสำเร็จ
  function openHireModal(opts) {
    return new Promise((resolve) => {
      const today = new Date().toISOString().slice(0, 10);
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal__card" style="max-width: 420px;">
          <h3 class="modal__title">จ้างงาน ${UI.escapeHtml(opts.workerName || 'ช่าง')}</h3>
          <form id="hire-form" novalidate>
            <div class="field">
              <label class="field__label" for="hire-detail">รายละเอียดงาน <span class="text-danger">*</span></label>
              <textarea class="textarea" id="hire-detail" rows="3" placeholder="เช่น ทาสีห้องนั่งเล่น 4x5 เมตร สีขาวด้าน"></textarea>
              <div class="field__error" id="hire-detail-error"></div>
            </div>
            <div class="field">
              <label class="field__label" for="hire-price">ราคา (บาท) <span class="text-danger">*</span></label>
              <input class="input" type="number" id="hire-price" min="0" step="0.01" inputmode="decimal" placeholder="0">
              <div class="field__error" id="hire-price-error"></div>
            </div>
            <div class="field">
              <label class="field__label" for="hire-start">วันที่เริ่ม <span class="text-danger">*</span></label>
              <input class="input" type="date" id="hire-start" min="${today}" value="${today}">
              <div class="field__error" id="hire-start-error"></div>
            </div>
            <div class="field" style="margin-bottom: 0;">
              <label class="field__label" for="hire-deadline">วันที่ต้องเสร็จ <span class="text-danger">*</span></label>
              <input class="input" type="date" id="hire-deadline" min="${today}">
              <div class="field__error" id="hire-deadline-error"></div>
            </div>
            <div data-form-error style="margin-top: var(--space-sm);"></div>
            <div class="modal__actions">
              <button type="button" class="btn btn--ghost" data-act="cancel">ยกเลิก</button>
              <button type="submit" class="btn btn--primary">จ้างงาน</button>
            </div>
          </form>
        </div>`;
      document.body.appendChild(modal);

      const form = modal.querySelector('#hire-form');
      const elDetail = modal.querySelector('#hire-detail');
      const elPrice = modal.querySelector('#hire-price');
      const elStart = modal.querySelector('#hire-start');
      const elDeadline = modal.querySelector('#hire-deadline');
      const submitBtn = form.querySelector('button[type="submit"]');

      function close(result) {
        modal.remove();
        resolve(!!result);
      }

      modal.addEventListener('click', (e) => {
        if (e.target === modal) close(false);
        if (e.target.closest('[data-act="cancel"]')) close(false);
      });

      elStart.addEventListener('change', () => {
        elDeadline.min = elStart.value;
        if (elDeadline.value && elDeadline.value < elStart.value) {
          elDeadline.value = elStart.value;
        }
      });

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        UI.clearFieldErrors(form);
        UI.setFormError(form, null);

        const detail = elDetail.value.trim();
        const price = Number(elPrice.value);
        const startDate = elStart.value;
        const deadline = elDeadline.value;

        let bad = false;
        if (!detail) { UI.setFieldError('hire-detail', 'กรุณาใส่รายละเอียดงาน'); bad = true; }
        if (!Number.isFinite(price) || price < 0) { UI.setFieldError('hire-price', 'กรอกราคาให้ถูกต้อง'); bad = true; }
        if (!startDate) { UI.setFieldError('hire-start', 'เลือกวันที่เริ่ม'); bad = true; }
        if (!deadline) { UI.setFieldError('hire-deadline', 'เลือกวันที่ต้องเสร็จ'); bad = true; }
        if (startDate && deadline && deadline < startDate) {
          UI.setFieldError('hire-deadline', 'วันที่ต้องเสร็จต้องไม่เร็วกว่าวันที่เริ่ม'); bad = true;
        }
        if (bad) return;

        UI.setBtnLoading(submitBtn, true);
        try {
          const body = {
            worker_user_id: opts.workerUserId,
            detail,
            price,
            start_date: startDate,
            deadline,
          };
          if (opts.convId) body.conv_id = opts.convId;
          await Api.post('/jobs', body);
          UI.toast('จ้างงานสำเร็จ', 'success');
          close(true);
        } catch (err) {
          UI.setFormError(form, err.message || 'สร้างงานไม่สำเร็จ');
        } finally {
          UI.setBtnLoading(submitBtn, false);
        }
      });
    });
  }

  global.JobHelpers = {
    STATUS_LABEL,
    statusBadge,
    formatPrice,
    formatDate,
    openHireModal,
  };
})(window);
