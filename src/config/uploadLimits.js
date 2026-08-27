import "dotenv/config";

/**
 * เพดานขนาดไฟล์อัปโหลด แยกตามชนิดไฟล์
 *
 * แยกเพราะ PDF (รายงาน แบบแปลน ผลตรวจ) ใหญ่กว่ารูปภาพหน้างานมาก ถ้าใช้ตัวเลข
 * เดียวกันทั้งคู่ก็ต้องยกเพดานรูปขึ้นไปด้วย ซึ่งเปิดช่องให้อัปรูปความละเอียด
 * มหาศาลที่หน้าเว็บย่อลงเหลือไม่ถึงเมกะไบต์อยู่ดี — เปลืองทั้งโควตาและ RAM
 *
 * multer รับเพดานได้ค่าเดียวและตั้งก่อนรู้ชนิดไฟล์ จึงตั้งไว้ที่ค่าสูงสุด
 * แล้วให้ controller ตรวจตามชนิดจริงอีกชั้น (ดู uploads.controller.js)
 */
export const MAX_IMAGE_MB = Number(process.env.UPLOAD_MAX_IMAGE_MB) || 10;
export const MAX_PDF_MB = Number(process.env.UPLOAD_MAX_PDF_MB) || 50;

// เพดานที่ multer ใช้ — ต้องเป็นค่าที่สูงที่สุด ไม่งั้นชนิดที่ยอมให้ใหญ่กว่าจะถูกตัดก่อน
export const MAX_ANY_MB = Math.max(MAX_IMAGE_MB, MAX_PDF_MB);

export const toBytes = (mb) => mb * 1024 * 1024;
