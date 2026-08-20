import { Router } from "express";
import multer from "multer";

import { uploadFile } from "../controllers/uploads.controller.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ApiError } from "../utils/ApiError.js";

const MAX_FILE_MB = Number(process.env.UPLOAD_MAX_FILE_MB) || 10;

// memoryStorage: ไฟล์ไม่ลงดิสก์เลย ส่งต่อขึ้น Cloudinary จาก buffer ตรงๆ
// เหมาะกับ host ฟรีที่ filesystem เป็น ephemeral และกันไฟล์ค้างในเครื่อง
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 1 },
});

const router = Router();

// อัปโหลดได้เฉพาะผู้ที่ล็อกอินแล้ว — ไม่งั้นใครก็ยิงไฟล์เข้าบัญชี Cloudinary เราได้
router.post(
  "/uploads",
  requireAuth,
  requireRole("admin", "staff"),
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (!err) return next();
      // แปลง error ของ multer ให้เป็นข้อความไทยที่แสดงในฟอร์มได้เลย
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(ApiError.badRequest(`ไฟล์ใหญ่เกิน ${MAX_FILE_MB} MB`));
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE" || err.code === "LIMIT_FILE_COUNT") {
        return next(ApiError.badRequest("อัปโหลดได้ครั้งละ 1 ไฟล์ ในฟิลด์ชื่อ file"));
      }
      next(err);
    });
  },
  uploadFile,
);

export default router;
