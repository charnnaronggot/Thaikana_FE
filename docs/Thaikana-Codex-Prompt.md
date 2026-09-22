# Prompt สำหรับ Codex

ทำงานเป็นผู้พัฒนาและผู้ออกแบบ UI ของระบบ Thaikana ลงมือทำใน workspace จนได้งานที่เปิดตรวจและกดใช้งานได้ ไม่หยุดแค่เสนอแผน

## อ่านก่อนเริ่ม

1. อ่าน AGENTS.md และโครงสร้าง repository แล้วอ่าน `Thaikana-Codex-Implementation-Brief.md` หรือเอกสาร Word ชื่อเดียวกันให้ครบ
2. ใช้ `Thaikana_Software_Requirement_Specification_v1.0.docx` เป็นข้อกำหนดอ้างอิง โดยข้อแก้ล่าสุดด้านล่างมีลำดับเหนือ SRS
3. ใช้ `Thaikana-B-Right-Drawer.html` เป็นแบบหลักที่เจ้าของงานเลือกสำหรับ Layout, Sidebar, ตาราง ฟอร์ม และ Drawer ด้านขวา เปิดไฟล์นี้ก่อนเริ่มทำ UI และต่อหน้าที่ยังขาดด้วยแนวเดียวกัน ใช้ Figma https://www.figma.com/design/IJ6ApPzEZtnmHPHMmwAyB7/Thaikana?node-id=0-1 และภาพ Create product เป็น Ref เสริม ไม่ใช้แบบ A หรือออกแบบธีมใหม่แทนแบบ B
4. ถ้าไม่มีไฟล์อ้างอิงบางไฟล์ ให้แจ้งชื่อที่ขาดและทำส่วนที่ชัดเจนจาก Brief ต่อ ห้ามอ้างว่าอ่านไฟล์หรือเปิด Figma แล้วถ้ายังไม่ได้อ่านจริง ห้ามเดา Requirement ที่มีผลต่อสิทธิ์หรือธุรกรรม

## ข้อที่ล็อกแล้ว

- สร้างระบบ UI ชุดเดียวครบ Flow ตาม Thaikana-B-Right-Drawer โดยคง Layout, Sidebar, สี ระยะห่าง ตาราง และ Drawer ของแบบ B; ค่าดีไซน์ใน Brief เป็น fallback เมื่อแบบ B ไม่ได้ระบุ
- หน้าหลักใช้หน้าเต็ม; เพิ่มหรือแก้รายการย่อยใช้ Drawer ด้านขวา; ยืนยันตัวตนใช้ Dialog ขนาดกระชับ ไม่ซ้อน Drawer
- Sales ไม่มี Checker และไม่มีขั้นอนุมัติราคาภายในเพิ่มขึ้นมา
- ยังไม่มีหน้าตั้ง Routing ทั้งใน Design และ Admin; โครงสร้างข้อมูลอาจรองรับอนาคต แต่ UI ใช้ขั้นตอนผลิตปัจจุบัน
- Station Account: สแกน WO → ยืนยันผู้ทำงานด้วย Username/Password → ตรวจงานและเครื่องจักร → Start; ตอน Pause หรือ Complete ต้องยืนยัน PIN ของผู้ทำรายการที่มีสิทธิ์ในงานนั้น
- Personal Account ใช้ผู้ใช้ที่ Login อยู่ ไม่เพิ่มขั้น Station login หรือ PIN ทุกปุ่ม
- การปรับราคาอย่างเดียวสร้าง Quotation Revision ใหม่และใช้ Product Revision เดิม; การแก้แบบ วัสดุ ขนาด หรือการผลิตส่งรายการที่กระทบกลับ Design
- Planning เป็นจุดเดียวที่สร้าง WO; Design Inbox ใช้ Design Task และ Quotation Line ไม่ใช้ WO ก่อนเกิดงานผลิต

## งานที่ต้องทำ

ทำ Sales, Design, Planning, Production Board, Personal/Station Console, Inventory, QC/Rework, Finished Goods, Delivery, เอกสารขาย และ Users/Access ให้ต่อกันได้ ใช้รายการหลายสินค้าและหลาย WO ได้จริงตาม Brief รวม loading, empty, validation, error, permission denied และ transaction conflict ที่เกี่ยวข้อง

เริ่มทำเส้นทางหลักให้จบก่อน: สร้างใบเสนอราคาหลายรายการ → Design/BOM/COGS → Sales ตั้งราคา → ลูกค้ายอมรับ → Planning/จัดสรร FG/สร้าง WO → Reserve/Issue → Station Start/Pause/Complete → QC → รับ FG → Dispatch → Delivered จากนั้นทำแขนงแก้ราคา แก้แบบ วัสดุขาด งานมีปัญหา QC ไม่ผ่าน ส่งบางส่วน และ Users ให้ครบ อย่าหยุดหลังจบเฉพาะ happy path

ทำ UI เป็น components และ HTML จริงที่เข้าถึงได้ ห้ามใช้ภาพหน้าจอหรือ SVG ของทั้งหน้ามาแทนแอป ใช้ตาราง ฟอร์ม Drawer Dialog และไอคอนที่สม่ำเสมอ ตัวเลขต้องคำนวณจากข้อมูลเดียวกันและใช้ state ร่วมกันทั้ง Flow

ตรวจ stack เดิมก่อนและพัฒนาต่อจากของเดิม ไม่ย้าย framework เอง ถ้าเป็นโครงการใหม่ให้ใช้ stack ที่ตกลงใน SRS เป็นจุดตั้งต้น แยก API adapter ออกจาก UI ใช้ API จริงที่มีอยู่; ถ้า API ยังไม่มีให้ทำ demo adapter พร้อมข้อมูลเชื่อมโยงกัน ระบุชัดว่าเป็นโหมดตัวอย่าง ห้ามใช้รหัสผ่านหรือ PIN แบบ hardcoded เป็นระบบยืนยันตัวตนจริง และห้ามเก็บ secrets ใน localStorage หรือ log

## วิธีดำเนินงาน

1. สรุปสิ่งที่พบจาก repo และแหล่งอ้างอิงสั้น ๆ พร้อมแผนลงมือและข้อที่ยังต้องตัดสินใจ
2. ทำ tokens และ shared components ก่อน แล้วต่อหน้าจอและ state ตาม Flow ใช้ข้อเสนอขนาด/สีใน Brief เป็นค่าเริ่มต้น เทียบกับแบบ B ที่ viewport เดียวกันก่อนส่ง หากหาไฟล์ B ไม่ได้ให้แจ้งว่าขาด Ref หลักและทำส่วน Flow ต่อโดยไม่อ้างว่าหน้าตาตรงแบบแล้ว
3. ผูก actions กับการเปลี่ยนสถานะและข้อมูลจริงใน API หรือ demo adapter ทุกปุ่มหลักต้องมีผลที่ตรวจได้ ไม่ใช้ toast สำเร็จแทนธุรกรรม
4. ทดสอบตาม Acceptance Criteria ใน Brief โดยเน้นราคา Revision จำนวนคงคลัง สิทธิ์ Station PIN และ concurrency ตรวจภาพ desktop/tablet/mobile ที่กำหนด แก้ overflow และ layout ผิดก่อนส่ง
5. ส่ง source ที่อ่านง่าย วิธีรัน รายการหน้าที่ทำ ตาราง requirement → screen/action → test และข้อจำกัดที่ยังต้องต่อ backend
6. ส่ง `index.html` หรือ HTML preview ที่เปิดตรวจได้ พร้อม ZIP ของ source และ assets ถ้าต้องใช้ server ให้มี README และคำสั่งรันชัดเจน อย่าเรียกว่า offline standalone หากเปิดด้วย file:// ไม่ได้

ไม่ deploy หรือแก้ production โดยพลการ ไม่เปลี่ยนขอบเขตไปสร้างระบบบัญชีเต็มรูปแบบหรือ Routing editor ไม่ถือว่าจำนวนหน้าจอมากเท่ากับทำครบ ให้พิสูจน์ด้วย Flow และผลลัพธ์ที่ใช้งานได้

เริ่มตรวจไฟล์แล้วลงมือทำต่อได้เลย ตัดสินใจรายละเอียดที่ย้อนกลับได้ตาม Brief และบันทึกสมมติฐานไว้ ถ้าติดข้อมูลที่มีผลต่อสิทธิ์หรือธุรกรรม ให้ระบุจุดนั้นอย่างเจาะจงและทำส่วนอื่นต่อ
