// ============================================================
//  schedule-picker.js — ตัวเลือกเวลาทำงานประจำสัปดาห์ของช่าง
//
//  ใช้:
//    const sp = SchedulePicker.mount('#mount', {
//      value: [{ day: 1, start: '08:00', end: '17:00' }],
//      onChange: (list) => {...}
//    });
//    sp.getValue();   // [{ day, start, end }] เฉพาะวันที่เปิด
//
//  day: 0=อาทิตย์ ... 6=เสาร์ (ตรงกับ JS Date.getDay() และ DB)
// ============================================================
(function (global) {
  'use strict';

  // เรียงจันทร์ก่อนตามที่คนไทยอ่านปฏิทิน แต่ค่า day ยังเป็นมาตรฐาน 0=อาทิตย์
  const DAYS = [
    { day: 1, short: 'จ', full: 'จันทร์' },
    { day: 2, short: 'อ', full: 'อังคาร' },
    { day: 3, short: 'พ', full: 'พุธ' },
    { day: 4, short: 'พฤ', full: 'พฤหัสบดี' },
    { day: 5, short: 'ศ', full: 'ศุกร์' },
    { day: 6, short: 'ส', full: 'เสาร์' },
    { day: 0, short: 'อา', full: 'อาทิตย์' },
  ];

  const DEFAULT_START = '08:00';
  const DEFAULT_END = '17:00';

  function mount(container, opts) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    if (!el) return null;

    const o = opts || {};
    const onChange = o.onChange || function () {};

    // state: day → { on, start, end }
    const state = {};
    DAYS.forEach((d) => {
      state[d.day] = { on: false, start: DEFAULT_START, end: DEFAULT_END };
    });
    (o.value || []).forEach((v) => {
      const d = Number(v.day);
      if (state[d]) {
        state[d] = {
          on: true,
          start: String(v.start || DEFAULT_START).slice(0, 5),
          end: String(v.end || DEFAULT_END).slice(0, 5),
        };
      }
    });

    function getValue() {
      return DAYS
        .filter((d) => state[d.day].on)
        .map((d) => ({ day: d.day, start: state[d.day].start, end: state[d.day].end }));
    }

    function emit() { onChange(getValue()); }

    function render() {
      el.innerHTML =
        '<div class="sched">' +
          '<div class="sched__quick">' +
            '<button type="button" class="sched__quickbtn" data-quick="weekday">จ–ศ 08:00–17:00</button>' +
            '<button type="button" class="sched__quickbtn" data-quick="everyday">ทุกวัน</button>' +
            '<button type="button" class="sched__quickbtn" data-quick="clear">ล้าง</button>' +
          '</div>' +
          DAYS.map(function (d) {
            const s = state[d.day];
            return (
              '<div class="sched__row' + (s.on ? ' is-on' : '') + '">' +
                '<label class="sched__day">' +
                  '<input type="checkbox" data-day="' + d.day + '"' + (s.on ? ' checked' : '') + '>' +
                  '<span>' + d.full + '</span>' +
                '</label>' +
                (s.on
                  ? '<span class="sched__times">' +
                      '<input type="time" data-time="start" data-day="' + d.day + '" value="' + s.start + '">' +
                      '<span class="sched__dash">–</span>' +
                      '<input type="time" data-time="end" data-day="' + d.day + '" value="' + s.end + '">' +
                    '</span>'
                  : '<span class="sched__off">ไม่รับงาน</span>') +
              '</div>'
            );
          }).join('') +
        '</div>';

      // เปิด/ปิดวัน
      el.querySelectorAll('input[type="checkbox"][data-day]').forEach(function (cb) {
        cb.addEventListener('change', function () {
          state[Number(cb.dataset.day)].on = cb.checked;
          render();
          emit();
        });
      });

      // แก้เวลา — ไม่ re-render ทั้งชุด จะได้ไม่หลุด focus ระหว่างพิมพ์
      el.querySelectorAll('input[type="time"][data-day]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          const d = Number(inp.dataset.day);
          const which = inp.dataset.time;
          state[d][which] = inp.value || (which === 'start' ? DEFAULT_START : DEFAULT_END);

          // เลิกงานต้องหลังเริ่มงาน — ถ้าสลับกันให้ดันอีกฝั่งตาม
          if (state[d].end <= state[d].start) {
            if (which === 'start') {
              state[d].end = bumpHour(state[d].start);
              el.querySelector('input[data-time="end"][data-day="' + d + '"]').value = state[d].end;
            } else {
              state[d].start = state[d].end;
              state[d].end = bumpHour(state[d].end);
              inp.value = state[d].end;
              el.querySelector('input[data-time="start"][data-day="' + d + '"]').value = state[d].start;
            }
            UI.toast('เวลาเลิกงานต้องอยู่หลังเวลาเริ่มงาน', 'warning');
          }
          emit();
        });
      });

      // ปุ่มลัด
      el.querySelectorAll('.sched__quickbtn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const q = btn.dataset.quick;
          DAYS.forEach(function (d) {
            if (q === 'clear') state[d.day].on = false;
            else if (q === 'everyday') state[d.day] = { on: true, start: DEFAULT_START, end: DEFAULT_END };
            else if (q === 'weekday') {
              const isWeekday = d.day >= 1 && d.day <= 5;
              state[d.day] = { on: isWeekday, start: DEFAULT_START, end: DEFAULT_END };
            }
          });
          render();
          emit();
        });
      });
    }

    /** +1 ชั่วโมง (ไม่ข้ามเที่ยงคืน — ตันที่ 23:59) */
    function bumpHour(hhmm) {
      const [h, m] = hhmm.split(':').map(Number);
      if (h >= 23) return '23:59';
      return String(h + 1).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    render();
    return { getValue, render };
  }

  /** แปลงข้อมูลเป็นข้อความอ่านง่าย เช่น "จ–ศ 08:00–17:00 · ส 09:00–12:00" */
  function describe(list) {
    if (!list || list.length === 0) return 'ไม่ได้ระบุเวลา — ติดต่อได้ตลอด';

    const byDay = {};
    list.forEach((v) => { byDay[Number(v.day)] = v; });

    // รวมวันที่ติดกันและเวลาเหมือนกันเป็นช่วงเดียว
    const parts = [];
    let run = null;
    DAYS.forEach(function (d) {
      const v = byDay[d.day];
      const key = v ? v.start + '-' + v.end : null;
      if (v && run && run.key === key) {
        run.to = d.short;
      } else {
        if (run) parts.push(run);
        run = v ? { key: key, from: d.short, to: d.short, start: v.start, end: v.end } : null;
      }
    });
    if (run) parts.push(run);

    return parts
      .map((p) => (p.from === p.to ? p.from : p.from + '–' + p.to) + ' ' + p.start + '–' + p.end)
      .join(' · ');
  }

  global.SchedulePicker = { mount, describe, DAYS };
})(window);
