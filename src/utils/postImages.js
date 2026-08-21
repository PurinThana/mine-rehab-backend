import { pool } from "../config/db.js";
import { ApiError } from "./ApiError.js";

/**
 * รูปภาพหลายรูปของกิจกรรม/ข่าว — ใช้ร่วมกันทั้งสองเรื่อง
 *
 * แนวทาง: ไม่มี endpoint แยกสำหรับรูป แต่ส่งรายการรูปทั้งชุดมากับตัวโพสต์
 * (POST/PUT) แล้วเซิร์ฟเวอร์ลบของเดิมทิ้งและใส่ชุดใหม่ในทรานแซกชันเดียว
 *
 * เหตุผล: หน้าแอดมินมีปุ่มบันทึกเดียวอยู่แล้ว การจัดลำดับรูปคือ "ลำดับใน array"
 * ตรงๆ ไม่ต้องมี API เพิ่มรูป/ลบรูป/สลับลำดับ แยกกันสามตัวที่ต้องคอยให้ตรงกัน
 */

const MAX_IMAGES = 12;

// 'activity' -> ชื่อคอลัมน์เจ้าของในตาราง post_images
const OWNER_COLUMNS = {
  activity: "activity_id",
  news: "news_post_id",
};

/** ตรวจและทำความสะอาดรายการ URL ที่รับมาจาก client */
export function normalizeImageUrls(images) {
  if (images == null) return null; // ไม่ได้ส่งมา = ไม่แตะรูปเดิม
  if (!Array.isArray(images)) {
    throw ApiError.badRequest("images ต้องเป็น array ของ URL");
  }
  const urls = images
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter(Boolean);

  if (urls.length > MAX_IMAGES) {
    throw ApiError.badRequest(`ใส่รูปได้ไม่เกิน ${MAX_IMAGES} รูปต่อหนึ่งรายการ`);
  }
  for (const url of urls) {
    if (url.length > 500) throw ApiError.badRequest("URL ของรูปยาวเกิน 500 ตัวอักษร");
  }
  // ตัดรูปซ้ำออก แต่คงลำดับที่ผู้ใช้จัดไว้
  return [...new Set(urls)];
}

/** อ่านรูปของโพสต์หนึ่งรายการ เรียงตามลำดับที่ผู้ใช้จัดไว้ */
export async function fetchImages(ownerKind, ownerId, conn = pool) {
  const column = OWNER_COLUMNS[ownerKind];
  const [rows] = await conn.query(
    `SELECT id, image_url, sort_order
       FROM post_images
      WHERE ${column} = :ownerId
      ORDER BY sort_order, id`,
    { ownerId },
  );
  return rows;
}

/** อ่านรูปของหลายโพสต์พร้อมกัน คืนเป็น Map<ownerId, string[]> */
export async function fetchImagesForMany(ownerKind, ownerIds, conn = pool) {
  const map = new Map();
  if (!ownerIds.length) return map;

  const column = OWNER_COLUMNS[ownerKind];
  // ใช้ IN (?) กับ array — mysql2 ขยายให้เป็น placeholder ตามจำนวนสมาชิกเอง
  const [rows] = await conn.query(
    `SELECT ${column} AS owner_id, image_url
       FROM post_images
      WHERE ${column} IN (?)
      ORDER BY sort_order, id`,
    [ownerIds],
  );
  for (const row of rows) {
    if (!map.has(row.owner_id)) map.set(row.owner_id, []);
    map.get(row.owner_id).push(row.image_url);
  }
  return map;
}

/**
 * เขียนรายการรูปทั้งชุดใหม่ทับของเดิม และตั้ง image_url (รูปปก) ในตารางแม่
 * ให้เท่ากับรูปแรกเสมอ เพื่อไม่ให้ปกกับแกลเลอรีขัดกัน
 *
 * ต้องส่ง conn ที่อยู่ในทรานแซกชันมา เพื่อให้ลบ-ใส่-อัปเดตปกสำเร็จหรือล้มทั้งชุด
 */
export async function replaceImages(conn, ownerKind, ownerId, urls) {
  const column = OWNER_COLUMNS[ownerKind];
  const parentTable = ownerKind === "activity" ? "activities" : "news_posts";

  await conn.query(`DELETE FROM post_images WHERE ${column} = :ownerId`, { ownerId });

  if (urls.length) {
    // insert ทีเดียวทุกแถว ลำดับใน array = sort_order
    const values = urls.map((url, index) => [ownerId, url, index]);
    await conn.query(
      `INSERT INTO post_images (${column}, image_url, sort_order) VALUES ?`,
      [values],
    );
  }

  await conn.query(`UPDATE ${parentTable} SET image_url = :cover WHERE id = :ownerId`, {
    cover: urls[0] || null,
    ownerId,
  });
}

/** ครอบการเขียนด้วยทรานแซกชัน — ใช้เมื่อสร้าง/แก้ไขโพสต์พร้อมรูป */
export async function withTransaction(run) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await run(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
