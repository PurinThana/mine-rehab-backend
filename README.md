# Backend — ศูนย์ข้อมูลการฟื้นฟูเหมือง

Express + MySQL API สำหรับ [mine-rehab-landing](../mine-rehab-landing) ออกแบบตามหลัก:
**อ่านข้อมูล (GET) เปิดสาธารณะทั้งหมด — เขียนข้อมูล (POST/PUT/DELETE) ต้องล็อกอินเป็น กพร.**
ตรงกับปุ่ม "สำหรับ กพร." บนหน้าเว็บ

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env
# แก้ .env: ใส่ DB_USER, DB_PASSWORD, DB_NAME, JWT_SECRET ของจริง

npm run db:init     # สร้างฐานข้อมูลและตารางจาก src/db/schema.sql
npm run db:seed      # ใส่ข้อมูลตัวอย่างจาก src/db/seed.sql (ตรงกับ mock ในหน้าเว็บ)
npm run db:migrate   # เพิ่มคอลัมน์ใหม่ให้ฐานข้อมูลที่สร้างไว้ก่อนแล้ว (รันซ้ำได้)

npm run create-user -- --name="ผู้ดูแลระบบ" --email=admin@example.com --password="Str0ng!Pass123" --role=admin --site=1

npm run dev          # http://localhost:4000 (auto-restart on save)
```

ตรวจสอบว่า API พร้อมใช้งาน: `curl http://localhost:4000/health`

## โครงสร้างฐานข้อมูล

```
sites ──< bench_levels ──< plantings >── species
  │            │
  │            └──< activities >──< post_images
  ├──< documents
  ├──< news_posts >──< post_images
  ├──< story_steps >──< post_images
  ├──< progress_snapshots
  └──< users
```

**ทำไมแยกแบบนี้:**
- `bench_levels.status` (`planted` / `not_planted`) คือค่าที่ตารางสรุปบนหน้าเว็บใช้กรองโดยตรง ส่วน `plantings` เก็บรายละเอียดจำนวนต้นแยกตามพันธุ์ — สอง concept นี้แยกกันตั้งใจ เพราะบางครั้งอยากรู้ "ปลูกแล้วกี่ระดับ" เร็วๆ โดยไม่ต้อง join
- `plantings` เป็นตารางกลางระหว่าง `bench_levels` กับ `species` (many-to-many) เพราะพันธุ์เดียวกันใช้ปลูกได้หลายระดับชั้น
- `story_steps` คือขั้นตอนใน section "ภาพรวมแผนฟื้นฟู" (จากวันหยุดทำเหมืองไปจนถึง Final Pit) แยกเป็นตารางแทนที่จะเก็บเป็น HTML ก้อนเดียวใน `sites` เพราะเจ้าหน้าที่ต้องเพิ่ม/ลบ/สลับลำดับแต่ละขั้นได้เอง และแต่ละขั้นแนบรูปได้หลายรูป ส่วนหัวข้อกับคำนำของ section อยู่ที่ `sites.story_title` / `sites.story_intro` เพราะมีชุดเดียวต่อไซต์
- `progress_snapshots` เป็นตารางเดียวที่เก็บ "ประวัติ" — ตารางอื่นเก็บแค่สถานะปัจจุบัน ถ้าไม่มีตารางนี้จะย้อนดูความคืบหน้าเดือนก่อนๆ ไม่ได้เลย ควรตั้ง cron รายเดือนให้เรียก `POST /api/sites/:siteId/progress-snapshots` อัตโนมัติ
- ตัวเลขภาพรวม (83%, 3,747 ตร.ม., 3,123 ต้น) **ไม่มีคอลัมน์เก็บโดยตรง** — คำนวณสดจาก view `v_site_overview` และ `v_species_totals` เสมอ กันไม่ให้ตัวเลขเพี้ยนไปจากข้อมูลจริง

> ข้อมูลตัวอย่างใน `seed.sql` คำนวณผ่าน view แล้วจะได้ตัวเลขไม่ตรงกับที่เคย hardcode ไว้ในหน้าเว็บ mock เดิม (เช่น coverage ~64% แทนที่จะเป็น 83%) เพราะตอนนี้เป็นข้อมูลจริงที่คำนวณจากฐานข้อมูล ไม่ใช่ตัวเลขที่ตั้งไว้ลอยๆ — ปรับข้อมูลใน `seed.sql` หรือผ่าน API ได้ตามต้องการ

## Endpoints

Base URL: `http://localhost:4000/api`

| Method | Path | Auth | คำอธิบาย |
|---|---|---|---|
| POST | `/auth/login` | - | เข้าสู่ระบบ คืน JWT + `expiresAt` (unix seconds) |
| POST | `/auth/logout` | staff | จบ session (client ทิ้ง token — JWT ไม่มี state ฝั่งเซิร์ฟเวอร์) |
| GET | `/auth/me` | staff | ข้อมูลผู้ใช้ปัจจุบัน |
| POST | `/auth/change-password` | staff | เปลี่ยนรหัสผ่านตัวเอง (ต้องส่ง `currentPassword` + `newPassword`) |
| POST | `/uploads` | staff | อัปโหลดรูปหรือ PDF ขึ้น Cloudinary คืน URL กลับมา |
| GET | `/sites` | - | รายชื่อไซต์ทั้งหมด |
| GET | `/sites/:id` | - | ข้อมูลไซต์ |
| GET | `/sites/:id/overview` | - | ตัวเลขภาพรวม (StatsOverview.jsx) |
| POST | `/sites` | admin | สร้างไซต์ใหม่ |
| PUT | `/sites/:id` | staff | แก้ไขไซต์ |
| GET | `/sites/:siteId/bench-levels` | - | รายการระดับชั้นทั้งหมด + `total_trees` ต่อระดับชั้น (BenchSummary.jsx) |
| GET | `/bench-levels/:id` | - | ระดับชั้นเดียว + รายละเอียดการปลูก |
| POST | `/bench-levels` | staff | เพิ่มระดับชั้น |
| PUT | `/bench-levels/:id` | staff | แก้ไขระดับชั้น (พื้นที่ / สถานะ) |
| DELETE | `/bench-levels/:id` | admin | ลบระดับชั้น |
| GET | `/species` | - | รายชื่อพันธุ์พืชทั้งหมด |
| GET | `/sites/:siteId/species-totals` | - | จำนวนต้นแยกตามพันธุ์ (FlowerTypes.jsx) |
| POST | `/species` | staff | เพิ่มพันธุ์พืชใหม่ |
| PUT | `/species/:id` | staff | แก้ไขพันธุ์พืช |
| DELETE | `/species/:id` | admin | ลบพันธุ์พืช (409 ถ้ามี plantings อ้างอยู่) |
| POST | `/plantings` | staff | บันทึก/แก้ไขจำนวนต้นของพันธุ์หนึ่งในระดับชั้นหนึ่ง |
| DELETE | `/plantings/:id` | staff | ลบข้อมูลการปลูก |
| GET | `/sites/:siteId/activities?limit=` | - | กิจกรรมล่าสุด (RecentActivities.jsx) |
| GET | `/activities/:id` | - | กิจกรรมเดียว + ระดับชั้น + ชื่อไซต์ + รายการรูป |
| POST | `/activities` | staff | เพิ่มกิจกรรม |
| PUT | `/activities/:id` | staff | แก้ไขกิจกรรม |
| DELETE | `/activities/:id` | staff | ลบกิจกรรม |
| GET | `/sites/:siteId/documents` | - | รายการเอกสารดาวน์โหลด |
| GET | `/documents/:id/file` | - | ส่งตัวไฟล์ออก (ใช้เป็นลิงก์เปิด/ดาวน์โหลด) |
| POST | `/documents` | staff | เพิ่มเอกสาร (metadata — ต้องอัปโหลดไฟล์ไปที่ storage เองก่อน) |
| PUT | `/documents/:id` | staff | แก้ไขข้อมูลเอกสาร |
| DELETE | `/documents/:id` | staff | ลบเอกสาร |
| GET | `/sites/:siteId/news?limit=` | - | ข่าวสารและประกาศ (มี `images` ด้วย) |
| GET | `/news/:id` | - | ข่าวเดียว + รายการรูป (หน้ารายละเอียด) |
| POST | `/news` | staff | เพิ่มข่าว |
| PUT | `/news/:id` | staff | แก้ไขข่าว |
| DELETE | `/news/:id` | staff | ลบข่าว |
| GET | `/sites/:siteId/story-steps` | - | ขั้นตอนในเรื่องราวการฟื้นฟู เรียงตาม `sort_order` + รายการรูป (RehabStory.jsx) |
| POST | `/story-steps` | staff | เพิ่มขั้นตอน (ไม่ส่ง `sortOrder` = ต่อท้ายให้เอง) |
| PUT | `/story-steps/:id` | staff | แก้ไขขั้นตอน (ใช้สลับลำดับด้วยการส่ง `sortOrder`) |
| DELETE | `/story-steps/:id` | staff | ลบขั้นตอน (รูปที่แนบหายตาม) |
| GET | `/sites/:siteId/progress-snapshots?limit=` | - | ประวัติความคืบหน้า (สำหรับกราฟ) |
| POST | `/sites/:siteId/progress-snapshots` | staff | บันทึก snapshot จากสถานะปัจจุบัน |

ตัวอย่างการเรียก:

```bash
# เข้าสู่ระบบ
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Str0ng!Pass123"}'

# ใช้ token ที่ได้มาแก้ไขสถานะระดับชั้น
curl -X PUT http://localhost:4000/api/bench-levels/8 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"status":"planted"}'
```

## เชื่อมกับหน้าเว็บ (Vite React)

ใน `mine-rehab-landing`, แทนที่ค่าคงที่ในแต่ละ component ด้วย `fetch`, เช่น `StatsOverview.jsx`:

```js
useEffect(() => {
  fetch(`${import.meta.env.VITE_API_URL}/sites/1/overview`)
    .then((r) => r.json())
    .then(setOverview)
}, [])
```

แล้วเพิ่ม `.env` ฝั่ง frontend: `VITE_API_URL=http://localhost:4000/api`

อย่าลืมตั้ง `FRONTEND_ORIGIN` ใน `.env` ฝั่ง backend ให้ตรงกับ origin ของหน้าเว็บ (ค่าเริ่มต้น `http://localhost:5173`) ไม่งั้น CORS จะบล็อก





## นำข้อมูลจาก Google Sheet มาลงฐานข้อมูล

```bash
npm run db:migrate     # ต้องรันก่อน (เพิ่มคอลัมน์และขยาย ENUM)
npm run db:sync-sheet  # นำข้อมูลจาก sheet ลงฐานข้อมูล
```

ค่าทั้งหมดอยู่เป็นค่าคงที่ใน `scripts/syncFromSheet.js` ไม่ได้ดึงสดจาก Google
ตอนรัน — ผลลัพธ์จึงคงที่ ตรวจย้อนหลังได้ และไม่พังถ้า sheet ถูกแก้ระหว่างทาง
ถ้า sheet อัปเดต ให้แก้ค่าในไฟล์นั้นแล้วรันใหม่

สคริปต์ทำงานในทรานแซกชันเดียว (ล้มก็ย้อนกลับทั้งชุด) และรันซ้ำได้

**กิจกรรมที่มีรูปแนบจะถูกอัปเดตแทนการลบทิ้ง** เพื่อไม่ให้รูปหาย โดยจับคู่ด้วย
ประเภท + ชื่อ + "ผลงาน" (เช่น 200 ต้น) — ต้องใช้ผลงานด้วยเพราะหลายแถวใน sheet
มีประเภทกับชื่อซ้ำกัน ถ้าจับคู่แค่สองอย่างแรก รูปอาจไปติดกับกิจกรรมผิดตัว

### สถานะของระดับชั้น

sheet ใช้ 4 สถานะ ENUM ของ `bench_levels.status` จึงขยายเป็น:

| ค่าในฐานข้อมูล | ป้ายบนหน้าเว็บ | นับเป็น "ปลูกแล้ว" |
|---|---|---|
| `planted` | ปลูกแล้ว | ✓ |
| `planted_repair` | ปลูกแล้วรอซ่อม | ✓ |
| `not_planted` | ยังไม่ได้ปลูก | — |
| `preparing` | เตรียมพื้นที่ | — |

`planted_repair` นับเป็นปลูกแล้วใน `v_site_overview` เพราะต้นไม้ลงดินไปแล้ว
รอซ่อมเฉพาะจุดที่ตาย ส่วน `preparing` ยังไม่ได้ปลูก

`POST /plantings` เลื่อนสถานะเป็น `planted` **เฉพาะเมื่อเดิมเป็น `not_planted`
หรือ `preparing`** — ถ้าเขียนทับทุกกรณี ระดับชั้นที่เป็น "ปลูกแล้วรอซ่อม"
จะถูกลดเหลือ "ปลูกแล้ว" ทันทีที่แก้จำนวนต้น ทำให้ข้อมูลที่ตั้งไว้หายเงียบๆ

ฝั่งหน้าเว็บนิยามป้ายชื่อและสีไว้ที่ `src/utils/benchStatus.js` ที่เดียว
ทั้งหน้าสาธารณะและหน้าแอดมินอ่านจากตัวนั้น
## รูปหลายรูป และเนื้อหาที่จัดรูปแบบได้

### ตาราง post_images

กิจกรรม ข่าว และขั้นตอนในเรื่องราวการฟื้นฟู มีรูปได้หลายรูป (สูงสุด 12 รูป)
เก็บใน `post_images` ตารางเดียวที่มี FK สามตัว (`activity_id`, `news_post_id`,
`story_step_id`) เป็น NULL ได้ทุกตัว แล้วบังคับด้วย CHECK ว่าต้องมีเจ้าของ
เพียงหนึ่งเดียว — ได้ `ON DELETE CASCADE` จริงทุกทาง ซึ่งถ้าใช้
`owner_type`/`owner_id` แบบ polymorphic จะเสีย FK ไป

```sql
CHECK ((activity_id IS NOT NULL) + (news_post_id IS NOT NULL)
       + (story_step_id IS NOT NULL) = 1)
```

เขียนเป็นผลบวกแทน `<>` เพราะกันได้ทั้งกรณีไม่มีเจ้าของเลยและมีเจ้าของเกินหนึ่ง
ในเงื่อนไขเดียว และเพิ่มเจ้าของแบบที่สี่ในอนาคตได้โดยไม่ต้องเขียนใหม่ทั้งก้อน

**ไม่มี endpoint แยกสำหรับรูป** — ส่ง `images: [url1, url2]` มากับตัวโพสต์
ตอน POST/PUT แล้วเซิร์ฟเวอร์ลบของเดิมและใส่ชุดใหม่ในทรานแซกชันเดียว

- ลำดับใน array = ลำดับที่แสดงบน carousel (`sort_order`)
- **รูปแรกกลายเป็น `image_url` (รูปปก) อัตโนมัติ** — การ์ดในหน้ารายการจึงดึงปก
  ได้โดยไม่ต้อง join และปกไม่มีทางขัดกับแกลเลอรี เพราะมีที่เขียนอยู่ที่เดียว
- ไม่ส่ง `images` มาเลย = ไม่แตะรูปเดิม / ส่ง `[]` = ลบรูปทั้งหมด
- URL ซ้ำถูกตัดออกโดยคงลำดับที่ผู้ใช้จัดไว้

### เนื้อหา HTML (activities.description, news_posts.body)

สองคอลัมน์นี้เก็บ HTML จากตัวแก้ไขในหน้าแอดมิน (ตัวหนา สี จัดตำแหน่ง รายการ)

**ล้างด้วย allowlist ที่ฝั่งเซิร์ฟเวอร์ทุกครั้งก่อนเก็บ** (`src/utils/richText.js`)
เพราะหน้าเว็บสาธารณะแสดงค่านี้ด้วย `dangerouslySetInnerHTML` — ถ้าเก็บ HTML ดิบ
ใครที่เข้าถึงบัญชีเจ้าหน้าที่ได้จะฝัง `<script>` ให้รันในเบราว์เซอร์ผู้เข้าชมได้
ล้างตอนเขียนหมายความว่าในฐานข้อมูลไม่เคยมีของอันตรายอยู่เลย

ทดสอบแล้วว่าตัดออก: `<script>`, `onerror`/`onclick`, `href="javascript:"`,
`position:fixed` และ style อื่นที่ไม่อยู่ใน allowlist

`<font color>` ที่ `execCommand` รุ่นเก่าสร้าง จะถูกแปลงเป็น `<span style="color:…">`
ไม่ใช่ตัดทิ้ง เพื่อไม่ให้สีที่ผู้ใช้ตั้งไว้หายเงียบๆ ตอนบันทึก

ข้อมูลเก่าที่เป็นข้อความธรรมดายังใช้ได้ตามปกติ ฝั่งหน้าเว็บตรวจว่ามี tag ไหม
ถ้าไม่มีก็แสดงเป็นข้อความล้วนพร้อมรักษาการเว้นบรรทัด ไม่ต้องแปลงข้อมูลเดิม
## section เรื่องราวการฟื้นฟู (story_steps)

section "ภาพรวมแผนฟื้นฟู" บนหน้าแรกเล่าตั้งแต่วันหยุดทำเหมืองไปจนถึงรูปร่าง
สุดท้ายของบ่อเหมือง (Final Pit) รวมถึงระบบสูบน้ำขึ้นเขา ทุกอย่างมาจากฐานข้อมูล
แก้ได้จากหน้าแอดมิน → **เรื่องราวการฟื้นฟู** โดยไม่ต้องแตะโค้ด

| ที่เก็บ | ใช้ทำอะไร |
|---|---|
| `sites.story_title` | หัวข้อใหญ่ของ section (เว้นว่าง = ใช้ค่าตั้งต้นในโค้ด) |
| `sites.story_intro` | คำนำใต้หัวข้อ เป็น HTML ที่จัดรูปแบบได้ |
| `story_steps.eyebrow` | ป้ายกำกับเล็กเหนือหัวข้อ เช่น "ระยะที่ 1" หรือ "ภาพสุดท้าย" |
| `story_steps.title` | หัวข้อของขั้นตอน (จำเป็น) |
| `story_steps.body` | เนื้อหา เป็น HTML ที่จัดรูปแบบได้ (ผ่าน sanitizer ชุดเดียวกับข่าว) |
| `story_steps.sort_order` | ลำดับที่แสดง — หน้าแอดมินสลับด้วยปุ่มขึ้น/ลง |
| `post_images.story_step_id` | รูปประกอบหลายรูป แสดงเป็น carousel |

**ข้อมูลตัวอย่าง 5 ขั้น** ใส่ได้ด้วย:

```bash
npm run db:seed-story
```

สคริปต์นี้รันซ้ำได้ไม่พัง — จับคู่ขั้นตอนเดิมด้วย `sort_order` แล้วอัปเดตข้อความ
และจะ **ไม่ทับรูปที่อัปโหลดไว้จริง** (ใส่รูป placeholder ให้เฉพาะขั้นที่ยังไม่มีรูป)
ตั้งใจให้เป็นโครงไว้ก่อน แล้วเจ้าหน้าที่เข้าไปแก้ข้อความและเปลี่ยนรูปเป็นของจริงเอง

> ถ้าลบขั้นตอนออกหมด section นี้จะหายไปจากหน้าเว็บเลย ไม่แสดงหัวข้อลอยๆ ทิ้งไว้

## ที่เก็บไฟล์รูปและ PDF (Cloudinary)

ตาราง `documents` เก็บแค่ลิงก์ไฟล์ ไม่เก็บตัวไฟล์ และ host ฟรีอย่าง Render มี filesystem
แบบ ephemeral (ไฟล์หายทุกครั้งที่ deploy) จึงต้องฝากไฟล์ไว้ที่อื่น — เลือก Cloudinary เพราะ
ฟรีถาวร ไม่ต้องใช้บัตรเครดิต และไม่ปิดบริการเองตอนทิ้งไว้ไม่ใช้

### เพดานขนาดไฟล์

แยกเพดานตามชนิดไฟล์ เพราะ PDF (รายงาน แบบแปลน) ใหญ่กว่ารูปหน้างานมาก ถ้าใช้ตัวเลข
เดียวกันก็ต้องยกเพดานรูปขึ้นไปด้วย ซึ่งเปิดช่องให้อัปรูปความละเอียดมหาศาลที่หน้าเว็บ
ย่อลงเหลือไม่ถึงเมกะไบต์อยู่ดี

| ตัวแปรใน `.env` | ค่าเริ่มต้น |
|---|---|
| `UPLOAD_MAX_PDF_MB` | 50 |
| `UPLOAD_MAX_IMAGE_MB` | 10 |

multer ตั้งเพดานได้ค่าเดียวและตั้งก่อนรู้ชนิดไฟล์ จึงตั้งไว้ที่ค่าที่สูงกว่า แล้วให้
`uploads.controller.js` ตรวจตามชนิดจริงอีกชั้น (ดู `src/config/uploadLimits.js`)

ไฟล์อยู่ใน RAM ทั้งก้อนระหว่างอัปโหลด (multer `memoryStorage`) — ยิ่งยกเพดานสูงยิ่ง
กินแรมต่อคำขอ ถ้าไป deploy บน host ฟรีที่แรม 512 MB ควรเผื่อไว้ว่าอัปโหลดพร้อมกัน
หลายคนอาจทำให้แรมไม่พอ

> **สำคัญ: บัญชี Cloudinary มีเพดานของตัวเองอีกชั้น และค่าที่ต่ำกว่าเป็นตัวตัดสิน**
>
> แพ็กเกจฟรีรับได้ **ไม่เกิน 10 MB ต่อไฟล์** (10,485,760 bytes — ทดสอบกับบัญชีจริงแล้ว
> ทั้งแบบอัปโหลดปกติและแบบ chunked ก็ไม่ผ่านทั้งคู่) ตั้ง `UPLOAD_MAX_PDF_MB=50` ไว้
> ตัวเว็บจะรับไฟล์ 50 MB จริง แต่ Cloudinary จะปฏิเสธไฟล์ที่เกิน 10 MB โดยระบบจะแจ้ง
> ข้อความบอกชัดว่าติดที่ฝั่ง Cloudinary ไม่ใช่ที่เว็บ
>
> ถ้าต้องอัป PDF เกิน 10 MB จริงๆ ต้องอัปเกรดแพ็กเกจ Cloudinary หรือย้ายที่เก็บไฟล์
> ไปเจ้าอื่นที่ฟรีและรับไฟล์ใหญ่กว่า (เช่น Backblaze B2 หรือ Cloudflare R2)

### ตั้งค่าครั้งเดียว

1. สมัครที่ [cloudinary.com](https://cloudinary.com) (ฟรี ไม่ต้องใส่บัตร)
2. Dashboard → **API Keys** → คัดลอก Cloud name, API Key, API Secret ใส่ในไฟล์ `.env`
3. รีสตาร์ต backend

> ไม่ต้องไปติ๊ก "Allow delivery of PDF and ZIP files" แล้ว — ระบบเลี่ยงข้อจำกัดนั้น
> ด้วยการส่งไฟล์ผ่าน API เอง (ดูหัวข้อ "ทำไมลิงก์เอกสารต้องผ่าน API" ด้านล่าง)

ถ้ายังไม่ตั้งค่า ส่วนอื่นของ API ยังทำงานปกติ — เฉพาะ `POST /uploads` จะตอบ 503
พร้อมบอกว่าต้องตั้งตัวแปรอะไร และหน้าแอดมินยังวาง URL ไฟล์เองได้เหมือนเดิม

### รายละเอียดการทำงาน

- ไฟล์ไม่แตะดิสก์เลย — multer เก็บใน memory แล้ว stream ขึ้น Cloudinary ตรงๆ
- รูปอัปเป็น `resource_type: image` (โฟลเดอร์ `mine-rehab/images`), PDF อัปเป็น `raw`
  (โฟลเดอร์ `mine-rehab/documents`) เพื่อให้ URL เป็นไฟล์ตรงๆ ดาวน์โหลดได้
- รับเฉพาะ JPG, PNG, WebP, GIF, AVIF (ไม่เกิน `UPLOAD_MAX_IMAGE_MB` — ค่าเริ่มต้น 10 MB) และ PDF (ไม่เกิน `UPLOAD_MAX_PDF_MB` — ค่าเริ่มต้น 50 MB) โดยเพดานของบัญชี Cloudinary จำกัดอีกชั้น (ดูหัวข้อ “เพดานขนาดไฟล์”)
- ต้องล็อกอินก่อนอัปโหลด ไม่งั้นใครก็ยิงไฟล์เข้าบัญชี Cloudinary ของเราได้
- **การลบข้อมูลในหน้าแอดมินไม่ได้ลบไฟล์บน Cloudinary** ไฟล์ที่ไม่มีใครอ้างถึงจะค้างอยู่
  โควตาฟรี 25 GB ถือว่าเหลือเฟือสำหรับโครงการขนาดนี้ ถ้าจะให้ลบตามด้วยต้องเก็บ
  `public_id` เพิ่มในตารางแล้วเรียก destroy API

## ทำไมลิงก์เอกสารต้องผ่าน API (GET /documents/:id/file)

**บัญชี Cloudinary แบบฟรีบล็อกการส่งไฟล์ PDF ออกทาง URL สาธารณะ** ตอบ 401
พร้อม `X-Cld-Error: deny or ACL failure` เปิดลิงก์ตรงจึงไม่ได้

สิ่งที่ลองแล้วไม่ได้ผล:

- ตัดนามสกุล `.pdf` ออกจาก public_id — ใช้ได้กับไฟล์ที่อัปโหลดใหม่เท่านั้น
  ไฟล์ที่เคยอัปโหลดด้วย `.pdf` ถูกจำสถานะไว้แล้ว เปลี่ยนชื่อทีหลังไม่ช่วย
- signed URL แบบ `type: private` / `authenticated` — ตอบ 404 เพราะไฟล์เป็น
  `type: upload`

ทางที่ใช้จริง: เซิร์ฟเวอร์สร้าง **signed download URL ของ Admin API**
(`cloudinary.utils.private_download_url(publicId, '', { type: 'upload' })`) ด้วย
API secret ที่อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น แล้ว stream ไฟล์ต่อออกไปพร้อม
`Content-Type` และชื่อไฟล์ที่ถูกต้อง

- ได้ผลกับไฟล์**ทั้งเก่าและใหม่** ไม่ต้องอัปโหลดซ้ำ
- ไม่ต้องไปเปิดการตั้งค่าใดๆ ในบัญชี Cloudinary
- ชื่อไฟล์มาจากคอลัมน์ `title` เข้ารหัสแบบ RFC 5987 ชื่อภาษาไทยจึงไม่เพี้ยน
- signed URL มีอายุ 5 นาทีและไม่ถูกส่งออกไปให้ client เห็น
- เอกสารที่กรอก URL ภายนอกไว้จะ `302` ไปตรงๆ ไม่ดึงผ่านเซิร์ฟเวอร์

**ข้อแลกเปลี่ยน:** ไฟล์วิ่งผ่าน backend จึงใช้แบนด์วิดท์ของเซิร์ฟเวอร์และไม่ได้
ประโยชน์จาก CDN โดยตรง (ตั้ง `Cache-Control: public, max-age=3600` ไว้ช่วยลดรอบ)
ถ้าย้ายไปบัญชี Cloudinary แบบจ่ายเงินหรือเปิดการตั้งค่าส่ง PDF ได้แล้ว
จะเปลี่ยนไปลิงก์ตรงก็ได้ โดยแก้ที่ `documentsApi.fileUrl()` ฝั่ง frontend จุดเดียว

## รูปพื้นหลังส่วนหัวเว็บ (Hero)

`sites.hero_image_url` เก็บรูปพื้นหลังของ Hero ตั้งได้จากหน้าแอดมิน →
ข้อมูลโครงการ · ไม่ตั้งก็ได้ หน้าเว็บจะใช้พื้นสีเขียวเข้มเหมือนดีไซน์เดิม

ส่ง `heroImageUrl: null` = เอารูปออก / ไม่ส่งฟิลด์มาเลย = ไม่แตะรูปเดิม
## หมายเหตุการแก้ไขข้อมูล (PUT / DELETE)

- ทุก endpoint `PUT` ยืนยันว่าแถวมีอยู่ก่อนสั่ง `UPDATE` (ดู `src/utils/ensureExists.js`) เพราะ MySQL รายงาน `affectedRows` เป็นจำนวนแถวที่ *ค่าเปลี่ยนจริง* ไม่ใช่แถวที่ match — ถ้าเช็คแค่ `affectedRows` การกดบันทึกโดยไม่แก้อะไรจะได้ 404 ทั้งที่ข้อมูลมีอยู่
- `DELETE /plantings/:id` จะคืน `bench_levels.status` เป็น `not_planted` ให้อัตโนมัติเมื่อลบรายการปลูกสุดท้ายของระดับชั้นนั้นออก (คู่กับ `POST /plantings` ที่ตั้งเป็น `planted`) ไม่งั้น `coverage_pct` จะนับระดับชั้นที่ไม่มีต้นไม้เหลืออยู่ว่า "ปลูกแล้ว"
- ฟิลด์ที่ค่า `null` มีความหมาย (เช่น `activities.benchLevelId` = ไม่ผูกกับระดับชั้นใด, `news.body`) แยกจาก "ไม่ได้ส่งมา" ด้วยการเช็ค `hasOwnProperty` — ส่ง `null` มาคือสั่งล้างค่า ไม่ส่งมาเลยคือไม่แตะฟิลด์นั้น
- ยังไม่มี `DELETE /sites/:id` โดยตั้งใจ เพราะ FK เป็น `ON DELETE CASCADE` ทั้งหมด การลบไซต์เดียวจะล้างข้อมูลทั้งโครงการทิ้ง

## หมายเหตุด้านความปลอดภัย

- รหัสผ่านแฮชด้วย Node `crypto.scrypt` (ในตัว ไม่ต้องพึ่ง native dependency อย่าง bcrypt) — ดู `src/utils/password.js`
- ทุก query ใช้ parameterized placeholders (`mysql2` named params) ป้องกัน SQL injection อยู่แล้ว — อย่าต่อ string SQL เองเพิ่ม
- Endpoint GET ทั้งหมดเปิดสาธารณะโดยตั้งใจ (โปร่งใสตามจุดประสงค์เว็บ) — อย่าใส่ auth บน GET เว้นแต่ต้องการเปลี่ยนนโยบาย
- `POST /auth/login` มีตัวกันเดารหัสผ่าน (`src/middleware/loginRateLimit.js`) — ผิดเกิน `LOGIN_MAX_ATTEMPTS` ครั้งใน `LOGIN_WINDOW_MINUTES` นาที จะได้ 429 นับแยกตาม IP + อีเมล จึงไม่มีใครล็อกบัญชีคนอื่นได้ เก็บใน memory ของ process เดียว ถ้าขยายเป็นหลาย instance ต้องย้ายไป Redis
- Scripts ใน `scripts/` เปิด `multipleStatements` เฉพาะตอน setup เท่านั้น — pool หลักของแอป (`src/config/db.js`) ปิดไว้เสมอ
