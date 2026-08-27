// นำข้อมูลจาก Google Sheet "แบบฟอร์ม_Landing_Page_พร้อมเช็ค_Stock_ต้นไม้"
// มาลงฐานข้อมูลให้ตรงกัน
//
// ค่าทั้งหมดคัดลอกมาจาก sheet ตรงๆ ไม่ได้ดึงสดตอนรัน เพื่อให้ผลลัพธ์คงที่
// ตรวจสอบย้อนหลังได้ และไม่พังถ้า sheet ถูกแก้ระหว่างทาง
//
// รันซ้ำได้ (idempotent) — เขียนทับด้วยค่าเดิมเสมอ ไม่สร้างของซ้ำ
//
// วิธีใช้: npm run db:sync-sheet

import "dotenv/config";
import { pool } from "../src/config/db.js";

const SITE_ID = 1;

// --- แท็บ "ข้อมูลโครงการ" ---
const SITE = {
  name: "โครงการฟื้นฟูพื้นที่เหมืองด้วยการปลูกต้นเฟื่องฟ้า",
  companyName: "โรงโม่หินศิลาเขาตำบล",
  location: "246 หมู่ที่ 6 ตำบลลำนารายณ์ อำเภอชัยบาดาล จ.ลพบุรี 15130",
};

// --- แท็บ "สถานะราย Bench" ---
// [ลำดับ, ระดับ, พื้นที่, ตามแผน, สถานะ, [[ชื่อสี, จำนวนที่ปลูกจริง], ...]]
// พื้นที่ของ +240 / +234 เว้นว่างใน sheet — ใส่ 0 (ยอดรวม 5,606 ของ sheet
// คิดจากแถวอื่นพอดี แปลว่าช่องว่างมีค่าเป็น 0)
const BENCHES = [
  [1, 270, 9, 8, "planted_repair", [["ชมพู", 9]]],
  [2, 264, 25, 21, "planted_repair", [["ส้ม", 25]]],
  [3, 258, 113, 94, "planted_repair", [["ขาวปลายชมพู", 68]]],
  [4, 252, 140, 117, "planted_repair", [["ชมพู", 65]]],
  [5, 246, 288, 240, "planted_repair", [["ส้ม", 294]]],
  [6, 240, 0, 0, "planted_repair", [["ขาวปลายชมพู", 244]]],
  [7, 234, 0, 0, "planted_repair", [["แดง", 550]]],
  [8, 228, 489, 408, "not_planted", []],
  [9, 222, 760, 633, "not_planted", []],
  [10, 216, 1105, 921, "not_planted", []],
  // หมายเหตุใน sheet: "ปลูกคละสีแดง 509 ต้น + สีส้ม 290"
  [11, 210, 1257, 1048, "planted", [["แดง", 509], ["ส้ม", 290]]],
  [12, 204, 1420, 1183, "preparing", []],
];

// ชื่อสีย่อใน sheet -> ชื่อพันธุ์เต็มในตาราง species
const SPECIES_BY_COLOUR = {
  "ส้ม": "เฟื่องฟ้าสีส้ม",
  "ชมพู": "เฟื่องฟ้าสีชมพู",
  "ขาวปลายชมพู": "เฟื่องฟ้าสีขาวปลายชมพู",
  "แดง": "เฟื่องฟ้าสีแดง",
};

// --- แท็บ "TimeLine" ---
// วันที่ใน sheet เป็นรูปแบบ วัน/เดือน/พ.ศ. (ยืนยันจาก "17/07/69" ในหมายเหตุ)
// แถวที่เว้นวันที่ว่างถือว่าใช้วันเดียวกับแถวบน (เซลล์ถูกรวมไว้ใน sheet)
const ACTIVITIES = [
  ["2026-11-07", "เตรียมดิน", 210, "ปรับหน้าดิน", "ปรับหน้าดินเป็นขันแล้วเสร็จวันที่ 17/07/69", "สูง 1.5 m", "เสร็จแล้ว", ""],
  ["2026-11-07", "ปลูกต้นไม้", 210, "ปลูกเฟื่องฟ้าสีแดง", "ปลูกเฟื่องฟ้าสีแดงตามระยะกำหนด", "195 ต้น", "เสร็จแล้ว", ""],
  ["2026-11-07", "ปลูกต้นไม้", 210, "ปลูกเฟื่องฟ้าสีแดง", "ปลูกเฟื่องฟ้าสีแดงตามระยะกำหนด", "164 ต้น", "เสร็จแล้ว", ""],
  ["2026-11-07", "ติดตั้งบันได", 210, "ติดตั้งบันได", "เชื่อมบันไดขึ้นไปชั้น 216", "ขาดอีก 2 ขั้น", "ล่าช้า", ""],
  ["2026-11-07", "ปลูกต้นไม้", 210, "ปลูกเฟื่องฟ้าสีแดง", "ปลูกเฟื่องฟ้าสีแดงตามระยะกำหนด", "150 ต้น", "เสร็จแล้ว", ""],
  ["2026-08-08", "ปลูกต้นไม้", 210, "ปลูกเฟื่องฟ้าสีส้ม", "ปลูกเฟื่องฟ้าสีส้มตามระยะกำหนด", "200 ต้น", "เสร็จแล้ว", ""],
  ["2026-08-11", "ปลูกต้นไม้", 210, "ปลูกเฟื่องฟ้าสีส้ม", "ปลูกเฟื่องฟ้าสีส้มตามระยะกำหนด", "90 ต้น", "เสร็จแล้ว", "B210 ปลูกครบเรียบร้อยแล้ว"],
  ["2026-08-14", "รับต้นไม้เข้า", null, "รับต้นไม้เข้า", "รับต้นไม้เข้า 1,500 ต้น", "", "", ""],
];

// ประกอบคำอธิบายให้เหมือนรูปแบบที่มีอยู่เดิมในฐานข้อมูล
function buildDescription(detail, result, status, note) {
  let text = detail;
  if (result) text += ` ผลงาน: ${result}`;
  if (status) text += ` (สถานะ: ${status})`;
  if (note) text += ` หมายเหตุ: ${note}`;
  return text;
}

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ---------- sites ----------
    await conn.query(
      `UPDATE sites SET name = :name, company_name = :company, location = :location
        WHERE id = :id`,
      { name: SITE.name, company: SITE.companyName, location: SITE.location, id: SITE_ID },
    );
    console.log("✔ ข้อมูลโครงการ (ชื่อ / ผู้ประกอบการ / ที่ตั้ง)");

    // ---------- species: หา id จากชื่อ ----------
    const [speciesRows] = await conn.query("SELECT id, name_th FROM species");
    const speciesId = new Map(speciesRows.map((s) => [s.name_th, s.id]));
    for (const full of Object.values(SPECIES_BY_COLOUR)) {
      if (!speciesId.has(full)) throw new Error(`ไม่พบพันธุ์พืชชื่อ "${full}" ในตาราง species`);
    }

    // ---------- bench_levels ----------
    const [existing] = await conn.query(
      "SELECT id, elevation_m FROM bench_levels WHERE site_id = :siteId",
      { siteId: SITE_ID },
    );
    const benchIdByElevation = new Map(existing.map((b) => [Number(b.elevation_m), b.id]));

    let added = 0;
    for (const [seq, elevation, area, planned, status] of BENCHES) {
      const id = benchIdByElevation.get(elevation);
      if (id) {
        await conn.query(
          `UPDATE bench_levels
              SET area_sqm = :area, planned_tree_count = :planned,
                  status = :status, sequence_order = :seq
            WHERE id = :id`,
          { area, planned, status, seq, id },
        );
      } else {
        const [res] = await conn.query(
          `INSERT INTO bench_levels
             (site_id, elevation_m, area_sqm, planned_tree_count, status, sequence_order)
           VALUES (:siteId, :elevation, :area, :planned, :status, :seq)`,
          { siteId: SITE_ID, elevation, area, planned, status, seq },
        );
        benchIdByElevation.set(elevation, res.insertId);
        added += 1;
      }
    }
    console.log(`✔ ระดับชั้น ${BENCHES.length} ระดับ (เพิ่มใหม่ ${added})`);

    // ---------- plantings ----------
    // เขียนทับทั้งชุดต่อระดับชั้น เพราะ sheet เป็นแหล่งข้อมูลหลัก
    let plantingRows = 0;
    for (const [, elevation, , , , plantings] of BENCHES) {
      const benchId = benchIdByElevation.get(elevation);
      await conn.query("DELETE FROM plantings WHERE bench_level_id = :benchId", { benchId });
      for (const [colour, count] of plantings) {
        await conn.query(
          `INSERT INTO plantings (bench_level_id, species_id, tree_count)
           VALUES (:benchId, :speciesId, :count)`,
          { benchId, speciesId: speciesId.get(SPECIES_BY_COLOUR[colour]), count },
        );
        plantingRows += 1;
      }
    }
    console.log(`✔ ข้อมูลการปลูก ${plantingRows} รายการ`);

    // ---------- activities ----------
    // ลบเฉพาะกิจกรรมที่ไม่มีรูปแนบ แล้วใส่ชุดจาก sheet เข้าไปใหม่
    // กิจกรรมที่มีรูป (หรือมีรูปใน post_images) จะอัปเดตแทนการลบ เพื่อไม่ให้รูปหาย
    const [withImages] = await conn.query(
      `SELECT DISTINCT a.id, a.activity_type, a.title, a.description
         FROM activities a
         LEFT JOIN post_images pi ON pi.activity_id = a.id
        WHERE a.site_id = :siteId AND (a.image_url IS NOT NULL OR pi.id IS NOT NULL)`,
      { siteId: SITE_ID },
    );
    const keepIds = new Set(withImages.map((a) => a.id));

    // ใช้ placeholder แบบตำแหน่ง (?) ทั้งคู่ — ผสมกับแบบชื่อ (:name) ในคำสั่งเดียว
    // ไม่ได้ mysql2 จะไม่แทนค่าให้ และ MariaDB จะมองว่า ":siteId" เป็น syntax error
    if (keepIds.size) {
      await conn.query("DELETE FROM activities WHERE site_id = ? AND id NOT IN (?)", [
        SITE_ID,
        [...keepIds],
      ]);
    } else {
      await conn.query("DELETE FROM activities WHERE site_id = ?", [SITE_ID]);
    }

    // จับคู่กิจกรรมที่เก็บรูปไว้กับแถวใน sheet ด้วย ประเภท + ชื่อ
    const usedKeep = new Set();
    let inserted = 0;
    let updated = 0;
    for (const [date, type, benchElevation, title, detail, result, status, note] of ACTIVITIES) {
      const description = buildDescription(detail, result, status, note);
      const benchId = benchElevation == null ? null : benchIdByElevation.get(benchElevation) ?? null;

      // จับคู่ด้วย "ผลงาน" (เช่น 200 ต้น / 90 ต้น) ด้วย ไม่ใช่แค่ประเภท+ชื่อ —
      // หลายแถวใน sheet มีประเภทและชื่อซ้ำกัน ถ้าจับคู่แค่สองอย่างนั้น
      // รูปอาจไปติดกับกิจกรรมผิดตัวขึ้นกับลำดับที่อ่านมาจากฐานข้อมูล
      const plainDescription = (text) => String(text || "").replace(/<[^>]*>/g, "");
      const match = withImages.find(
        (a) =>
          !usedKeep.has(a.id) &&
          a.activity_type === type &&
          a.title === title &&
          (!result || plainDescription(a.description).includes(result)),
      );

      if (match) {
        usedKeep.add(match.id);
        await conn.query(
          `UPDATE activities
              SET activity_date = :date, bench_level_id = :benchId, description = :description
            WHERE id = :id`,
          { date, benchId, description, id: match.id },
        );
        updated += 1;
      } else {
        await conn.query(
          `INSERT INTO activities
             (site_id, bench_level_id, activity_type, title, description, activity_date)
           VALUES (:siteId, :benchId, :type, :title, :description, :date)`,
          { siteId: SITE_ID, benchId, type, title, description, date },
        );
        inserted += 1;
      }
    }
    console.log(`✔ กิจกรรม ${ACTIVITIES.length} รายการ (เพิ่ม ${inserted}, อัปเดตแบบเก็บรูปไว้ ${updated})`);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // ---------- สรุปผล ----------
  const [[overview]] = await pool.query(
    "SELECT * FROM v_site_overview WHERE site_id = :id",
    { id: SITE_ID },
  );
  console.log("\n--- ตัวเลขภาพรวมหลังอัปเดต ---");
  console.log("ระดับชั้นทั้งหมด :", overview.total_benches);
  console.log("ปลูกแล้ว        :", overview.planted_benches);
  console.log("ยังไม่ได้ปลูก    :", overview.not_planted_benches);
  console.log("พื้นที่รวม       :", Number(overview.total_area_sqm), "ตร.ม.");
  console.log("ต้นไม้รวม       :", overview.total_trees, "ต้น");
  console.log("ความคืบหน้า      :", overview.coverage_pct + "%");

  const [totals] = await pool.query(
    "SELECT name_th, total_trees FROM v_species_totals WHERE site_id = :id ORDER BY total_trees DESC",
    { id: SITE_ID },
  );
  console.log("\n--- จำนวนต้นแยกตามพันธุ์ ---");
  totals.forEach((t) => console.log(" ", t.name_th, "=", t.total_trees));

  await pool.end();
}

main().catch((err) => {
  console.error("เกิดข้อผิดพลาด:", err.message);
  process.exit(1);
});
