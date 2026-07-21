// ============================================================
//  image-compress.js — ย่อรูปในเบราว์เซอร์ก่อนอัปโหลด
//
//  ทำไมต้องมี: รูปจากมือถือสมัยนี้ 4-12 MB เป็นเรื่องปกติ
//  แต่เซิร์ฟเวอร์รับไม่เกิน 5 MB ผู้ใช้เลยอัปไม่ผ่านบ่อย
//  ย่อฝั่งเบราว์เซอร์ก่อนส่ง = อัปได้ เร็วขึ้น และประหยัดเน็ตผู้ใช้ด้วย
//
//  ใช้:
//    const out = await ImageCompress.compress(file, { maxSize: 1600 });
//    // out = { file, width, height, originalBytes, bytes, skipped }
//
//  ปลอดภัย: ถ้าเบราว์เซอร์ย่อไม่ได้ (เช่นไฟล์ HEIC ที่ decode ไม่ออก)
//  จะคืนไฟล์เดิมกลับไปพร้อม skipped=true ไม่ทำให้อัปโหลดพัง
// ============================================================
(function (global) {
  'use strict';

  const DEFAULTS = {
    maxSize: 1600,      // ด้านที่ยาวที่สุด (px)
    quality: 0.82,      // คุณภาพ JPEG
    mimeType: 'image/jpeg',
  };

  /** ไฟล์นี้เป็นรูปที่ canvas น่าจะ decode ได้ไหม */
  function isCompressibleImage(file) {
    return Boolean(file) && /^image\/(jpeg|png|webp)$/i.test(file.type || '');
  }

  /** โหลดไฟล์เป็นภาพ — ใช้ createImageBitmap ก่อนเพราะหมุนตาม EXIF ให้เอง */
  async function loadImage(file) {
    if (global.createImageBitmap) {
      try {
        return await global.createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (e) {
        // เบราว์เซอร์เก่าไม่รองรับ option นี้ — ลองแบบไม่ใส่ option
        try { return await global.createImageBitmap(file); } catch (e2) { /* ตกไปใช้ <img> */ }
      }
    }
    return await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('อ่านไฟล์รูปไม่ได้')); };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      if (canvas.toBlob) canvas.toBlob((b) => resolve(b), type, quality);
      else resolve(null);
    });
  }

  /**
   * ย่อรูป
   * @param {File} file
   * @param {{maxSize?:number, quality?:number, mimeType?:string}} opts
   */
  async function compress(file, opts) {
    const o = Object.assign({}, DEFAULTS, opts || {});
    const originalBytes = file ? file.size : 0;

    if (!isCompressibleImage(file)) {
      return { file, bytes: originalBytes, originalBytes, skipped: true, reason: 'ไม่ใช่ไฟล์รูปที่ย่อได้' };
    }

    let img;
    try {
      img = await loadImage(file);
    } catch (err) {
      return { file, bytes: originalBytes, originalBytes, skipped: true, reason: err.message };
    }

    const w0 = img.width;
    const h0 = img.height;
    if (!w0 || !h0) {
      return { file, bytes: originalBytes, originalBytes, skipped: true, reason: 'ขนาดรูปไม่ถูกต้อง' };
    }

    const scale = Math.min(1, o.maxSize / Math.max(w0, h0));
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { file, bytes: originalBytes, originalBytes, skipped: true, reason: 'เบราว์เซอร์ไม่รองรับ canvas' };
    }
    // PNG โปร่งใสจะกลายเป็นดำถ้าไม่รองพื้นขาวก่อนแปลงเป็น JPEG
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    if (img.close) img.close();   // คืนหน่วยความจำของ ImageBitmap

    const blob = await canvasToBlob(canvas, o.mimeType, o.quality);
    if (!blob) {
      return { file, bytes: originalBytes, originalBytes, skipped: true, reason: 'แปลงรูปไม่สำเร็จ' };
    }

    // ย่อแล้วดันใหญ่กว่าเดิม (เช่นรูปเล็กที่บีบมาดีอยู่แล้ว) — ใช้ของเดิมดีกว่า
    if (blob.size >= originalBytes && scale === 1) {
      return { file, bytes: originalBytes, originalBytes, width: w0, height: h0, skipped: true, reason: 'ไฟล์เดิมเล็กกว่า' };
    }

    const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
    const out = new File([blob], name, { type: o.mimeType, lastModified: Date.now() });

    return { file: out, bytes: out.size, originalBytes, width: w, height: h, skipped: false };
  }

  /** "2.4 MB" */
  function formatBytes(n) {
    if (!n && n !== 0) return '-';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  /**
   * ย่อ + บอกผู้ใช้ว่าย่อให้แล้ว + กันกรณีย่อแล้วยังใหญ่เกินเพดาน
   * คืน File ที่พร้อมอัป หรือ null ถ้าไปต่อไม่ได้ (แจ้ง toast ให้แล้ว)
   */
  async function prepareForUpload(file, opts) {
    const o = opts || {};
    const maxBytes = o.maxBytes || 5 * 1024 * 1024;

    let res;
    try {
      res = await compress(file, o);
    } catch (err) {
      res = { file, bytes: file.size, originalBytes: file.size, skipped: true, reason: err.message };
    }

    if (res.bytes > maxBytes) {
      if (global.UI) {
        UI.toast(
          'ไฟล์ใหญ่เกิน ' + formatBytes(maxBytes) +
          (res.skipped ? ' และย่อให้อัตโนมัติไม่ได้ — ลองบันทึกเป็น JPG ก่อน' : ' แม้ย่อแล้ว'),
          'danger', 5000
        );
      }
      return null;
    }

    // ย่อได้จริงและลดลงเห็นชัด — บอกผู้ใช้จะได้ไม่งงว่าทำไมรูปเบาลง
    if (!res.skipped && res.originalBytes - res.bytes > 200 * 1024 && global.UI) {
      UI.toast(
        'ย่อรูปให้แล้ว ' + formatBytes(res.originalBytes) + ' → ' + formatBytes(res.bytes),
        'info', 3000
      );
    }
    return res.file;
  }

  global.ImageCompress = { compress, prepareForUpload, formatBytes, isCompressibleImage };
})(window);
