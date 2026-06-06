// /profile/edit
(function () {
  'use strict';
  if (!Auth.guard()) return;

  const form = document.getElementById('edit-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const elProvince = document.getElementById('province');
  const elDistrict = document.getElementById('district');
  const elSubdistrict = document.getElementById('subdistrict');

  const u = Auth.getUser() || {};
  // pre-fill
  document.getElementById('name').value = u.user_name || '';
  document.getElementById('lastname').value = u.user_lastname || '';
  document.getElementById('phone').value = u.user_phone || '';
  document.getElementById('birthday').value = u.user_birthday || '';
  document.getElementById('bio').value = u.user_bio || '';
  document.getElementById('address').value = u.user_address || '';

  function fillSelect(el, items, valueKey, labelKey, current) {
    el.innerHTML = '<option value="">-- เลือก --</option>' +
      items.map((it) =>
        `<option value="${it[valueKey]}" ${String(it[valueKey]) === String(current) ? 'selected' : ''}>${UI.escapeHtml(it[labelKey])}</option>`
      ).join('');
  }

  async function loadProvinces() {
    try {
      const res = await Api.get('/locations/provinces');
      fillSelect(elProvince, res.provinces, 'province_id', 'province_name_th', u.user_province_id);
      if (u.user_province_id) loadDistricts(u.user_province_id, u.user_district_id);
    } catch (err) {
      UI.toast('โหลดจังหวัดไม่ได้', 'danger');
    }
  }

  async function loadDistricts(provinceId, current) {
    if (!provinceId) {
      elDistrict.disabled = true;
      elDistrict.innerHTML = '<option value="">เลือกจังหวัดก่อน</option>';
      elSubdistrict.disabled = true;
      elSubdistrict.innerHTML = '<option value="">เลือกอำเภอก่อน</option>';
      return;
    }
    elDistrict.disabled = false;
    elDistrict.innerHTML = '<option value="">กำลังโหลด...</option>';
    try {
      const res = await Api.get('/locations/districts', { query: { province_id: provinceId } });
      fillSelect(elDistrict, res.districts, 'district_id', 'district_name_th', current);
      if (current) loadSubdistricts(current, u.user_subdistrict_id);
      else {
        elSubdistrict.disabled = true;
        elSubdistrict.innerHTML = '<option value="">เลือกอำเภอก่อน</option>';
      }
    } catch (err) {
      elDistrict.innerHTML = '<option value="">โหลดไม่ได้</option>';
    }
  }

  async function loadSubdistricts(districtId, current) {
    if (!districtId) {
      elSubdistrict.disabled = true;
      elSubdistrict.innerHTML = '<option value="">เลือกอำเภอก่อน</option>';
      return;
    }
    elSubdistrict.disabled = false;
    elSubdistrict.innerHTML = '<option value="">กำลังโหลด...</option>';
    try {
      const res = await Api.get('/locations/subdistricts', { query: { district_id: districtId } });
      const items = res.subdistricts.map((s) => ({
        ...s,
        label: `${s.subdistrict_name_th} (${s.subdistrict_zip_code || '-'})`,
      }));
      fillSelect(elSubdistrict, items, 'subdistrict_id', 'label', current);
    } catch (err) {
      elSubdistrict.innerHTML = '<option value="">โหลดไม่ได้</option>';
    }
  }

  elProvince.addEventListener('change', () => {
    loadDistricts(elProvince.value, null);
  });
  elDistrict.addEventListener('change', () => {
    loadSubdistricts(elDistrict.value, null);
  });

  loadProvinces();

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
      user_province_id: elProvince.value ? Number(elProvince.value) : null,
      user_district_id: elDistrict.value ? Number(elDistrict.value) : null,
      user_subdistrict_id: elSubdistrict.value ? Number(elSubdistrict.value) : null,
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
