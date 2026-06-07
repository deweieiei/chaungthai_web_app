// /jobs/:id — รายละเอียดงาน + ปุ่ม action ตาม role/status
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const root = document.getElementById('job-detail');
  const jobId = root.dataset.jobId;
  const me = Auth.getUser();
  const meId = me && me.user_id;

  // ---------- action map ----------
  // ปุ่มที่กดได้ ขึ้นกับ role + current status
  function buildActions(job, myRole) {
    const st = job.job_status;
    const actions = [];

    if (myRole === 'worker') {
      if (st === 'pending') {
        actions.push({ label: 'รับงาน', target: 'not_started', primary: true });
        actions.push({ label: 'ปฏิเสธ', target: 'declined', danger: true });
      } else if (st === 'not_started') {
        actions.push({ label: 'เริ่มดำเนินงาน', target: 'in_progress', primary: true });
        actions.push({ label: 'ยกเลิกงาน', target: 'cancelled', danger: true });
      } else if (st === 'in_progress') {
        actions.push({ label: 'งานเสร็จแล้ว', target: 'completed', primary: true });
        actions.push({ label: 'ยกเลิกงาน', target: 'cancelled', danger: true });
      }
    } else if (myRole === 'employer') {
      if (st === 'pending' || st === 'not_started' || st === 'in_progress') {
        actions.push({ label: 'ยกเลิกงาน', target: 'cancelled', danger: true });
      }
    }
    return actions;
  }

  function render(job) {
    const myRole = job.job_employer_id === meId ? 'employer'
                : job.job_worker_id === meId ? 'worker'
                : null;
    const peer = myRole === 'employer'
      ? { name: (job.worker_name || '') + ' ' + (job.worker_lastname || ''), image: job.worker_image, label: 'ช่าง', userId: job.job_worker_id }
      : { name: (job.employer_name || '') + ' ' + (job.employer_lastname || ''), image: job.employer_image, label: 'ผู้ว่าจ้าง', userId: job.job_employer_id };

    const actions = buildActions(job, myRole);
    const actionsHtml = actions.length === 0 ? '' : `
      <div class="card">
        <div class="card__title">การจัดการงาน</div>
        <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
          ${actions.map((a) => `
            <button class="btn ${a.primary ? 'btn--primary' : a.danger ? 'btn--danger' : 'btn--outline'} btn--block"
                    data-target="${a.target}">${UI.escapeHtml(a.label)}</button>
          `).join('')}
        </div>
      </div>`;

    // ticket warning ตอน worker จะรับงาน
    const ticketsInfo = (myRole === 'worker' && job.job_status === 'pending' && job.worker_job_tickets !== undefined)
      ? `<div class="text-tiny text-muted" style="margin-top: -4px;">บัตรรับงานคงเหลือ ${job.worker_job_tickets} ใบ · จะหัก 1 ใบเมื่อกดรับ</div>`
      : '';

    // chip "ฉันจ้าง / ฉันรับ" ที่บอก role ของฉัน
    const roleChip = myRole === 'employer'
      ? '<span class="job-card__role job-card__role--employer">💼 ฉันจ้าง</span>'
      : myRole === 'worker'
        ? '<span class="job-card__role job-card__role--worker">🔨 ฉันรับ</span>'
        : '';

    // ป้ายยกเลิก/ปฏิเสธโดยใคร
    let cancelNote = '';
    if (job.job_status === 'cancelled' || job.job_status === 'declined') {
      const byId = job.job_cancelled_by;
      let byLabel = 'ไม่ทราบ';
      if (byId) {
        const byRole = byId === job.job_employer_id ? 'employer' : 'worker';
        byLabel = byId === meId
          ? 'คุณ'
          : (byRole === 'employer' ? 'ผู้ว่าจ้าง' : 'ช่าง');
      }
      const verb = job.job_status === 'declined' ? 'ปฏิเสธ' : 'ยกเลิก';
      cancelNote = `<div class="job-detail__cancel-note">⚠ ${verb}โดย${byLabel}</div>`;
    }

    root.innerHTML = `
      <div class="job-detail__header">
        ${roleChip}
        ${JobHelpers.statusBadge(job.job_status)}
      </div>
      ${cancelNote}

      <div class="card">
        <div class="card__title">${UI.escapeHtml(peer.label)}</div>
        <a href="/chat/${peer.userId}" style="display:flex; align-items:center; gap: var(--space-sm); text-decoration:none; color:inherit;">
          ${UI.avatar({ user_name: peer.name, user_image: peer.image }, 'md')}
          <div style="flex:1; min-width:0;">
            <div class="text-bold">${UI.escapeHtml(peer.name.trim() || 'ผู้ใช้')}</div>
            <div class="text-tiny text-muted">แตะเพื่อแชต</div>
          </div>
          <span class="card-list__trail">›</span>
        </a>
      </div>

      <div class="card">
        <div class="card__title">📝 รายละเอียดงาน</div>
        <div style="white-space: pre-wrap;">${UI.escapeHtml(job.job_detail)}</div>
      </div>

      <div class="card">
        <div class="card__title">💰 ราคา</div>
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">
          ${JobHelpers.formatPrice(job.job_price)} <span class="text-small text-muted">บาท</span>
        </div>
      </div>

      <div class="card">
        <div class="card__title">📅 ระยะเวลา</div>
        <div class="card-list" style="margin: -4px -16px -16px;">
          <div class="card-list__item">
            <div class="card-list__main">
              <div class="card-list__label">วันที่เริ่ม</div>
              <div class="card-list__value">${JobHelpers.formatDate(job.job_start_date)}</div>
            </div>
          </div>
          <div class="card-list__item">
            <div class="card-list__main">
              <div class="card-list__label">วันที่ต้องเสร็จ</div>
              <div class="card-list__value">${JobHelpers.formatDate(job.job_deadline)}</div>
            </div>
          </div>
        </div>
      </div>

      ${ticketsInfo}
      ${actionsHtml}
    `;

    // ผูก event ปุ่ม
    root.querySelectorAll('button[data-target]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const target = btn.dataset.target;
        const confirmMsg = {
          declined:    { title: 'ปฏิเสธงาน?', message: 'งานจะถูกยกเลิก ผู้จ้างจะเห็นว่าคุณปฏิเสธ' },
          cancelled:   { title: 'ยกเลิกงาน?', message: 'งานจะถูกยกเลิกถาวร' + (myRole === 'worker' && (job.job_status === 'not_started' || job.job_status === 'in_progress') ? ' · บัตรรับงานที่ใช้ไปแล้วจะไม่คืน' : '') },
          not_started: null, // not_started — no confirm
          in_progress: null,
          completed:   { title: 'ยืนยันงานเสร็จ?', message: 'จะแจ้งผู้ว่าจ้างทันที' },
        }[target];

        if (confirmMsg) {
          const ok = await UI.confirm({
            title: confirmMsg.title,
            message: confirmMsg.message,
            confirmLabel: 'ยืนยัน',
            danger: target === 'declined' || target === 'cancelled',
          });
          if (!ok) return;
        }

        UI.setBtnLoading(btn, true);
        try {
          await Api.patch('/jobs/' + jobId + '/status', { status: target });
          UI.toast('อัปเดตสถานะสำเร็จ', 'success');
          load();
        } catch (err) {
          UI.toast(err.message || 'อัปเดตไม่สำเร็จ', 'danger');
          UI.setBtnLoading(btn, false);
        }
      });
    });
  }

  async function load() {
    try {
      const res = await Api.get('/jobs/' + jobId);
      render(res.job);
    } catch (err) {
      const status = err.status;
      root.innerHTML = `<div class="empty-state">
        <div class="empty-state__icon">${status === 404 ? '🚫' : '⚠'}</div>
        <div class="empty-state__title">${status === 404 ? 'ไม่พบงาน' : 'โหลดงานไม่สำเร็จ'}</div>
        <p class="text-muted text-small">${UI.escapeHtml(err.message || '')}</p>
        <a href="/jobs" class="btn btn--outline btn--sm" style="margin-top: 12px;">กลับ</a>
      </div>`;
    }
  }

  load();
})();
