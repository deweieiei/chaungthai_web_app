// /become-worker
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const form = document.querySelector('.app-shell');
  const submitBtn = document.getElementById('submit-btn');
  const elRadius = document.getElementById('radius');
  const elCoord = document.getElementById('pin-coord');
  let selectedSet = new Set();

  // ------------------------------------------------------------
  //  ปักหมุดจุดรับงาน
  // ------------------------------------------------------------
  let pinMap = null;
  let pin = null;          // [lat, lng]
  let radiusCircle = null;

  function paintCoord() {
    elCoord.textContent = pin
      ? 'จุดรับงาน: ' + pin[0].toFixed(4) + ', ' + pin[1].toFixed(4)
      : 'ยังไม่ได้ปักหมุด';
  }

  elRadius.addEventListener('change', function () {
    if (radiusCircle) radiusCircle.setRadius(Number(elRadius.value) * 1000);
  });

  document.getElementById('btn-my-location').addEventListener('click', async function () {
    this.disabled = true;
    const pos = await CtMap.locate();
    this.disabled = false;
    if (!pos) {
      UI.toast('ขอตำแหน่งไม่สำเร็จ — เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์ก่อน', 'warning');
      return;
    }
    pin = pos;
    pinMap.setView(pos, 15);
    if (radiusCircle) radiusCircle.setLatLng(pos);
    paintCoord();
  });

  (async function initPinMap() {
    try {
      await CtMap.ensureLeaflet();
    } catch (err) {
      elCoord.textContent = 'โหลดแผนที่ไม่สำเร็จ — สมัครได้ แล้วค่อยปักหมุดทีหลัง';
      return;
    }

    let start = await CtMap.locate(6000);
    if (!start) start = CtMap.DEFAULT_CENTER;

    pinMap = CtMap.create('#pin-map', { center: start, zoom: 14, scrollWheelZoom: false });
    radiusCircle = L.circle(start, {
      radius: Number(elRadius.value) * 1000,
      color: '#970000',
      weight: 1.5,
      fillColor: '#970000',
      fillOpacity: 0.08,
    }).addTo(pinMap);

    CtMap.pinMarker(pinMap, start, function (lat, lng) {
      pin = [lat, lng];
      radiusCircle.setLatLng(pin);
      paintCoord();
    });

    pin = start;
    paintCoord();
  })();

  function updateBtn() {
    submitBtn.textContent = `สมัครเป็นช่าง (${selectedSet.size} สกิล)`;
  }

  let picker;
  SkillTree.mount('#skill-mount', {
    selected: [],
    max: 50,
    onChange: (s) => {
      selectedSet = s;
      updateBtn();
    },
  }).then((p) => { picker = p; });

  submitBtn.addEventListener('click', async () => {
    UI.setFormError(form, null);
    if (selectedSet.size === 0) {
      UI.setFormError(form, 'กรุณาเลือกสกิลอย่างน้อย 1 อัน');
      return;
    }
    const resume = document.getElementById('resume').value.trim();

    UI.setBtnLoading(submitBtn, true);
    try {
      const res = await Api.post('/workers', {
        worker_resume: resume || undefined,
        skill_ids: Array.from(selectedSet),
        worker_lat: pin ? pin[0] : undefined,
        worker_lng: pin ? pin[1] : undefined,
        worker_service_radius_km: Number(elRadius.value),
      });
      // อัปเดต role + worker_id ใน storage (ใช้ในหน้า edit-skills/home)
      const u = Auth.getUser();
      if (u) Auth.setUser({ ...u, user_role: 'worker' });
      if (res.worker_id) Auth.setWorkerId(res.worker_id);

      const ok = await new Promise((resolve) => {
        const m = document.createElement('div');
        m.className = 'modal';
        m.innerHTML = `
          <div class="modal__card text-center">
            <div style="font-size: 56px;">🎉</div>
            <h3 class="modal__title">สมัครเป็นช่างสำเร็จ!</h3>
            <div class="modal__body">
              คุณได้รับบัตรรับงานเริ่มต้น <strong>${res.worker_job_tickets} ใบ</strong><br>
              เลือกสกิลแล้ว <strong>${res.skill_count} อัน</strong><br>
              ${res.has_pin
                ? 'ปักหมุดแล้ว — คุณจะขึ้นบนแผนที่ให้คนแถวนั้นเห็นทันที 🗺️'
                : '<span style="color:var(--warning)">ยังไม่ได้ปักหมุด — ไปปักในหน้าโปรไฟล์เพื่อให้ขึ้นแผนที่</span>'}
            </div>
            <button class="btn btn--primary btn--block" data-act="ok">ไปหน้าหลัก</button>
          </div>`;
        m.addEventListener('click', (e) => {
          if (e.target.dataset.act === 'ok') { m.remove(); resolve(true); }
        });
        document.body.appendChild(m);
      });
      if (ok) location.replace('/home');
    } catch (err) {
      if (err.status === 409) {
        const u = Auth.getUser();
        if (u) Auth.setUser({ ...u, user_role: 'worker' });
        // backend ส่ง worker_id เดิมกลับใน err.data — เก็บไว้ใช้
        if (err.data && err.data.worker_id) Auth.setWorkerId(err.data.worker_id);
        await UI.confirm({
          title: 'คุณเป็นช่างอยู่แล้ว',
          message: 'สามารถแก้ไขสกิลได้ในหน้าโปรไฟล์',
          confirmLabel: 'ตกลง',
          cancelLabel: 'ปิด',
        });
        location.replace('/home');
      } else {
        UI.setFormError(form, err.message || 'สมัครไม่สำเร็จ');
      }
    } finally {
      UI.setBtnLoading(submitBtn, false);
    }
  });
})();
