import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { cloudinary, isCloudinaryConfigured } from "../config/cloudinary.js";

// ชนิดไฟล์ที่รับ — จำกัดไว้เท่าที่หน้าเว็บใช้จริง (รูปการ์ดกิจกรรม/ข่าว และเอกสาร PDF)
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const DOC_TYPES = ["application/pdf"];

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
          // เก็บชื่อไฟล์เดิมไว้ท้าย public_id ให้พอเดาได้ว่าไฟล์อะไร
          use_filename: true,
          unique_filename: true,
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
