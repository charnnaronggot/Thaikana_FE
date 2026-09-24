# ผลตรวจข้อกำหนด Demo

อ้างอิง [Brief](Thaikana-Codex-Implementation-Brief.md) โดยผลทั้งหมดเป็นพฤติกรรมของ Demo adapter ใน browser วันที่ 24 กันยายน 2026 ไม่ใช่ผลทดสอบ backend หรือ UAT จริง

`e2e/flow.spec.ts` และ `e2e/exceptions.spec.ts` รัน domain transitions ภายใต้ Playwright เพื่อยืนยันข้อมูลข้ามโมดูล ส่วน `e2e/sales-ui.spec.ts`, `e2e/concurrency.spec.ts` และ `e2e/smoke.spec.ts` ควบคุมหน้า Chromium จริง

| ข้อ  | หน้าจอ / Action                                           | การทดสอบ                                                               | ผล                                                                 |
| ---- | --------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| AC01 | Sales: Quotation 2 lines → Design → Planning/WO           | `e2e/sales-ui.spec.ts`, `e2e/flow.spec.ts`, `tests/sales.test.ts`      | ผ่าน: trace แยก line และ PDF จริงใน browser                        |
| AC02 | Sales: แก้ราคา → Quotation R02, PDF R01 คงอยู่            | `e2e/flow.spec.ts`, `tests/sales.test.ts`                              | ผ่าน: Product Revision เดิม                                        |
| AC03 | Sales/Design: แก้แบบเฉพาะ line → Product Revision ใหม่    | `e2e/flow.spec.ts`, `tests/design.test.ts`                             | ผ่าน: line อื่นไม่เปลี่ยน                                          |
| AC04 | Sales: ราคา 12 × 32,000 ลด 5%, COGS 24,000                | `e2e/sales-ui.spec.ts`, `e2e/flow.spec.ts`, `tests/foundation.test.ts` | ผ่าน: สุทธิ 364,800; กำไร 76,800; VAT 25,536 แยก                   |
| AC05 | Planning: FG 4 + WO ผลิต 6 จาก Order 10                   | `e2e/flow.spec.ts`, `tests/planning.test.ts`                           | ผ่าน                                                               |
| AC06 | Planning: shortage, role, duplicate                       | `e2e/flow.spec.ts`, `tests/planning.test.ts`                           | ผ่าน: ไม่เกิด WO ซ้ำ                                               |
| AC07 | Inventory: Reserve/Issue/Return/Scrap/Receive และ ledger  | `e2e/exceptions.spec.ts`, `tests/inventory.test.ts`                    | ผ่าน: 80 on hand / 10 reserved / 70 available                      |
| AC08 | Station: Start ด้วย Username/Password ของ Worker          | `e2e/concurrency.spec.ts`, `tests/production.test.ts`                  | ผ่าน: actor แยก Station/Worker                                     |
| AC09 | Station: PIN ผิด 5 ครั้งและ lock                          | `e2e/exceptions.spec.ts`, `tests/production.test.ts`                   | ผ่าน: WO ไม่เปลี่ยน                                                |
| AC10 | Station: 2 การ์ด / 2 Worker / 2 เครื่อง; จบการ์ดเดียว     | `e2e/exceptions.spec.ts`, `tests/production.test.ts`                   | ผ่าน: อีกงาน Running                                               |
| AC11 | Station: สองแท็บ Start WO เดียวกัน                        | `e2e/concurrency.spec.ts`, `tests/production.test.ts`                  | ผ่าน: IndexedDB transaction ยอมรับหนึ่งรายการ อีกแท็บเห็น conflict |
| AC12 | Production Problem → QC fail → Rework                     | `e2e/exceptions.spec.ts`, `tests/qc.test.ts`                           | ผ่าน: เหตุผลและสถานีปลายทางในประวัติ                               |
| AC13 | QC บางส่วนพร้อม checklist/รูป 4 ด้าน → FG                 | `e2e/exceptions.spec.ts`, `tests/qc.test.ts`                           | ผ่าน: รับ FG เฉพาะส่วนผ่าน                                         |
| AC14 | Delivery: สแกน Lot, ส่งบางส่วน, Delivered แยก event       | `e2e/flow.spec.ts`, `tests/delivery.test.ts`                           | ผ่าน: ยอดส่งและยอดรับแยก                                           |
| AC15 | Users: role, disable, reset/unlock, audit                 | `e2e/exceptions.spec.ts`, `tests/auth.test.ts`                         | ผ่าน: Demo handler ปฏิเสธ action                                   |
| AC16 | ทุกโมดูล 1440/1024/390, Drawer/Dialog, keyboard, conflict | `e2e/smoke.spec.ts`, `e2e/concurrency.spec.ts`                         | ผ่าน: ไม่มี page overflow; focus/Escape และ retry                  |

การตรวจภาพเทียบ B อยู่ใน `artifacts/screenshots/prototype-b.png`, `sales-drawer-1440.png`, `dashboard-{1440,1024,390}.png` และ `station-dialog-390.png` รูปหน้า Sales แสดง drawer 640 px ด้านขวา ฉากหลัง dim, sidebar ดำและปุ่มสีน้ำเงินตามต้นแบบ รูป mobile แสดง layout หนึ่งคอลัมน์

ข้อจำกัด: ไม่มี SRS ต้นฉบับและภาพ Create Product แยกไฟล์ใน `docs` จึงใช้ Brief กับ HTML B เป็นหลัก การทดสอบ AC11 ยืนยัน atomicity ของ IndexedDB ใน browser เดียวกัน ไม่ได้ยืนยันการกันซ้ำบน server ที่ยังไม่เชื่อมต่อ
