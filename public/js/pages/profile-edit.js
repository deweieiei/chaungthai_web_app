// /profile/edit
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const form = document.getElementById('edit-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const elCoord = document.getElementById('home-coord');

  const u = Auth.getUser() || {};
  // pre-fill
  document.getElementById('name').value = u.user_name || '';
  document.getElementById('lastname').value = u.user_lastname || '';
  document.getElementById('phone').value = u.user_phone || '';
  document.getElementById('birthday').value = u.user_birthday || '';
  document.getElementById('bio').value = u.user_bio || '';
  document.getElementById('address').value = u.user_address || '';

  // ------------------------------------------------------------
  //  ปักหมุดที่อยู่ (แทน dropdown จังหวัด/อำเภอ/ตำบลเดิม)
  //  ใช้เปิดแผนที่ที่ตำแหน่งตัวเองตอนหาช่าง — ไม่โชว์ให้คนอื่น
  // ------------------------------------------------------------
  let homeMap = null;
  let home = (u.user_lat != null && u.user_lng != null)
    ? [Number(u.user_lat), Number(u.user_lng)]
    : null;

  function paintCoord() {
    elCoord.textContent = home
      ? 'ตำแหน่ง: ' + home[0].toFixed(4) + ', ' + home[1].toFixed(4)
      : 'ยังไม่ได้ปักหมุด';
  }
  paintCoord();

  document.getElementById('btn-my-home').addEventListener('click', async function () {
    this.disabled = true;
    const pos = await CtMap.locate();
    this.disabled = false;
    if (!pos) {
      UI.toast('ขอตำแหน่งไม่สำเร็จ — เปิดสิทธิ์ตำแหน่งในเบราว์เซอร์ก่อน', 'warning');
      return;
    }
    home = pos;
    if (homeMap) homeMap.setView(pos, 15);
    paintCoord();
  });

  (async function initHomeMap() {
    try {
      await CtMap.ensureLeaflet();
    } catch (err) {
      elCoord.textContent = 'โหลดแผนที่ไม่สำเร็จ';
      return;
    }
    const start = home || CtMap.DEFAULT_CENTER;
    homeMap = CtMap.create('#home-map', { center: start, zoom: home ? 15 : 11, scrollWheelZoom: false });
    CtMap.pinMarker(homeMap, start, function (lat, lng) {
      home = [lat, lng];
      paintCoord();
    });
  })();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    UI.clearFieldErrors(form);
    UI.setFormError(form, null);

    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const nameErr = UI.Validators.required(name, 'ชื่อ');
    const phoneErr = UI.Validators.phone(phone);
    if (nameErr) UI.setFieldError('name', nameErr);
    if (phoneErr) UI.setFieldError('phone', phoneErr);
    if (nameErr || phoneErr) return;

    const fields = {
      user_name: name,
      user_lastname: document.getElementById('lastname').value.trim(),
      user_phone: phone || null,
      user_address: document.getElementById('address').value.trim() || null,
      user_bio: document.getElementById('bio').value.trim() || null,
      user_lat: home ? home[0] : null,
      user_lng: home ? home[1] : null,
      user_birthday: document.getElementById('birthday').value || null,
    };

    UI.setBtnLoading(submitBtn, true);
    try {
      const res = await Api.put('/users/' + u.user_id, fields);
      Auth.setUser(res.user);
      UI.toast('บันทึกข้อมูลสำเร็จ', 'success');
      setTimeout(() => location.assign('/profile'), 600);
    } catch (err) {
      UI.setFormError(form, err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      UI.setBtnLoading(submitBtn, false);
    }
  });
})();
