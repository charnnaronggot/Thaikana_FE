# Thaikana Codex Implementation Brief

เอกสารส่งต่อสำหรับสร้าง UI และ Flow ระบบ Thaikana

ฉบับ 1.1 วันที่ 22 กันยายน 2026 ใช้แบบ B Right Drawer

## 1 เป้าหมายและลำดับข้อกำหนด

สร้างระบบ UI ชุดเดียวที่กดทำงานต่อเนื่องได้ครบ ตั้งแต่งานขาย ออกแบบ วางแผน ผลิต คลัง QC จัดส่ง ไปจนถึงเอกสารและผู้ใช้งาน ใช้หน้าเต็มสำหรับงานหลัก Drawer ด้านขวาสำหรับรายการย่อย และ Dialog สำหรับยืนยันตัวตน โดยคงธีมจาก Ref ลูกค้า

เอกสารนี้เป็นข้อกำหนดการส่งต่อให้ Codex พัฒนา frontend และเชื่อม API ที่มีอยู่ หากยังไม่มี backend ให้มี demo adapter ที่จำลองสถานะอย่างสอดคล้อง พร้อมระบุขอบเขตที่ยังต้องพัฒนาฝั่ง server ให้ชัด

### แหล่งอ้างอิง

- SRS หลัก: Thaikana_Software_Requirement_Specification_v1.0.docx ใช้รหัส QUO, DES, PLAN, RM, WO, FUL, SYS และ AUTH ตรวจย้อนกลับ
- ข้อแก้ล่าสุดของเจ้าของงาน: Sales ไม่มี Checker; ยังไม่มี Routing UI; Station เริ่มงานด้วย Username/Password และ Pause/Complete ด้วย PIN
- Figma ลูกค้า: https://www.figma.com/design/IJ6ApPzEZtnmHPHMmwAyB7/Thaikana?node-id=0-1
- แบบ UI หลักที่เจ้าของงานเลือก: Thaikana-B-Right-Drawer.html ใช้ Layout, Sidebar, ตาราง ฟอร์ม และ Drawer ของแบบ B ต่อให้ครบ Flow; Figma และภาพ Create product เป็น Ref เสริม ไม่ใช้แบบ A แทนแบบ B และไม่ใช้ demo security/business logic เป็นระบบจริง

หากข้อมูลขัดกัน ให้ยึดข้อแก้ล่าสุดของเจ้าของงานก่อน ตามด้วย SRS ที่ไม่ถูกแก้ไข ส่วนค่าดีไซน์และรูปแบบ interaction ในเอกสารนี้เป็นแนวทางที่เลือกสำหรับ UI ห้ามตีความภาพตัวอย่างว่าลบข้อกำหนดใน SRS

### ขอบเขตที่ล็อกแล้ว

- ไม่เพิ่ม Checker หรือหน้ารออนุมัติราคาภายในใน Sales
- ไม่สร้าง Routing editor หรือเปิดตั้งเส้นทางผลิตใน Design/Admin รอบนี้
- Planning เป็นจุดเดียวที่สร้าง Work Order และต้องอ้าง Product Revision ที่พร้อมผลิต
- Quotation Revision และ Product Revision เป็นคนละเรื่อง เก็บประวัติและ snapshot ย้อนหลังได้
- Station ต้องระบุคนทำงานจริงแยกจากบัญชีเครื่องกลาง และทุกการ์ดต้องแยก WO ผู้ทำงาน และเครื่องจักรได้
- ความครบวัดจาก Flow และผลลัพธ์ ไม่บังคับจำนวนหน้าจอให้เท่ากับ prototype เก่า

\pagebreak

## 2 รูปแบบหน้าจอและธีม

ยึด Thaikana-B-Right-Drawer เป็นแบบหลักทั้ง Layout สี ระยะห่าง ตาราง ฟอร์ม และ Drawer; ค่าดีไซน์ด้านล่างเป็น fallback เมื่อแบบ B ไม่ได้ระบุ ใช้ Sidebar เมนูหลักด้านซ้ายเหมือนกันทุกหน้า แสดง active menu ถูกโมดูล มีหัวหน้า ชื่อรายการ/รหัส สถานะ และ primary action ที่หาเจอง่าย อย่ารวมทุกงานไว้ใน Drawer เดียว

| งาน | รูปแบบ | เหตุผลใช้งาน |
| --- | --- | --- |
| ใบเสนอราคาและรายละเอียดคำสั่งขาย | หน้าเต็ม | หลายรายการ พร้อมยอดรวมและประวัติ |
| เพิ่มสินค้า แก้รายการ ตั้งราคาต่อรายการ | Drawer ขวา | เห็นเอกสารหลักขณะปรับข้อมูล |
| Design และ Planning | หน้าเต็ม | ตาราง BOM แบบ ต้นทุน และความพร้อม |
| Board และ Personal/Station Console | หน้าเต็ม | เห็นหลายงานและสถานะได้พร้อมกัน |
| Receive Issue QC และ Delivery | หน้าเต็ม | สแกน หลายรายการ รูปและ checklist |
| ผูก Barcode เหตุผลปฏิเสธ แก้ข้อมูลผู้ใช้สั้น ๆ | Drawer ขวา | งานย่อยที่ต้องรักษาบริบท |
| Username/Password และ PIN | Dialog | ยืนยัน action เดียวแล้วกลับสู่งาน |

### ค่าดีไซน์เริ่มต้น

Sidebar #000000; active #17191E พร้อมแถบน้ำเงิน; primary #003B85; canvas #F3F4F6; surface #FFFFFF; border #DEE2E7 ใช้ Noto Sans Thai และไอคอน Lucide หรือชุดเดียวกันที่ repo ใช้อยู่ ไม่ใช้ emoji เป็นไอคอนปุ่มงาน

ภาพรวมต้องคม เรียบ และแน่นพอดี ใช้เงาน้อย รัศมี card ประมาณ 2 px และ control ประมาณ 3 px ปรับกลุ่มฟอร์มให้ใกล้ภาพ Create product ได้ ใช้ระยะฐาน 4/8 px; body 14–16 px; control 36–40 px และปุ่มหลัก shop floor อย่างน้อย 44 px ค่าพวกนี้เป็นแนวทาง UI ไม่ใช่กฎธุรกิจ

Drawer desktop กว้างประมาณ 560–640 px และไม่เกิน 90vw มีหัวและ footer ค้างอยู่ เนื้อหาเลื่อนภายใน ใช้ Save / Save & Add Another / Cancel ตามบริบท เมื่อข้อมูลยาวให้เปิดหน้าเต็มได้และรักษาค่าที่ยังกรอกไม่เสร็จ บนมือถือ Drawer เต็มหน้าจอ

### ตารางและการเข้าถึง

ใช้ header น้ำหนักชัด คอลัมน์ตัวเลขชิดขวา หน่วย/วันที่รูปแบบเดียวกัน แถวประมาณ 44–48 px มี sticky header ในตารางยาว แสดงรหัสและชื่ออย่างมีลำดับ ไม่ตัดข้อมูลสำคัญจนแยกงานไม่ได้ คง filter และหน้าที่เลือกเมื่อกลับจาก detail

Search ใช้รหัส ชื่อ หรือ Barcode ตาม use case; filter สถานะ วันที่ ผู้รับผิดชอบ/สถานี พร้อม Clear filters มี pagination และจำนวนรายการ ทุกหน้ารองรับ loading, empty, no results, error/retry, denied และข้อมูลที่เปลี่ยนจากอีกผู้ใช้

รองรับ keyboard, focus ที่มองเห็น, label จริง, focus trap/restore ใน Dialog และไม่พึ่งสีอย่างเดียว ตรวจ desktop 1440, tablet 1024 และ mobile 390 px ตารางกว้างเลื่อนในพื้นที่ตารางได้โดยทั้งหน้าไม่ล้นแนวนอน

\pagebreak

## 3 Sales และ Design

### Sales ตั้งแต่สร้างจนลูกค้ายอมรับ

รายการใบเสนอราคา → สร้างเอกสาร → เพิ่มสินค้าหลายรายการ → ตรวจข้อมูล → ส่ง Design → รับต้นทุน → ตั้งราคาขาย/ส่วนลด → ออก PDF และส่งลูกค้า → บันทึก Accepted / Rejected / Expired ตามเหตุการณ์ เมื่อยอมรับให้บันทึกหลักฐานและ Customer PO ถ้ามี แล้วส่งคำสั่งขายเข้า Planning ไม่มี Checker คั่น

Create product Drawer มีประเภท Existing Product / Made to Order, ชื่อสินค้า หมวด จำนวน หน่วย ขนาด/สเปก ผิว/สี และ Customer Requirement ช่วงรับ requirement ยังไม่บังคับราคาที่ต้องรอต้นทุนจาก Design; ก่อนออกใบเสนอราคาต้องตรวจราคาครบ

ส่วน Estimated COGS จาก Design เป็น read-only แยก Material, Labor, Overhead, Waste/Scrap ส่วน Sales Input มีวิธีตั้งราคา ราคาต่อหน่วย ส่วนลด และจำนวนเงิน มี preview กำไรที่อัปเดตจากค่าจริง ต้นทุนที่ยังไม่พร้อมแสดง “รอ Design” แทนตีความว่าเป็นต้นทุนศูนย์

### การแก้ไขหลังส่งลูกค้า

แก้ราคา/ส่วนลดอย่างเดียว: สร้าง Quotation R02 จาก R01 → ใช้ Product Revision เดิม → ปรับราคา → ออกเอกสารใหม่และส่งลูกค้า เก็บ R01 และ PDF ที่เคยส่งไว้ การเปลี่ยนแบบ ขนาด วัสดุ หรือวิธีผลิต ให้เลือกเฉพาะรายการที่กระทบส่ง Design แล้วกลับมาตั้งราคา

ตัวอย่างตรวจสูตร: จำนวน 12 × ราคาขาย 32,000 = 384,000 บาท; ลด 5% = 19,200; ยอดสุทธิก่อน VAT = 364,800; ต้นทุน 24,000 × 12 = 288,000; กำไรขั้นต้น = 76,800; margin = 21.05% หากตั้ง VAT ตัวอย่าง 7% จะได้ VAT 25,536 และยอดรวม 390,336 บาท อัตราภาษีต้องมาจากข้อมูลตั้งค่า ไม่ hardcode จากตัวอย่าง

Markup = กำไร ÷ ต้นทุน; Margin = กำไร ÷ ยอดขายสุทธิก่อน VAT ต้องไม่ใช้ชื่อสลับกัน เมื่อหารด้วยศูนย์แสดง N/A และช่วยผู้ใช้แก้ข้อมูล ใช้ decimal/วิธีปัดเศษเดียวกับ backend และ template เอกสาร

### Design Workspace

Inbox ใช้ Design Task / Quotation / Line; ก่อน Planning ยังไม่มี WO เปิดหน้าเต็มเป็นแท็บ Spec, Drawing, BOM, COGS และ Revision มีเลขแบบ เจ้าของงาน รุ่นที่แก้และสถานะ แสดงไฟล์ PDF/ภาพให้ดูได้ และเก็บ DWG/source เป็นไฟล์แนบ ไม่สร้าง CAD editor

BOM มีรหัสวัสดุ สเปก ปริมาณ หน่วย Scrap allowance และหมายเหตุ ดึงต้นทุนที่ระบบกำหนดพร้อมระบุวันอ้างอิง COGS แยกวัสดุ แรงงาน Overhead และ Waste ตรวจข้อมูลก่อนส่งกลับ Sales Revision ที่อนุมัติแล้วแก้ทับไม่ได้ ต้องสร้าง revision ใหม่ ไม่มีแท็บตั้ง Routing ในรอบนี้

แหล่งข้อกำหนด: QUO-01 ถึง QUO-08, DES-01 ถึง DES-07 โดย DES-04 และส่วน Routing ถูกแทนด้วยข้อแก้ล่าสุด

\pagebreak

## 4 Planning และ Inventory

### Planning และการสร้าง Work Order

หน้าเต็มแสดงคำสั่งขาย หลักฐานลูกค้ายอมรับ รายการสินค้า Product Revision จำนวน วันส่ง และความพร้อมแบบ/BOM/ต้นทุน ตรวจ FG ที่พร้อมจัดสรรจริงหลังหักยอดจอง แล้วคำนวณจำนวนผลิตเพิ่ม เช่น สั่ง 10 มีพร้อมจัดสรร 4 จัดสรร 4 และสร้างงานผลิต 6

แสดงความต้องการวัสดุแต่ละ BOM line พร้อม On hand, Reserved, Available และ Shortage ข้อมูลที่ไม่พร้อมต้องชี้รายการและสิ่งที่ต้องแก้ โดยการปล่อยงานเมื่อวัสดุขาดให้ยึด policy/API ของระบบ ไม่ตั้งกฎอนุญาตหรือห้ามเองจากภาพตัวอย่าง

ผลการพิจารณาคือ Create Work Order หรือ Denied โดย Denied ต้องมีเหตุผล แต่ละสินค้าวางแผนและแยก WO ได้ ติดตามย้อนถึงคำสั่งขาย/Quotation Line เดิม ใช้ server สร้างเลข WO และ snapshot revision, drawing, BOM, quantity, due date ไม่เกิด WO ซ้ำเมื่อกดซ้ำ

ผลิตเก็บสต็อกเป็นอีกทางเข้า Planning: เลือกสินค้าที่มี Approved Revision → ระบุจำนวน วันต้องการและเหตุผล → ตรวจความพร้อม → สร้าง WO สินค้าใหม่ที่แบบยังไม่พร้อมต้องไป Design ก่อน

### Inventory และยอดคงเหลือ

Master วัสดุมีรหัส ชื่อ สเปก หน่วย จุดเตือนต่ำและสถานะ รับเข้าผ่านการกรอกหรือสแกน Barcode; ถ้าไม่รู้จัก Barcode ให้ผูกกับวัสดุ/ล็อตก่อน มีผู้ขาย เอกสารอ้างอิง จำนวน ต้นทุนต่อหน่วย วันรับและที่เก็บตามข้อมูลระบบ

Reserve จองวัสดุตาม WO โดยไม่ลด On hand; Issue ลดของจริงเมื่อเบิก Store ใช้ scan/manual และแสดงจำนวนต้องใช้ จองแล้ว เบิกแล้วและคงค้าง รองรับเบิกนอก BOM โดยระบุเหตุผลและตรวจสิทธิ์ คืนของเหลือและ Scrap แยกกัน พร้อม reason code

Ledger แสดง Receive, Reserve, Issue, Return, Adjust และ Scrap พร้อมเอกสารอ้างอิง ผู้ทำ วันเวลา จำนวนและ balance ต้นทุน Moving Average คำนวณฝั่งธุรกรรมรับเข้าและเก็บ snapshot ห้าม UI คิดยอดที่ขัดกับ ledger

ตัวอย่างทดสอบ: On hand 100 จอง 30 เหลือ Available 70; เบิก 20 จากยอดจองแล้ว On hand 80 จองคงเหลือ 10 และ Available 70 การคืน/ยกเลิกจองต้องอัปเดตยอดตามชนิดรายการจริง ไม่หักซ้ำ

### ค้นหาและข้อผิดพลาด

Planning ค้น PO/SO/สินค้าและ filter due date/readiness; Inventory ค้นรหัส/ชื่อ/Barcode และ filter ประเภท/ที่เก็บ/สถานะ Handle barcode ซ้ำ หน่วยไม่ตรง ยอดไม่พอ รายการถูกแก้ขณะเปิด และ submission ซ้ำ พร้อมรักษาข้อมูลที่ผู้ใช้กรอกไว้

แหล่งข้อกำหนด: PLAN-01 ถึง PLAN-07, RM-01 ถึง RM-09, WO-01 และ WO-02

\pagebreak

## 5 Station Account และ Personal Account

### แยกบัญชีเครื่องออกจากผู้ทำงาน

Station Account ระบุสถานีและอุปกรณ์ที่กำลังใช้งาน ส่วน Worker คือคนที่ยืนยันตัวตนเพื่อทำงานนั้น สิทธิ์เริ่มงานต้องผ่านทั้ง Role/ขอบเขตของ Worker และ Operation ที่ Station ทำได้ ไม่ถือว่า Login บัญชีเครื่องแล้วมีสิทธิ์ทำทุกงาน

### Start บน Station

1. สแกน Barcode ของ WO หรือเลือกการ์ดจากคิว แสดงรหัสงาน สินค้า Revision จำนวน สถานะและสถานี ตรวจว่าเป็นงานที่สถานีนี้ทำได้
2. เปิด Dialog ให้ Worker ใส่ Username/Password การยืนยันนี้ต้องไม่เปลี่ยน session ของเครื่องกลางเป็นบัญชีส่วนบุคคล
3. แสดงงานที่ตรวจแล้ว พร้อม Worker, Machine/Resource ที่ใช้ได้ และความพร้อมของงาน เลือกเครื่องเมื่อ operation ต้องใช้
4. กด Start เรียก action ฝั่ง server และอัปเดตการ์ดเมื่อสำเร็จ ผูก actor กับงานนี้เท่านั้น ไม่ถือว่าผู้ที่เพิ่งกรอกจะเป็นเจ้าของงานทุกการ์ดใน Station

### Pause และ Complete

เลือกการ์ดเป้าหมาย → ตรวจ WO/Worker/Machine → Pause ใส่เหตุผล หรือ Complete ใส่ผลผลิตตามข้อกำหนด operation → ยืนยัน PIN → ส่งธุรกรรม → แสดงสถานะใหม่ PIN ต้องตรวจคู่กับ Worker/สิทธิ์ของ action เป้าหมายที่ server ไม่ค้นเจ้าของจาก PIN อย่างเดียว

Complete ต้องตรวจจำนวนดี เสีย และคงค้างให้ไม่เกินจำนวนที่อนุญาต พร้อมเหตุผลกรณีคงค้างตาม policy ของ operation งานที่สำเร็จหนึ่งใบต้องไม่หยุด timer หรือเปลี่ยนสถานะงานอื่น เก็บ PIN ในหน่วยความจำเฉพาะเวลายืนยันและล้างทันทีหลังใช้หรือยกเลิก

PIN ผิดให้คงสถานะเดิม เมื่อถึงจำนวนครั้งที่ตั้งค่าให้แสดง locked state และทางติดต่อผู้ดูแล การหมดอายุของการยืนยัน เปลี่ยนงานเป้าหมาย หรือข้อมูลเปลี่ยนจากอีกเครื่อง ต้องยืนยันใหม่ตาม policy server ป้องกันการใช้ผลยืนยันเก่ากับงานอื่น

### หลายงานและ Personal

แต่ละการ์ดแสดง WO, สินค้า, Product Revision, จำนวน, Operation, Worker, Machine, สถานะ และ elapsed time ส่วนเอกสาร/วัสดุด้านล่างต้องระบุว่าเป็นของการ์ดที่เลือก Worker เดียวจะทำหลายงานหรือหลาย Worker ใช้เครื่องเดียวได้หรือไม่ ให้ยึด resource policy ไม่อนุมานว่าอนุญาตทั้งหมด

Personal Account ใช้ตัวตนที่ Login อยู่ สแกน/เลือกงาน → ตรวจรายละเอียด → Start → Pause/Resume/Complete ตามสิทธิ์ งานที่กำลังทำหรือเคยเริ่มแสดงด้านบน ไม่เพิ่มหน้ากรอก Username/Password หรือ PIN แบบ Station ให้ Personal โดยอัตโนมัติ

### นโยบายที่ต้องตรวจจากระบบก่อนต่อจริง

วิธียืนยัน Resume, ผู้มีสิทธิ์หยุดแทนเจ้าของงาน, อายุการยืนยัน, ความยาว PIN และจำนวนครั้งก่อนล็อกยังต้องผูกกับ policy จริง ค่าใน demo เป็นตัวอย่างเท่านั้น การแจ้ง Problem ต้องเก็บ actor; หาก action ทำให้งาน Pause ต้องผ่านกฎ PIN ของ Pause

แหล่งข้อกำหนด: AUTH-01 ถึง AUTH-07 และ WO-05 ถึง WO-09 โดยวิธียืนยัน Station ถูกแทนด้วยข้อแก้ล่าสุดของเจ้าของงาน

\pagebreak

## 6 Production QC และ Delivery

### Production Board และปัญหาระหว่างผลิต

Board เป็นคอลัมน์ตามขั้นตอนปัจจุบัน: รอเลเซอร์, เลเซอร์คัท, พับ, เชื่อม, ขัดผิว, ประกอบ, QC, รอส่ง, จัดส่ง และจัดส่งสำเร็จ เชื่อม stage mapping ของ backend โดยไม่เปิด Routing editor แยก Operation status เช่น Running/Paused ออกจากคอลัมน์กระบวนการ

การ์ดระบุ WO และสินค้าอย่างชัดเจน มีจำนวน วันกำหนด ความสำคัญและผู้ทำ Filter ตามสถานี สถานะ ผู้ทำ กำหนดส่ง และค้น PO/WO ได้ การเลื่อนการ์ดถ้ามีต้องผ่าน transition validation เดียวกับ action ปกติ ไม่เปลี่ยนสถานะเพียงเพราะลากข้ามคอลัมน์

ทุกขั้นผลิตแจ้ง Problem/ส่งกลับได้ ระบุเหตุผล สถานีปลายทาง หมายเหตุและไฟล์แนบที่เกี่ยวข้อง แสดงประวัติการแก้ไขและกลับมาทำงาน ป้องกันการเริ่มซ้อนจากสองเครื่องด้วย conflict response; ไม่ทำ force override เงียบ ๆ

### QC และ Finished Goods

หน้า QC แสดง WO, Revision, Drawing, จำนวนที่รับตรวจ checklist และผลต่อรายการ มีจำนวนผ่าน/ไม่ผ่าน/ค้าง แยกการส่งกลับแก้ไขพร้อมเหตุผลและสถานีปลายทาง ตรวจผลรวมไม่เกินจำนวนที่ตรวจ รองรับการตรวจซ้ำและดูประวัติ rework

รองรับภาพ QC 4 ด้านตามหมายเหตุลูกค้า มีช่องระบุด้าน อัปโหลดใหม่ ดูภาพและสถานะอัปโหลดที่ล้มเหลว นโยบายว่าบังคับภาพทุกด้านในสินค้าทุกชนิดหรือไม่ให้กำหนดจาก checklist ที่ยืนยันแล้ว

สินค้าที่ QC ผ่านรับ FG เข้าคลังโดยมี Product Revision, lot, quantity และ location จากนั้นจัดสรรตามคำสั่งขายหรือเก็บสต็อก ห้ามนับของที่ไม่ผ่าน QC เป็นสินค้าพร้อมส่ง

### Delivery ตั้งแต่เตรียมถึงรับมอบ

เลือกคำสั่งขาย/เอกสารอ้างอิง → แสดง allocated FG และยอดค้าง → สแกน pick/pack → ระบุจำนวนรอบนี้ → พิมพ์ป้ายกล่อง → Confirm Dispatch → Confirm Delivered เป็นคนละเหตุการณ์ พร้อมประวัติแต่ละรอบ ส่งบางส่วนได้และต้องแสดงยอดที่ยังเหลือ

ป้องกันสแกนสินค้าผิดหรือ Revision ไม่ตรง ยอด dispatch ไม่เกินที่จัดสรร/หยิบได้ บันทึกวันส่ง เลขอ้างอิง ปลายทาง ผู้ขนส่งและผู้ทำงาน ตอน Delivered บันทึกผู้รับ วันเวลา หลักฐาน และพิกัดเมื่อมี ไม่ถือว่าติ๊กของขึ้นรถแล้วลูกค้าได้รับสินค้า

### รายละเอียดจากหมายเหตุลูกค้า

มีเลขแบบบนใบเสนอราคา/ใบงาน และชื่อ Sales บนใบงาน; ใบงานพิมพ์สีน้ำเงิน–ขาว; เลือกหลาย WO เพื่อ preview/พิมพ์ได้; รองรับป้ายกล่องที่ระบุลูกค้าและอ้างอิงงาน; เปิดที่อยู่/ตำแหน่งส่งจากข้อมูลป้ายได้ ข้อเหล่านี้ใช้ร่วมกับ SRS และแยกจากระบบติดตามรถแบบ live GPS ซึ่งอยู่นอกขอบเขต

แหล่งข้อกำหนด: WO-03 ถึง WO-10, FUL-01 ถึง FUL-08 และหมายเหตุลูกค้าในงานออกแบบเดิม

\pagebreak

## 7 เอกสาร ผู้ใช้ และโครงสร้างข้อมูล

### เอกสารขายและเอกสารพิมพ์

ใบเสนอราคาอ้าง Quotation Revision และเก็บ PDF ที่ออกจริง เอกสารหลังขาย เช่น ใบส่งของ ใบแจ้งหนี้ ใบวางบิลและใบเสร็จ ให้เชื่อมคำสั่งขาย รอบจัดส่งหรือเหตุการณ์รับเงินจริงตามชนิดเอกสาร ถ้า schema/template ยังไม่พร้อมให้แยกงานที่รอต่อและอย่าสร้างสถานะชำระเงินสำเร็จขึ้นเอง

ใบงานอ้าง snapshot ของ WO การแก้หมายเหตุสำหรับพิมพ์ต้องไม่เปลี่ยนแบบ/BOM ที่อนุมัติอยู่ แสดง preview ก่อน export/print และป้องกันเลขเอกสารซ้ำตามบริการเลขเอกสารของระบบ

### Users และ Access

จัดการ Personal Users, Roles, Station Accounts, ขอบเขตสถานี/แผนก, Password/PIN Reset และ Access Audit แยกชนิดบัญชีชัดเจน หน้าแก้ไขต้องแสดงข้อมูลกับ PIN policy ของคนเดียวกัน Admin รีเซ็ตได้แต่ดูรหัสเดิมไม่ได้ การปิดผู้ใช้ระงับสิทธิ์และ PIN โดยคงประวัติธุรกรรม

ตรวจสิทธิ์ทั้งหน้าจอและ API; การซ่อนปุ่มอย่างเดียวไม่เพียงพอ รายการสำคัญ เช่น ปรับสต็อก เปลี่ยนผล QC ยกเลิก WO หรือ Reset credentials ต้องมี audit ตาม policy ไม่ log password/PIN

### ข้อมูลสำคัญและความสัมพันธ์

| กลุ่ม | ความสัมพันธ์ที่ต้องรักษา |
| --- | --- |
| Quotation และ Line | หลายสินค้า มี Quotation Revision และ snapshot ที่ส่งลูกค้า |
| Product Revision | Spec Drawing BOM COGS ที่ถูกอ้างจาก quotation/WO |
| Sales Order และ WO | หนึ่งคำสั่งขายมีหลาย line และหลาย WO; WO สร้างจาก Planning |
| Operation Execution | WO stage resource worker station device และเวลาแต่ละ action |
| Inventory Movement | Material/FG lot location qty cost reference และ actor |
| QC และ Rework | Revision inspection quantities photos reason destination history |
| Delivery และ Package | allocation รอบส่ง box label receiver proof และยอดค้าง |

โครงสร้างนี้เป็นรายการความสัมพันธ์ขั้นต่ำสำหรับ UI/API ไม่ใช่คำสั่งให้เปลี่ยน schema เดิมทันที ถ้า repo มี schema ใช้อยู่ให้ map ผ่าน adapter และรักษา compatibility

### ค้นหาและภาพรวม

Universal search รองรับ Quotation, PO, WO, Product, Material และ Barcode; Dashboard แสดง WIP งานเกินกำหนด โหลดสถานี QC fail วัสดุขาดและงานพร้อมส่ง รายงานความคืบหน้า PO ต้องรวมหลายรายการและหลาย WO ได้ การ export/แจ้งเตือนให้เป็นไปตามสิทธิ์และลำดับ Must/Should ใน SRS

แหล่งข้อกำหนด: SYS-01 ถึง SYS-07, AUTH-01 ถึง AUTH-07 และ Flow เอกสารขายที่คุยไว้ในโครงการ

\pagebreak

## 8 แนวทางพัฒนาและสิ่งส่งมอบ

### เริ่มจาก repository ที่มีอยู่

อ่าน AGENTS.md, package/config, component library, routes, API clients และ test setup ใช้ stack เดิม หากเป็นโครงการใหม่ SRS ระบุ Angular 20, .NET 8 หรือ LTS ที่ตกลง, PostgreSQL และ object storage ให้ตรวจความพร้อมของโครงการก่อนเริ่ม ไม่ย้าย framework หรือเพิ่ม backend ขนาดใหญ่เพียงเพื่อทำหน้าตัวอย่าง

แยก tokens, shared components, feature pages, domain types และ API adapters ใช้ components จริง เช่น DataTable, FilterBar, StatusBadge, Drawer, ConfirmDialog, CredentialDialog, PINDialog, QuantityInput, RevisionHistory และScanInput รองรับ scanner ที่ส่งคีย์บอร์ด/camera ตามอุปกรณ์ที่มี

### State และธุรกรรม

แยก document status, customer decision, revision state, operation state และ delivery state ชัดเจน หลีกเลี่ยงสถานะ “สำเร็จ” ตัวเดียวที่ใช้แทนทุกเหตุการณ์ Backend ต้องตรวจ transition, authorization, current version และยอดคงเหลือภายในธุรกรรม พร้อมป้องกัน double submit/idempotency ตาม API

จำนวนเงินใช้ decimal และกฎปัดเศษตรงกัน เวลาธุรกรรมมาจาก server เก็บ UTC และแสดง Asia/Bangkok ห้าม timer หน้าจอเป็นแหล่งเวลาหลัก เมื่อ network ล้มเหลวให้ไม่ยืนยันผลสำเร็จที่ไม่ทราบ และสามารถ refresh สถานะก่อน retry ได้

ถ้ามี demo adapter ให้แสดง “โหมดตัวอย่าง” ชัดเจน ข้อมูลเชื่อมโยงกันทุกหน้า reset ได้และไม่ปะปนกับ production การกรอก credentials ใน prototype ไม่เท่ากับ security จริง ห้ามนำบัญชี demo หรือ PIN ตัวอย่างไปเป็นรหัสที่ใช้กับระบบจริง

### ขอบเขตและลำดับงาน

ทำ foundations → เส้นทางขายถึงจัดส่งครบหนึ่งกรณี → exception branches → supporting modules → ตรวจภาพและทดสอบทั้งหมด การจบเส้นทางแรกเป็น milestone ไม่ใช่ขอบเขตสุดท้าย รวมแขนงที่ระบุในเอกสารนี้ต่อให้ครบ

ไม่รวมบัญชี GL/AR/AP เต็มรูปแบบ Payroll, eTax, eSignature, CAD editor, PLC/IoT, fleet tracking หรือ offline transaction sync ไม่แอบเพิ่ม Routing editor ในหน้าจออนาคต การติดตั้งเป็น PWA ไม่ได้หมายถึงเขียนธุรกรรม offline ได้

### ผลลัพธ์ที่ต้องส่งให้เจ้าของงาน

- Source code พร้อม assets และ README วิธีติดตั้ง/รัน ระบุ API ที่ใช้และวิธีเปิด demo
- HTML preview หรือ index.html สำหรับเปิดตรวจ พร้อม ZIP ของ source และ assets; ถ้าต้องใช้ server ให้บอกชัด
- ตาราง requirement ID → screen/action → acceptance test → ผลตรวจ พร้อมรายการส่วนที่ยังต่อ backend
- ภาพตรวจหน้าสำคัญ desktop/tablet/mobile โดยเฉพาะ Create product Drawer, Planning, Station หลายงาน และ QC/Delivery
- สรุปสิ่งที่เปลี่ยน ผลทดสอบ ข้อจำกัดและจุดที่รอ policy จริง ห้ามใช้คำว่า production ready หากยังเป็น demo

ยังไม่ต้อง deploy หรือแตะข้อมูล production การเชื่อมบริการจริงต้องอยู่ในสิทธิ์และขอบเขตที่เจ้าของงานอนุญาต

\pagebreak

## 9 เกณฑ์ตรวจรับ

ตรวจด้วยข้อมูลที่เชื่อมกันทั้งระบบ และยืนยันผลข้อมูลหลัง action ไม่ใช่ดูเฉพาะปุ่มหรือ toast บันทึกหลักฐานผลทดสอบที่ทำจริงและสิ่งที่ยังไม่ทดสอบ

| รหัส | กรณีตรวจ | ผลที่ต้องได้ |
| --- | --- | --- |
| AC01 | Quotation มี 2 สินค้า | แต่ละ line เข้า Design/Planning แยกได้และ trace ถึง WO |
| AC02 | ปรับราคาอย่างเดียว | เกิด Quotation R02; Product Revision เดิม; R01/PDF ยังอยู่ |
| AC03 | แก้แบบสินค้า 1 line | ส่งเฉพาะ line ที่กระทบเข้า Design; revision ใหม่ไม่ทับเก่า |
| AC04 | ตัวอย่างราคาในบท 3 | สุทธิ 364,800; กำไร 76,800; VAT ไม่ถูกนับเป็นกำไร |
| AC05 | สั่ง 10 มี FG พร้อม 4 | จอง FG 4 ผลิตเพิ่ม 6; ใช้ยอด available หลังหักจอง |
| AC06 | Denied หรือข้อมูลไม่พร้อม | มีเหตุผล/รายการที่ขาด และไม่สร้าง WO ซ้ำหรือโดย role อื่น |
| AC07 | รับ จอง เบิก คืน Scrap | ledger และยอด on hand/reserved/available สอดคล้อง |
| AC08 | Station สแกนแล้ว Start | ยืนยัน Username/Password; actor แยกจาก station; จำกัด operation |
| AC09 | Pause/Complete PIN ผิด | งานไม่เปลี่ยนสถานะ; lock ตาม policy; ไม่รั่ว secrets |
| AC10 | Station มี 2 งาน จบ 1 งาน | เปลี่ยนเฉพาะงานเป้าหมาย อีกงานยังทำต่อและ actor ถูกต้อง |
| AC11 | Start พร้อมกัน 2 เครื่อง | server ป้องกันซ้ำ; UI แสดง conflict และ refresh ได้ |
| AC12 | แจ้ง Problem และ QC fail | มีเหตุผล สถานีปลายทาง ประวัติ rework และตรวจซ้ำได้ |
| AC13 | QC ผ่านบางส่วน | จำนวนสมดุล; รับ FG เฉพาะส่วนผ่าน; รูป/checklist ครบตาม policy |
| AC14 | Dispatch บางส่วน | แยกยอดส่ง/ค้าง; Delivered เป็นอีกเหตุการณ์พร้อมหลักฐาน |
| AC15 | ผู้ใช้ไม่มีสิทธิ์/ถูกปิด | UI และ API ปฏิเสธ action; ประวัติเดิมยังตรวจย้อนหลังได้ |
| AC16 | Responsive และ error states | ไม่มีหน้าล้น; drawer/dialog ใช้ keyboard ได้; retry ไม่ทำธุรกรรมซ้ำ |

### เงื่อนไขปิดงาน

ไม่มี Checker ใน Sales ไม่มีหน้าตั้ง Routing ไม่มี PIN แทน Username/Password ตอน Station Start และไม่มีการ Complete ที่ข้าม PIN ใน Station ทุก action หลักต้องทำงานจริงกับ API หรือ demo adapter ที่ระบุไว้ ไม่มีปุ่มหลอก ไม่มีการใช้ภาพทั้งหน้าแทน UI และข้อมูลยอดรวม/สถานะข้ามหน้าต้องสอดคล้องกัน

เป้าหมาย SRS ด้าน performance เช่น API ส่วนใหญ่ไม่เกิน 2 วินาที Search ไม่เกิน 3 วินาที และ realtime ไม่เกิน 5 วินาที ต้องวัดในสภาพแวดล้อม UAT ที่ตกลง การตรวจ prototype เพียงอย่างเดียวไม่ยืนยันผลของ backend หรือระบบจริง

\pagebreak

## 10 วิธีส่งงานให้ Codex

ส่ง Thaikana-Codex-Prompt.md พร้อมเอกสารนี้หรือ Markdown ชื่อ Thaikana-Codex-Implementation-Brief.md และแนบ SRS ต้นฉบับ ภาพ Create product และ Thaikana-B-Right-Drawer.html เป็น Ref หลัก ถ้ามี repository ให้เปิด workspace ของโครงการนั้นก่อน

คัดลอกเนื้อหา Prompt ส่งให้ Codex ได้ทันที เอกสาร Word เหมาะสำหรับอ่าน/คอมเมนต์ ส่วน Markdown มีเนื้อหาเดียวกันเพื่อให้ Codex อ่านใน repository ได้ง่าย ทั้งสองเป็นข้อกำหนดการทำงานชุดเดียวกัน

### รายการตัดสินใจที่ต้องผูกกับระบบจริง

1. Resume บน Station ใช้วิธียืนยันใดและผลยืนยันอยู่ได้นานเท่าใด
2. ใครหยุด/Complete แทนเจ้าของงานได้ และต้องมี audit/เหตุผลใด
3. PIN policy และ lock/reset policy ใช้ค่าจากบริการยืนยันตัวตนใด
4. Material shortage อนุญาตให้ปล่อย WO ได้ในเงื่อนไขใด
5. Partial completion, qty reconciliation และการใช้เครื่องพร้อมกันมีข้อจำกัดใดตาม operation
6. QC checklist/รูป 4 ด้านบังคับกับสินค้ากลุ่มใด และเอกสารหลังขายใช้ template/numbering ใด

ให้ Codex ตรวจคำตอบจาก SRS, repo, API และ policy ที่มีอยู่ก่อน หากยังไม่มีจึงระบุเป็นประเด็นรอยืนยันเฉพาะจุด ส่วน UI และ Flow ที่ชัดเจนให้ทำต่อได้ ไม่ตั้ง policy ที่มีผลต่อสิทธิ์หรือยอดธุรกรรมขึ้นเอง

### ตารางตรวจแหล่งข้อกำหนด

| แหล่ง | นำมาใช้ | ข้อยกเว้นหรือสถานะ |
| --- | --- | --- |
| QUO และ DES | หลายสินค้า แบบ BOM COGS และ Revision | ไม่มี Sales Checker; DES Routing ยังไม่มี UI |
| PLAN และ RM | สร้าง WO ตรวจ readiness และ stock ledger | Policy ปล่อยงานเมื่อวัสดุขาดต้องตรวจระบบจริง |
| WO และ FUL | ผลิต Problem QC FG Dispatch Delivered | ยืนยัน Station ตามข้อแก้ล่าสุด |
| AUTH และ SYS | Role scope lifecycle audit search reports | ไม่ใช้วิธี PIN ก่อน Start ตาม SRS เดิม |
| หมายเหตุลูกค้า | เลขแบบ Sales ใบงาน รูป QC และป้ายกล่อง | ใช้เป็นรายละเอียดประกอบ; ไม่ขยายเป็น fleet/CAD |
| Thaikana-B-Right-Drawer | แบบหลักของ Layout Sidebar ตารางและ Drawer | Figma/ภาพเป็น Ref เสริม; ธุรกรรมยึดข้อกำหนด |
| เอกสารส่งต่อฉบับนี้ | Hybrid layout และเกณฑ์ตรวจรับ | ค่าขนาด UI เป็นค่าเริ่มต้นให้เทียบ Ref |

เอกสารนี้ให้ Codex ลงมือสร้างผลลัพธ์ที่ตรวจได้ และรายงานข้อจำกัดตรงตามงานที่ทำจริง ไม่ใช้จำนวนหน้าหรือภาพ preview แทนหลักฐานว่า Flow เชื่อมถึงกันแล้ว
