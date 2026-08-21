import sanitizeHtml from "sanitize-html";

/**
 * ทำความสะอาด HTML จากตัวแก้ไขข้อความในหน้าแอดมินก่อนเก็บลงฐานข้อมูล
 *
 * ทำไมต้องทำที่ฝั่งเซิร์ฟเวอร์: หน้าเว็บสาธารณะแสดงเนื้อหานี้ด้วย
 * dangerouslySetInnerHTML ถ้าเก็บ HTML ดิบไว้ ใครที่เข้าถึงบัญชีเจ้าหน้าที่ได้
 * (หรือช่องโหว่ในอนาคต) จะฝัง <script>/onerror ให้รันในเบราว์เซอร์ผู้เข้าชมได้
 * ล้างตอนเขียนหมายความว่าในฐานข้อมูลไม่เคยมีของอันตรายอยู่เลย
 *
 * อนุญาตเท่าที่ตัวแก้ไขสร้างได้จริง: ตัวหนา/เอียง/ขีดเส้น, สี, จัดตำแหน่ง,
 * รายการ, หัวข้อย่อย และลิงก์
 */
const OPTIONS = {
  allowedTags: [
    "p", "br", "div", "span",
    "strong", "b", "em", "i", "u", "s", "strike",
    "ul", "ol", "li",
    "h3", "h4", "blockquote",
    "a",
  ],
  allowedAttributes: {
    "*": ["style"],
    a: ["href", "target", "rel"],
  },
  allowedStyles: {
    "*": {
      color: [/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/, /^[a-zA-Z]+$/],
      "background-color": [/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/, /^[a-zA-Z]+$/],
      "text-align": [/^(?:left|right|center|justify)$/],
      "font-weight": [/^(?:bold|normal|[1-9]00)$/],
      "font-style": [/^(?:italic|normal)$/],
      "text-decoration": [/^(?:underline|line-through|none)$/],
      "text-decoration-line": [/^(?:underline|line-through|none)$/],
    },
  },
  // ไม่อนุญาต javascript: และ data: — กัน XSS ผ่าน href
  allowedSchemes: ["http", "https", "mailto", "tel"],
  transformTags: {
    // ลิงก์ในเนื้อหาสาธารณะเปิดแท็บใหม่ และตัด window.opener ทิ้ง
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }),

    // เบราว์เซอร์บางตัว (หรือเมื่อ styleWithCSS ใช้ไม่ได้) ยังสร้าง <font color="...">
    // จาก execCommand('foreColor') — แปลงเป็น span+style เพื่อไม่ให้สีที่ผู้ใช้
    // ตั้งไว้หายไปเงียบๆ ตอนบันทึก ค่า color ที่ได้ยังต้องผ่าน allowedStyles ต่อ
    font: (tagName, attribs) => ({
      tagName: "span",
      attribs: attribs.color ? { style: `color:${attribs.color}` } : {},
    }),
  },
};

export function sanitizeRichText(html) {
  if (html == null) return null;
  const clean = sanitizeHtml(String(html), OPTIONS).trim();
  // ตัวแก้ไขมักทิ้ง "<p><br></p>" ไว้เมื่อผู้ใช้ลบข้อความทั้งหมด
  // ถือว่าว่าง เพื่อให้เงื่อนไข "ถ้าไม่มีเนื้อหาก็ไม่ต้องแสดง" ทำงานถูก
  const textOnly = clean.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  if (!textOnly) return null;
  return clean;
}
