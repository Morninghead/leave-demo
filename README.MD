# Leave Management Portfolio Demo

repo นี้ถูกย่อให้เหลือ flow ที่ใช้เล่า product story ใน portfolio demo เท่านั้น โดยตั้งเป้าให้ฝั่ง code, database scaffold, seed data, และเอกสาร setup พร้อมใช้งาน เหลือเพียงการสร้าง resource ใหม่บน Netlify, Neon, และ Supabase

## Demo Story

- login ด้วย demo accounts ตาม role
- พนักงานยื่นคำขอลา
- manager หรือ HR อนุมัติคำขอ
- HR ติดตาม probation evaluation
- ผู้ชมดู dashboard และ selected reports

source of truth ของ scope อยู่ที่ [docs/portfolio-scope.md](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/docs/portfolio-scope.md)

## ตอนนี้พร้อมอะไรแล้ว

- frontend route และ navigation เหลือเฉพาะ flow หลักของ demo
- reports hub ถูกจัดให้เหลือ Executive Dashboard, Department Analytics, และ Leave Balance Report
- probation flow ไม่ผูกกับ employee code เฉพาะของข้อมูลชุดเดิมแล้ว
- มี bootstrap schema สำหรับ demo database และ seed script สำหรับ demo users / sample data
- มีเอกสาร setup และ demo accounts สำหรับ handoff

## สิ่งที่ยังต้องทำเองนอก repo นี้

- สร้าง Netlify site ใหม่
- สร้าง Neon database ใหม่
- สร้าง Supabase project ใหม่
- ตั้ง environment variables ของ resource ใหม่

รายละเอียดขั้นตอนแบบ end-to-end อยู่ที่ [docs/portfolio-demo-setup.md](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/docs/portfolio-demo-setup.md)

## Quick Start

```bash
npm install
npm run dev
```

ถ้าต้องการรันพร้อม Netlify Functions:

```bash
npm install
npm run dev:netlify:full
```

## Database Bootstrap

หลังจากสร้าง Neon project ใหม่แล้ว ให้รันสคริปต์ตามลำดับ:

1. [database/portfolio-demo-bootstrap.sql](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/database/portfolio-demo-bootstrap.sql)
2. migrations ที่จำเป็นใน [database/migrations](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/database/migrations)
3. [database/scripts/portfolio-demo-seed.sql](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/database/scripts/portfolio-demo-seed.sql)

## Demo Accounts

credentials สำหรับ demo users อยู่ที่ [docs/demo-accounts.md](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/docs/demo-accounts.md)

## Safety Notes

- ห้ามนำ `.env` จาก production มาใช้ตรง ๆ
- ห้าม reuse employee data หรือ member context จริง
- ให้ใช้ seed data และ account ชุด demo เท่านั้น
