# Portfolio Demo Setup

เอกสารนี้ใช้สำหรับทำให้โปรเจกต์พร้อมใช้งานบน infra ใหม่ โดยหลังจากทำครบตามนี้แล้ว app จะพร้อมเดโมด้วยข้อมูลตัวอย่างทันที

## 1. Create External Resources

- สร้าง Neon database ใหม่ 1 ตัว
- สร้าง Supabase project ใหม่ 1 ตัว
- สร้าง Netlify site ใหม่สำหรับ repo นี้

## 2. Configure Environment Variables

ใช้ [`.env.example`](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/.env.example) เป็นต้นแบบ แล้วตั้งค่าอย่างน้อย:

- `NEON_DATABASE_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `VITE_API_URL`
- `VITE_DEPLOYMENT_PLATFORM`
- `SESSION_SECRET`
- `JWT_SECRET`

## 3. Bootstrap Database

รัน SQL ตามลำดับนี้กับ Neon database ใหม่:

1. [database/portfolio-demo-bootstrap.sql](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/database/portfolio-demo-bootstrap.sql)
2. [database/migrations/add-evaluation-form-foundation.sql](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/database/migrations/add-evaluation-form-foundation.sql)
3. [database/migrations/update-evaluation-form-actions-cancelled.sql](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/database/migrations/update-evaluation-form-actions-cancelled.sql)
4. [database/migrations/update-evaluation-form-recommendation-resigned.sql](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/database/migrations/update-evaluation-form-recommendation-resigned.sql)
5. [database/migrations/add-leader-role-to-employees.sql](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/database/migrations/add-leader-role-to-employees.sql)
6. [database/scripts/portfolio-demo-seed.sql](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/database/scripts/portfolio-demo-seed.sql)

## 4. Supabase Storage

- สร้าง project ใหม่
- ใช้คีย์ใหม่ทั้งหมด
- ถ้าจะอัปโหลดไฟล์แนบหรือรูปภาพ ให้สร้าง buckets ตามที่ function ฝั่ง backend ต้องใช้ใน project ใหม่นี้เท่านั้น

## 5. Run Locally

```bash
npm install
npm run dev:netlify:full
```

## 6. Smoke Test

- login ด้วย account ใน [docs/demo-accounts.md](E:/SSTH-Leave-management-system/leave-management-portfolio-demo/docs/demo-accounts.md)
- เปิด `/dashboard`
- เปิด `/leave` และดู request หลายสถานะ
- เปิด `/approval` ด้วย manager หรือ HR
- เปิด `/probation-evaluations` ด้วย leader, manager, HR, หรือ admin
- เปิด `/reports`, `/reports/executive-dashboard`, `/reports/department-analytics`, `/reports/leave-balance`

## 7. Before First Deploy

- ตรวจว่า network request ไม่วิ่งไป production domain
- ตรวจว่า Netlify env vars เป็นของ resource ใหม่ทั้งหมด
- ตรวจว่า Supabase bucket และ auth callback ไม่ผูกของเดิม
- ตรวจว่า demo accounts login ได้ครบ
