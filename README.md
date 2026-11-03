# Thaikana Frontend

## Local-only continuation

Use the matching backend's [dedicated Local runner](../sales-test-backend/docs/LOCAL-WORKSPACE.md) for `http://localhost:4259` with isolated PostgreSQL18/private files and generated credentials. It builds this complete workspace into private state, without touching Railway. This local branch adds searchable personal permission maintenance under `/users`: follow Role, global ALLOW or DENY; unsupported resource scopes are not offered. Changes are authorized and enforced by the backend, revoke target sessions/proofs, and require version/idempotency/reason. Mobile permission rows stack vertically. Customer/plant/warehouse-specific grants and full-system acceptance remain open. No deployment/push is part of this continuation.

## Native API workspace — 22 October 2026

The active application uses the native .NET API under `/api/v1`. The historical demo instructions below describe unrouted reference code, not credentials or acceptance for the active workspace. No production/test account is created by building the frontend.

Use `npm ci`, then `npm start -- --configuration local` for the complete local workspace at port 4200. `proxy.conf.json` points `/api` at `https://localhost:7247`; run the compatible Backend API project and configure its local database/secrets separately. Do not put DB credentials or server secrets in frontend environments. The default production build remains Sales-only; use `npm run build:workspace` for all-role workspace routes, or the production Dockerfile with `--build-arg BUILD_CONFIGURATION=production,workspace`.

### User and Station maintenance

The `/users` route now uses native API-backed list/detail and popup forms: create personal/Station accounts, edit profile, assign existing roles/stations, reset temporary password/PIN/MFA, change active status, revoke sessions and unlock password/PIN lockouts. Server-returned capabilities control actions; server policies still enforce every request and replay. Username/account type remain immutable. The page displays inherited effective permissions; a custom-grants editor is not implemented yet.

All mutations send `Idempotency-Key`; updates also send the current `expectedVersion` (MFA reset uses its credential version). Security changes require an audit reason. A stale edit offers an explicit reload. If the response is lost after commit, the form retains the exact original command/key and offers **ตรวจผล / ลองคำสั่งเดิม**; editing/closing is blocked until the outcome is known. Passwords/PINs are masked and cleared on close. No old credential is returned by the API.

Native DTO aliases come from `src/app/core/services/api/generated/native-schema.ts`. Export the matching backend's OpenAPI document to `contracts/native-openapi.json`, then run `npm run api:generate:native`. Do not substitute the historical API schema. The committed contract contains no credentials or environment secrets.

Verification: 43 frontend unit tests and the workspace production build passed. Real-API browser acceptance runs in the backend `UsersBrowserTests` with disposable PostgreSQL, including timeout-after-commit replay, dirty close, stale conflict/reload and four viewport sizes. This does not certify every feature or a DEV/UAT deployment. Keep this frontend paired with the new User API; do not roll out `/users` against the old backend.

## Historical demo reference (inactive)

Angular 22 frontend สำหรับตรวจ Flow การผลิตตาม [Implementation Brief](docs/Thaikana-Codex-Implementation-Brief.md) และต้นแบบ [B Right Drawer](docs/Thaikana-B-Right-Drawer.html) ใช้ **Demo adapter เท่านั้น** ไม่มีการเรียก API หรือ backend ข้อมูลอยู่ใน IndexedDB ของ browser และ Reset Demo จะกลับสู่ข้อมูลตัวอย่าง

## เริ่มใช้งาน

ต้องมี Node.js 22+ และ npm 11+

```powershell
npm ci
npm start
```

เปิด http://localhost:4200 แล้วเลือกบัญชีตัวอย่าง เช่น `sales`, `designer`, `planner`, `store`, `somchai` (Operator), `qc`, `delivery`, `station`, `admin` หรือ `viewer` ใช้ Password `demo` ทุกบัญชีและ PIN ของ Worker `123456` เฉพาะ Demo ห้ามใช้ข้อมูลรับรองจริง

Station Console ต้อง login เป็น `station`; Start/Resume ยืนยัน Username/Password ของ Worker และ Pause/Complete ยืนยัน PIN ของเจ้าของงาน ระบบจำ user ID เฉพาะ session ของแท็บ ไม่บันทึกรหัสผ่านหรือ PIN

## ตรวจและเปิด build

```powershell
npm run build
npm test
npm run test:e2e
npm run preview
```

`npm run preview` เสิร์ฟ **ไฟล์ที่ build แล้ว** ที่ http://localhost:4300 และรองรับ deep links ผ่าน HTTP ตั้งแต่ `/sales` เป็นต้นไป Playwright จะเริ่ม dev server เองที่ port 4200 เมื่อรัน E2E ต้องติดตั้ง Chromium ครั้งแรกด้วย `npx playwright install chromium`

## Flow ตัวอย่าง

1. Sales สร้าง Quotation หลายสินค้า เลือกสินค้าเดิมหรือ Made to Order แล้วส่ง Design
2. Designer บันทึก Spec, Drawing, BOM และ COGS จากนั้นอนุมัติ Product Revision
3. Sales ตั้งราคา ออก PDF จาก snapshot และบันทึกหลักฐานลูกค้ายอมรับ จึงเกิด Sales Order
4. Planner จัดสรร FG ที่มีอยู่และสร้าง WO เฉพาะส่วนที่ต้องผลิตเพิ่ม
5. Store จองและเบิกวัสดุตาม WO; Operator หรือ Station ทำแต่ละ Operation และ QC ตรวจพร้อมภาพ 4 ด้าน
6. QC รับเฉพาะสินค้าที่ผ่านเป็น FG; Delivery จัดสรร สแกน Lot บรรจุ ส่งบางส่วน และบันทึกหลักฐานผู้รับ
7. Documents ออกป้ายกล่อง, Invoice, Billing, Receipt และพิมพ์หลาย WO เป็น PDF; Receipt ออกได้หลังบันทึกรับเงิน

การแก้ราคาออก Quotation Revision ใหม่โดยไม่แก้ Product Revision ส่วนการแก้แบบเฉพาะรายการจะสร้าง Product Revision ใหม่ เอกสาร PDF ที่ออกแล้วเก็บ Blob และ snapshot ไว้ใน Demo ประวัติไม่ถูกแก้ทับ

## โครงสร้าง

- `src/app/domain`: types, state transitions, permissions และสูตรคำนวณ
- `src/app/data-access`: IndexedDB transaction, version conflict, idempotency key และ BroadcastChannel
- `src/app/core`: session และ proof สำหรับ Station
- `src/app/shared`: drawer/dialog, asset และ PDF
- `src/app/features`: standalone components และ lazy routes
- `tests`: Vitest ของกฎธุรกิจ
- `e2e`: Playwright สำหรับ Flow ต่อเนื่อง, กรณีพิเศษ, สองแท็บ และ viewport
- `artifacts/screenshots`: ภาพตรวจหน้าจอ เทียบต้นแบบ B

เงินใช้ decimal.js ปัดสองตำแหน่งแบบ Away From Zero และแยก VAT ออกจากกำไร เวลาบันทึกเป็น UTC แล้วแสดง Asia/Bangkok

## Git และข้อจำกัดรอบนี้

`main` เป็นฐานที่ตรวจรับแล้ว, `develop` เป็น branch รวม และ `feature/*` เก็บประวัติงานแต่ละโมดูล ไม่สร้าง HTTP adapter ในรอบนี้ การยืนยันสิทธิ์ การแข่งขันสองแท็บ และเอกสารที่ทดสอบเป็นพฤติกรรม **Demo ใน browser** ไม่ใช่การรับรอง security หรือ performance ของ backend/SRS

ดู [ตาราง Requirement → หน้าจอ/Action → Test → ผลตรวจ](docs/requirement-matrix.md) สำหรับ AC01–AC16
