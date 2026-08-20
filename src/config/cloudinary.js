import { v2 as cloudinary } from "cloudinary";

// อ่านค่าจาก CLOUDINARY_URL (cloudinary://<key>:<secret>@<cloud_name>) ถ้ามี
// ไม่งั้นอ่านจากตัวแปรแยก 3 ตัว — SDK รองรับทั้งสองแบบ
const hasUrl = Boolean(process.env.CLOUDINARY_URL);
const hasParts = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
);

// ไม่ throw ตอน boot เพราะส่วนอื่นของ API ต้องใช้งานได้แม้ยังไม่ตั้งค่าอัปโหลด
// route /uploads จะเป็นตัวตอบ 503 พร้อมบอกว่าต้องตั้ง env อะไรบ้าง
export const isCloudinaryConfigured = hasUrl || hasParts;

if (hasParts && !hasUrl) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else if (hasUrl) {
  cloudinary.config({ secure: true }) // ดึงค่าจาก CLOUDINARY_URL เอง
}

export { cloudinary };
