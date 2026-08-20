import express from "express";
import cors from "cors";

import apiRoutes from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

const app = express();

// เปิดให้ทุก origin เรียกได้ ("*") เพื่อไม่ให้ CORS ขัดตอน deploy
//
// ปลอดภัยพอสำหรับ API ตัวนี้เพราะ CORS เป็นกลไกฝั่งเบราว์เซอร์ ไม่ใช่การป้องกัน
// ฝั่งเซิร์ฟเวอร์ (curl/script ข้าม CORS ได้อยู่แล้ว) ตัวที่กันการเขียนข้อมูลจริง
// คือ Bearer token ใน requireAuth ส่วน GET ทั้งหมดตั้งใจเปิดสาธารณะแต่แรก
// และ token เก็บใน localStorage ซึ่งผูกกับ origin ของหน้าเว็บ เว็บอื่นอ่านไม่ได้
//
// ถ้าต้องการจำกัดเฉพาะโดเมนของหน้าเว็บภายหลัง เปลี่ยนเป็น:
//   origin: (process.env.FRONTEND_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean)
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
