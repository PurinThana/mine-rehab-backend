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
  ├──< progress_snapshots
  └──< users
```

**ทำไมแยกแบบนี้:**
- `bench_levels.status` (`planted` / `not_planted`) คือค่าที่ตารางสรุปบนหน้าเว็บใช้กรองโดยตรง ส่วน `plantings` เก็บรายละเอียดจำนวนต้นแยกตามพันธุ์ — สอง concept นี้แยกกันตั้งใจ เพราะบางครั้งอยากรู้ "ปลูกแล้วกี่ระดับ" เร็วๆ โดยไม่ต้อง join
- `plantings` เป็นตารางกลางระหว่าง `bench_levels` กับ `species` (many-to-many) เพราะพันธุ์เดียวกันใช้ปลูกได้หลายระดับชั้น
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
| POST | `/documents` | staff | เพิ่มเอกสาร (metadata — ต้องอัปโหลดไฟล์ไปที่ storage เองก่อน) |
| PUT | `/documents/:id` | staff | แก้ไขข้อมูลเอกสาร |
| DELETE | `/documents/:id` | staff | ลบเอกสาร |
| GET | `/sites/:siteId/news?limit=` | - | ข่าวสารและประกาศ (มี `images` ด้วย) |
| GET | `/news/:id` | - | ข่าวเดียว + รายการรูป (หน้ารายละเอียด) |
| POST | `/news` | staff | เพิ่มข่าว |
| PUT | `/news/:id` | staff | แก้ไขข่าว |
| DELETE | `/news/:id` | staff | ลบข่าว |
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




## รูปหลายรูป และเนื้อหาที่จัดรูปแบบได้

### ตาราง post_images

กิจกรรมและข่าวมีรูปได้หลายรูป (สูงสุด 12 รูป) เก็บใน `post_images` ตารางเดียว
ที่มี FK สองตัวเป็น NULL ได้ทั้งคู่ แล้วบังคับด้วย CHECK ว่าต้องมีเจ้าของ
เพียงหนึ่งเดียว — ได้ `ON DELETE CASCADE` จริงทั้งสองทาง ซึ่งถ้าใช้
`owner_type`/`owner_id` แบบ polymorphic จะเสีย FK ไป

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
## ที่เก็บไฟล์รูปและ PDF (Cloudinary)

ตาราง `documents` เก็บแค่ลิงก์ไฟล์ ไม่เก็บตัวไฟล์ และ host ฟรีอย่าง Render มี filesystem
แบบ ephemeral (ไฟล์หายทุกครั้งที่ deploy) จึงต้องฝากไฟล์ไว้ที่อื่น — เลือก Cloudinary เพราะ
ฟรีถาวร ไม่ต้องใช้บัตรเครดิต และไม่ปิดบริการเองตอนทิ้งไว้ไม่ใช้

### ตั้งค่าครั้งเดียว

1. สมัครที่ [cloudinary.com](https://cloudinary.com) (ฟรี ไม่ต้องใส่บัตร)
2. Dashboard → **API Keys** → คัดลอก Cloud name, API Key, API Secret ใส่ในไฟล์ `.env`
3. **สำคัญ:** Settings → **Security** → ติ๊ก **"Allow delivery of PDF and ZIP files"**
   บัญชีฟรีบล็อกการส่ง PDF ออกไว้เป็นค่าเริ่มต้น ถ้าไม่ติ๊กข้อนี้ ลิงก์ดาวน์โหลดเอกสาร
   จะขึ้น error ทั้งที่อัปโหลดขึ้นไปสำเร็จแล้ว
4. รีสตาร์ต backend

ถ้ายังไม่ตั้งค่า ส่วนอื่นของ API ยังทำงานปกติ — เฉพาะ `POST /uploads` จะตอบ 503
พร้อมบอกว่าต้องตั้งตัวแปรอะไร และหน้าแอดมินยังวาง URL ไฟล์เองได้เหมือนเดิม

### รายละเอียดการทำงาน

- ไฟล์ไม่แตะดิสก์เลย — multer เก็บใน memory แล้ว stream ขึ้น Cloudinary ตรงๆ
- รูปอัปเป็น `resource_type: image` (โฟลเดอร์ `mine-rehab/images`), PDF อัปเป็น `raw`
  (โฟลเดอร์ `mine-rehab/documents`) เพื่อให้ URL เป็นไฟล์ตรงๆ ดาวน์โหลดได้
- รับเฉพาะ JPG, PNG, WebP, GIF, AVIF และ PDF ขนาดไม่เกิน `UPLOAD_MAX_FILE_MB` (ค่าเริ่มต้น 10 MB)
- ต้องล็อกอินก่อนอัปโหลด ไม่งั้นใครก็ยิงไฟล์เข้าบัญชี Cloudinary ของเราได้
- **การลบข้อมูลในหน้าแอดมินไม่ได้ลบไฟล์บน Cloudinary** ไฟล์ที่ไม่มีใครอ้างถึงจะค้างอยู่
  โควตาฟรี 25 GB ถือว่าเหลือเฟือสำหรับโครงการขนาดนี้ ถ้าจะให้ลบตามด้วยต้องเก็บ
  `public_id` เพิ่มในตารางแล้วเรียก destroy API
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
