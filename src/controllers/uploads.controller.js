import { randomBytes } from "node:crypto";
import path from "node:path";

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { cloudinary, isCloudinaryConfigured } from "../config/cloudinary.js";

// ชนิดไฟล์ที่รับ — จำกัดไว้เท่าที่หน้าเว็บใช้จริง (รูปการ์ดกิจกรรม/ข่าว และเอกสาร PDF)
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const DOC_TYPES = ["application/pdf"];

/**
 * สร้าง public_id เอง ไม่ใช้ use_filename ของ Cloudinary
 *
 * เหตุผล: upload_stream ไม่มีชื่อไฟล์ให้ Cloudinary อ่าน (ไฟล์มาจาก buffer)
 * use_filename จึงไม่มีผล และได้ public_id สุ่มแบบ "file_zhcwr1" ที่ไม่มีนามสกุล
 *
 * สำหรับ resource_type "raw" นามสกุลต้องอยู่ใน public_id เท่านั้น ถ้าไม่มี
 * Cloudinary จะส่งไฟล์ออกเป็น application/octet-stream พร้อม
 * Content-Disposition: attachment; filename="file_zhcwr1" — ผู้ใช้ดาวน์โหลดไป
 * ได้ไฟล์ไม่มีนามสกุลที่เปิดไม่ได้
 *
 * ส่วนรูปภาพไม่ต้องใส่นามสกุล เพราะ Cloudinary เติมให้เองจากชนิดไฟล์จริง
 */
function buildPublicId(originalName, isImage) {
  const safeName = path.basename(String(originalName || ""));
  // ต้องตัดนามสกุลด้วยตัวพิมพ์เดิมก่อน แล้วค่อยแปลงเป็นตัวเล็ก — ถ้าแปลงก่อน
  // basename() จะไม่รู้จัก ".PDF" แล้วปล่อยให้ติดมาในชื่อไฟล์ (photo-JPG-xxxx)
  const rawExt = path.extname(safeName);
  const base = path.basename(safeName, rawExt);
  const ext = rawExt.toLowerCase();

  // เหลือเฉพาะอักขระที่ปลอดภัยใน URL — ชื่อไฟล์ภาษาไทยจะถูกตัดหมด จึงมี fallback
  // (ชื่อที่ผู้ใช้เห็นบนหน้าเว็บมาจากคอลัมน์ title ไม่ได้มาจากชื่อไฟล์)
  const slug = base
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  const stem = `${slug || "file"}-${randomBytes(4).toString("hex")}`;
  return isImage ? stem : `${stem}${ext}`;
}

export const uploadFile = asyncHandler(async (req, res) => {
  if (!isCloudinaryConfigured) {
    throw new ApiError(
      503,
      "ยังไม่ได้ตั้งค่าที่เก็บไฟล์ — ใส่ CLOUDINARY_URL (หรือ CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET) ในไฟล์ .env แล้วรีสตาร์ต",
    );
  }
  if (!req.file) {
    throw ApiError.badRequest("ต้องแนบไฟล์มาในฟิลด์ชื่อ file (multipart/form-data)");
  }

  const isImage = IMAGE_TYPES.includes(req.file.mimetype);
  const isDoc = DOC_TYPES.includes(req.file.mimetype);
  if (!isImage && !isDoc) {
    throw ApiError.badRequest(
      `ชนิดไฟล์ ${req.file.mimetype} ไม่รองรับ — รับเฉพาะรูปภาพ (JPG, PNG, WebP, GIF, AVIF) และ PDF`,
    );
  }

  // แยกโฟลเดอร์ให้จัดการง่ายใน Cloudinary
  const folder = isImage ? "mine-rehab/images" : "mine-rehab/documents";

  // PDF ต้องอัปโหลดเป็น resource_type "raw" เพื่อให้ URL เป็นไฟล์ตรงๆ ดาวน์โหลดได้
  // (ถ้าปล่อยเป็น image จะเข้า pipeline แปลงรูปซึ่งไม่ใช่สิ่งที่ลิงก์ดาวน์โหลดต้องการ)
  const resourceType = isImage ? "image" : "raw";

  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          public_id: buildPublicId(req.file.originalname, isImage),
          overwrite: false,
        },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded)),
      );
      // ไฟล์อยู่ใน memory (multer memoryStorage) ไม่แตะดิสก์เลย
      // สำคัญกับ host แบบ Render/Koyeb ที่ filesystem หายทุกครั้งที่ deploy
      stream.end(req.file.buffer);
    });
  } catch (err) {
    // error จาก Cloudinary ไม่ใช่ Error ปกติ (มี http_code) ถ้าปล่อยผ่านไป
    // errorHandler จะกลายเป็น 500 "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" ซึ่งบอกอะไรไม่ได้เลย
    // ตอนคีย์ผิด — ส่งข้อความจริงกลับไปให้แก้ได้ถูกจุด
    const status = err?.http_code;
    if (status === 401 || status === 403) {
      throw new ApiError(
        502,
        `Cloudinary ปฏิเสธการอัปโหลด (${err.message}) — ตรวจสอบ CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET ในไฟล์ .env`,
      );
    }
    if (status === 420 || status === 429) {
      throw new ApiError(502, "ใช้โควตา Cloudinary เกินขีดจำกัดชั่วคราว — ลองใหม่อีกครั้งภายหลัง");
    }
    throw new ApiError(502, `อัปโหลดไปที่ Cloudinary ไม่สำเร็จ: ${err?.message || "ไม่ทราบสาเหตุ"}`);
  }

  res.status(201).json({
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format || null,
    bytes: result.bytes,
    // ปัดขึ้นเสมอ ไฟล์เล็กกว่า 1 KB จะได้ไม่กลายเป็น 0
    sizeKb: Math.max(1, Math.ceil(result.bytes / 1024)),
    originalName: req.file.originalname,
    kind: isImage ? "image" : "document",
  });
});
