// ใส่เนื้อหาตัวอย่างของ section "เรื่องราวการฟื้นฟู" (ภาพรวม → Final Pit → ระบบน้ำ)
//
// **เป็นข้อความและรูปตัวอย่างเท่านั้น** ตั้งใจให้เห็นว่า section หน้าตาเป็นอย่างไร
// แล้วเข้าไปแก้เนื้อหาจริงเองในหน้าแอดมิน → เรื่องราวการฟื้นฟู
//
// รันซ้ำจะ "เขียนทับ" ขั้นตอนตัวอย่างชุดเดิม (จับคู่ด้วย sort_order) แต่ไม่แตะ
// ขั้นตอนที่เพิ่มเองเกินจำนวนนี้ และไม่แตะรูปที่อัปโหลดไว้เอง
//
// วิธีใช้: npm run db:seed-story

import "dotenv/config";
import { pool } from "../src/config/db.js";

const SITE_ID = 1;

const STORY_TITLE = "จากบ่อเหมืองสู่ภูเขาสีเขียว";

const STORY_INTRO =
  "<p>ภาพรวมของแผนฟื้นฟูตั้งแต่วันแรกที่หยุดทำเหมือง ไปจนถึงรูปร่างสุดท้ายของบ่อเหมือง " +
  "(<strong>Final Pit</strong>) และระบบสูบน้ำที่จะส่งน้ำขึ้นไปเลี้ยงต้นไม้บนระดับชั้นด้านบน</p>" +
  "<p><em>ข้อความและรูปในส่วนนี้เป็นตัวอย่าง แก้ไขได้จากหน้าจัดการข้อมูล</em></p>";

// รูปตัวอย่างสร้างจาก placehold.co — เปลี่ยนเป็นรูปถ่ายจริงได้จากหน้าแอดมิน
const img = (text, colour = "1F4D3A") =>
  `https://placehold.co/1200x800/${colour}/F7F4EC?text=${encodeURIComponent(text)}`;

const STEPS = [
  {
    eyebrow: "ระยะที่ 1",
    title: "สำรวจและวางแผนพื้นที่หลังหยุดทำเหมือง",
    body:
      "<p>เริ่มจากสำรวจสภาพหน้าดิน ความลาดชัน และทิศทางการไหลของน้ำในแต่ละระดับชั้น " +
      "เพื่อกำหนดว่าชั้นไหนต้องปรับก่อน และชั้นไหนรับน้ำได้เองตามธรรมชาติ</p>" +
      "<ul><li>รังวัดระดับชั้นทั้งหมดตั้งแต่ +270 ลงมาถึงฐาน</li>" +
      "<li>ประเมินความมั่นคงของหน้าผาแต่ละชั้น</li>" +
      "<li>วางผังตำแหน่งบ่อพักน้ำและแนวท่อ</li></ul>",
    images: [img("สำรวจพื้นที่"), img("รังวัดระดับชั้น", "2C6B47")],
  },
  {
    eyebrow: "ระยะที่ 2",
    title: "ปรับหน้าดินเป็นขั้นบันได (Bench)",
    body:
      "<p>ปรับหน้าดินแต่ละชั้นให้เป็นขั้นบันไดที่มีความลาดเอียงเข้าหาผนัง " +
      "เพื่อให้น้ำฝนไหลช้าลงและซึมลงดินแทนที่จะชะหน้าดินลงไปกองที่ก้นบ่อ</p>" +
      "<p>ขั้นบันไดยังทำให้รถบรรทุกต้นกล้าและถังน้ำขึ้นไปถึงชั้นบนได้</p>",
    images: [img("ปรับหน้าดินเป็นขั้นบันได", "8A6B54")],
  },
  {
    eyebrow: "ระยะที่ 3",
    title: "ปลูกพืชคลุมดินไล่จากชั้นล่างขึ้นบน",
    body:
      "<p>ปลูกเฟื่องฟ้าซึ่งทนแล้งและรากยึดหน้าดินได้ดี โดยเริ่มจากชั้นล่างที่เข้าถึงง่ายก่อน " +
      "แล้วไล่ขึ้นไปตามความพร้อมของระบบน้ำในแต่ละชั้น</p>" +
      "<p>ชั้นที่ปลูกแล้วจะเข้าสู่รอบ <strong>ซ่อมปลูก</strong> คือตรวจอัตรารอดแล้วปลูกทดแทนต้นที่ตาย</p>",
    images: [img("ปลูกพืชคลุมดิน", "3F8F5F"), img("ซ่อมปลูกต้นที่ตาย", "4E8F66")],
  },
  {
    eyebrow: "หัวใจของแผน",
    title: "ระบบสูบน้ำขึ้นเขาแบบเป็นทอด",
    body:
      "<p>น้ำที่ก้นบ่อเหมืองคือแหล่งน้ำหลักของทั้งโครงการ แต่สูบขึ้นไปถึงชั้นบนสุดในทีเดียวไม่ได้ " +
      "จึงออกแบบให้สูบเป็นทอดๆ ทีละช่วง</p>" +
      "<ol><li><strong>บ่อรับน้ำที่ก้นบ่อ</strong> — รวมน้ำฝนและน้ำใต้ดินไว้จุดเดียว</li>" +
      "<li><strong>ปั๊มทอดที่ 1</strong> — ส่งขึ้นไปพักที่บ่อพักระดับกลาง</li>" +
      "<li><strong>บ่อพักระดับกลาง</strong> — พักน้ำให้ตะกอนตกก่อนส่งต่อ</li>" +
      "<li><strong>ปั๊มทอดที่ 2</strong> — ส่งขึ้นถังสูงบนชั้นบนสุด</li>" +
      "<li><strong>จ่ายด้วยแรงโน้มถ่วง</strong> — ปล่อยไหลลงมาตามท่อเลี้ยงต้นไม้ทีละชั้น</li></ol>" +
      "<p>ข้อดีคือช่วงบนไม่ต้องใช้ปั๊มเลย ประหยัดไฟและซ่อมบำรุงง่ายกว่า</p>",
    images: [
      img("ผังระบบสูบน้ำขึ้นเขา", "1F4D3A"),
      img("บ่อพักระดับกลาง", "2C6B47"),
      img("ถังสูงชั้นบนสุด", "183C2D"),
    ],
  },
  {
    eyebrow: "ภาพสุดท้าย",
    title: "Final Pit — รูปร่างสุดท้ายของบ่อเหมือง",
    body:
      "<p>เมื่อฟื้นฟูครบทุกระดับชั้น บ่อเหมืองจะกลายเป็นแอ่งน้ำถาวรที่ล้อมด้วยขั้นบันไดสีเขียว " +
      "น้ำในบ่อทำหน้าที่สองอย่างพร้อมกัน คือเป็นแหล่งน้ำของระบบรดน้ำ และเป็นแหล่งน้ำของสัตว์ในพื้นที่</p>" +
      "<p style=\"text-align:center\"><strong>เป้าหมาย: พื้นที่สีเขียวเต็มทุกระดับชั้น และระบบน้ำที่ดูแลตัวเองได้</strong></p>",
    images: [img("Final Pit", "122F24"), img("แอ่งน้ำถาวร", "1F4D3A")],
  },
];

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      "UPDATE sites SET story_title = :title, story_intro = :intro WHERE id = :id",
      { title: STORY_TITLE, intro: STORY_INTRO, id: SITE_ID },
    );

    const [existing] = await conn.query(
      "SELECT id, sort_order FROM story_steps WHERE site_id = :siteId ORDER BY sort_order",
      { siteId: SITE_ID },
    );
    const idByOrder = new Map(existing.map((r) => [Number(r.sort_order), r.id]));

    for (const [index, step] of STEPS.entries()) {
      let stepId = idByOrder.get(index);

      if (stepId) {
        await conn.query(
          `UPDATE story_steps SET eyebrow = :eyebrow, title = :title, body = :body
            WHERE id = :id`,
          { eyebrow: step.eyebrow, title: step.title, body: step.body, id: stepId },
        );
      } else {
        const [res] = await conn.query(
          `INSERT INTO story_steps (site_id, eyebrow, title, body, sort_order)
           VALUES (:siteId, :eyebrow, :title, :body, :order)`,
          {
            siteId: SITE_ID,
            eyebrow: step.eyebrow,
            title: step.title,
            body: step.body,
            order: index,
          },
        );
        stepId = res.insertId;
      }

      // ใส่รูปตัวอย่างเฉพาะขั้นตอนที่ยังไม่มีรูป — ถ้าเคยอัปโหลดรูปจริงไว้แล้ว
      // การรันซ้ำจะไม่ไปทับของจริงด้วยรูป placeholder
      const [[imgCount]] = await conn.query(
        "SELECT COUNT(*) AS n FROM post_images WHERE story_step_id = :id",
        { id: stepId },
      );
      if (Number(imgCount.n) === 0) {
        const values = step.images.map((url, i) => [stepId, url, i]);
        await conn.query(
          "INSERT INTO post_images (story_step_id, image_url, sort_order) VALUES ?",
          [values],
        );
        await conn.query("UPDATE story_steps SET image_url = :cover WHERE id = :id", {
          cover: step.images[0],
          id: stepId,
        });
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [steps] = await pool.query(
    `SELECT s.sort_order, s.eyebrow, s.title,
            (SELECT COUNT(*) FROM post_images pi WHERE pi.story_step_id = s.id) AS imgs
       FROM story_steps s WHERE s.site_id = :id ORDER BY s.sort_order`,
    { id: SITE_ID },
  );
  console.log(`ใส่เนื้อหาตัวอย่าง ${steps.length} ขั้นตอน ✔\n`);
  steps.forEach((s) =>
    console.log(` ${s.sort_order}. [${s.eyebrow}] ${s.title} — รูป ${s.imgs} รูป`),
  );
  console.log("\nแก้เนื้อหาจริงได้ที่ หน้าแอดมิน → เรื่องราวการฟื้นฟู");

  await pool.end();
}

main().catch((err) => {
  console.error("เกิดข้อผิดพลาด:", err.message);
  process.exit(1);
});
