// ============================================================
//  map.js — ตัวห่อ Leaflet ใช้ร่วมทุกหน้าที่มีแผนที่
//
//  - โหลด Leaflet จาก CDN ตอนที่ต้องใช้จริงเท่านั้น (หน้าอื่นไม่ต้องแบก)
//  - หมุดเป็น divIcon ธีมแดงของช่างไทย ไม่ใช้รูป marker default
//  - โหลดหมุดเฉพาะ "กรอบแผนที่ที่เห็นอยู่" แล้วขอเพิ่มตอนเลื่อน/ซูม
//    (กัน API พังตอนช่างเยอะ — docs/04)
//
//  ใช้:
//    await CtMap.ensureLeaflet();
//    const m = CtMap.create('#map', { center: [lat,lng], zoom: 13 });
//    CtMap.renderWorkers(m, workers);
// ============================================================
(function (global) {
  'use strict';

  const LEAFLET_VER = '1.9.4';
  const CDN = 'https://unpkg.com/leaflet@' + LEAFLET_VER + '/dist/';

  // กลางประเทศไทย — ใช้ตอนที่ยังไม่รู้ตำแหน่งผู้ใช้
  const DEFAULT_CENTER = [13.7563, 100.5018]; // กรุงเทพ
  const DEFAULT_ZOOM = 12;

  let leafletPromise = null;

  /** โหลด Leaflet (css + js) ครั้งเดียว คืน promise เดิมถ้าเรียกซ้ำ */
  function ensureLeaflet() {
    if (global.L) return Promise.resolve(global.L);
    if (leafletPromise) return leafletPromise;

    leafletPromise = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = CDN + 'leaflet.css';
      document.head.appendChild(css);

      const js = document.createElement('script');
      js.src = CDN + 'leaflet.js';
      js.async = true;
      js.onload = () => (global.L ? resolve(global.L) : reject(new Error('โหลดแผนที่ไม่สำเร็จ')));
      js.onerror = () => reject(new Error('โหลดแผนที่ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต'));
      document.head.appendChild(js);
    });
    return leafletPromise;
  }

  /** สร้างแผนที่ + tile layer มาตรฐาน */
  function create(selector, opts) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) throw new Error('ไม่พบ element ของแผนที่: ' + selector);

    const o = opts || {};
    const map = global.L.map(el, {
      zoomControl: o.zoomControl !== false,
      scrollWheelZoom: o.scrollWheelZoom !== false,
      attributionControl: true,
    }).setView(o.center || DEFAULT_CENTER, o.zoom || DEFAULT_ZOOM);

    global.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    // layer แยกไว้ล้างหมุดได้โดยไม่แตะ tile
    map.__ctLayer = global.L.layerGroup().addTo(map);
    return map;
  }

  /** แปลงกรอบที่เห็นอยู่ → พารามิเตอร์ bbox ของ API (min_lat,min_lng,max_lat,max_lng) */
  function bboxOf(map) {
    const b = map.getBounds();
    return [
      b.getSouth().toFixed(6),
      b.getWest().toFixed(6),
      b.getNorth().toFixed(6),
      b.getEast().toFixed(6),
    ].join(',');
  }

  const CATEGORY_ICONS = {
    'งานไฟฟ้า-อิเล็กทรอนิกส์': '💡',
    'งานประปา-สุขาภิบาล': '🚿',
    'งานก่อสร้าง-โครงสร้าง': '🧱',
    'งานตกแต่ง-ต่อเติม': '🪟',
    'งานซ่อมแซมเฉพาะทาง': '❄️',
    'งานทำความสะอาด': '🧹',
    'งานสวน-ภูมิทัศน์': '🌿',
    'งานคอมพิวเตอร์': '💻',
    'งานมือถือ-อุปกรณ์พกพา': '📱',
    'งานพัฒนาดิจิทัล': '⚙️',
    'งานออกแบบ-สร้างสรรค์': '🎨',
    'งานเขียน-ภาษา-สอน': '📚',
    'งานที่ปรึกษา-ธุรกิจ': '📊',
    'บริการดูแล-สุขภาพ-ความงาม': '💆',
    'ขนส่ง-อาหาร-งานทั่วไป': '🚚',
  };

  function iconFor(worker) {
    const skills = worker.all_skills || [];
    const cat = skills.length ? skills[0].skill_category_name_th : null;
    return (cat && CATEGORY_ICONS[cat]) || '🛠️';
  }

  // รูปคนในหมุด — สื่อว่าหมุดคือ "คน" ไม่ใช่ "ร้าน" หรือ "ประเภทงาน"
  const PERSON_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<circle cx="12" cy="8" r="4"/>' +
      '<path d="M12 14c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"/>' +
    '</svg>';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  /** การ์ดใน popup ของหมุด */
  function popupHtml(w) {
    const fullName = ((w.user_name || '') + ' ' + (w.user_lastname || '')).trim() || 'ช่าง';
    const verified = w.is_identity_verified
      ? '<span class="ct-pop__badge" title="ยืนยันตัวตนแล้ว">✅ ยืนยันแล้ว</span>'
      : '';

    const skills = (w.all_skills || []).slice(0, 3)
      .map((s) => '<span class="ct-pop__chip">' + esc(s.skill_name_th) + '</span>')
      .join('');
    const more = (w.skill_count || 0) > 3
      ? '<span class="ct-pop__chip ct-pop__chip--more">+' + ((w.skill_count || 0) - 3) + '</span>'
      : '';

    const dist = w.distance_km != null
      ? '<div class="ct-pop__dist">📍 ห่างประมาณ ' + w.distance_km + ' กม.</div>'
      : '';

    const blurNote = w.location_is_blurred
      ? '<div class="ct-pop__note">ตำแหน่งคร่าว ๆ · ยืนยันตัวตนแล้วจะเห็นชัดขึ้น</div>'
      : '';

    return (
      '<div class="ct-pop">' +
        '<div class="ct-pop__name">' + esc(fullName) + ' ' + verified + '</div>' +
        (w.worker_resume ? '<div class="ct-pop__bio">' + esc(String(w.worker_resume).slice(0, 80)) + '</div>' : '') +
        '<div class="ct-pop__chips">' + skills + more + '</div>' +
        dist +
        '<div class="ct-pop__jobs">รับงานไปแล้ว ' + (w.worker_total_jobs || 0) + ' งาน</div>' +
        blurNote +
        '<div class="ct-pop__actions">' +
          '<a class="ct-pop__btn" href="/worker/' + w.worker_id + '">ดูโปรไฟล์ / จ้าง</a>' +
          '<a class="ct-pop__btn ct-pop__btn--ghost" href="/chat/' + w.worker_user_id + '">💬 แชต</a>' +
        '</div>' +
      '</div>'
    );
  }

  /** วาดหมุดช่างลงแผนที่ (ล้างของเดิมก่อน) */
  function renderWorkers(map, workers) {
    const L = global.L;
    map.__ctLayer.clearLayers();
    let drawn = 0;

    (workers || []).forEach((w) => {
      if (w.worker_lat == null || w.worker_lng == null) return;
      const icon = L.divIcon({
        className: '',
        html: '<div class="ct-pin"><span>' + PERSON_SVG + '</span></div>',
        iconSize: [38, 38],
        iconAnchor: [19, 38],
        popupAnchor: [0, -36],
      });
      L.marker([Number(w.worker_lat), Number(w.worker_lng)], { icon })
        .bindPopup(popupHtml(w), { minWidth: 220, maxWidth: 260 })
        .addTo(map.__ctLayer);
      drawn++;
    });

    return drawn;
  }

  /** หมุดลากได้ 1 อัน สำหรับหน้าปักหมุดจุดรับงาน */
  function pinMarker(map, latlng, onMove) {
    const L = global.L;
    const icon = L.divIcon({
      className: '',
      html: '<div class="ct-pin ct-pin--me"><span>📍</span></div>',
      iconSize: [42, 42],
      iconAnchor: [21, 42],
    });
    const marker = L.marker(latlng, { icon, draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      if (onMove) onMove(p.lat, p.lng);
    });
    // กดที่แผนที่ = ย้ายหมุดไปจุดนั้น
    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      if (onMove) onMove(e.latlng.lat, e.latlng.lng);
    });
    return marker;
  }

  /** ขอตำแหน่งจากเบราว์เซอร์ — ไม่ได้ก็คืน null ไม่ throw */
  function locate(timeoutMs) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: timeoutMs || 8000, maximumAge: 60000 }
      );
    });
  }

  /** เรียก fn หลังผู้ใช้หยุดเลื่อน/ซูมแล้ว (กันยิง API รัว) */
  function onViewChange(map, fn, waitMs) {
    let timer = null;
    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(fn, waitMs || 350);
    };
    map.on('moveend', run);
    map.on('zoomend', run);
  }

  global.CtMap = {
    ensureLeaflet,
    create,
    bboxOf,
    renderWorkers,
    pinMarker,
    locate,
    onViewChange,
    DEFAULT_CENTER,
    DEFAULT_ZOOM,
    CATEGORY_ICONS,
  };
})(window);
