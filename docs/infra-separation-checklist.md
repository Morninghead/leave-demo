# Infra Separation Checklist

ใช้ checklist นี้ก่อนเชื่อม demo app กับ resource ใหม่ เพื่อกันการปนกับ production

## Netlify

- สร้าง Netlify site ใหม่สำหรับ demo
- ตั้งชื่อ site ให้ชัดว่าเป็น portfolio หรือ demo
- แยก environment variables ออกจาก production ทั้งหมด
- ตรวจ `netlify.toml` ว่า build command และ functions path ชี้มาที่ repo นี้
- ปิด webhook หรือ scheduled jobs ที่ไม่จำเป็นใน demo

## Supabase

- สร้าง Supabase project ใหม่
- ใช้ schema และ seed data ใหม่สำหรับ demo เท่านั้น
- สร้าง anon key และ service role key ใหม่
- ตรวจ storage buckets ให้ไม่มีไฟล์จาก production
- ตรวจ auth providers ว่าไม่ได้ผูกกับ production callback URL

## Neon หรือ Database หลัก

- สร้าง database ใหม่
- ใช้ `DATABASE_URL` ใหม่
- แยก user และ password ออกจาก production
- รัน migrations กับ seed data ใหม่เท่านั้น
- อย่านำ dump production มาใช้โดยไม่ sanitize

## Environment Variables

- สร้าง `.env` ใหม่จาก `.env.example`
- เปลี่ยนทุกค่า URL, key, secret, webhook, SMTP, bot token, และ callback URL
- ตรวจว่าค่า `VITE_*` ไม่ชี้ไป production host
- ตรวจว่าฟังก์ชัน backend ไม่อ้าง service role เดิม

## Auth And Demo Accounts

- สร้าง demo users ใหม่ทั้งหมด
- อย่าใช้ employee IDs หรือ member context ของ production
- ใช้ชื่อ, อีเมล, department, และ avatar ที่เป็นข้อมูลสมมติ
- เตรียม role อย่างน้อย `employee`, `manager`, `hr`

## Data Safety

- sanitize logo, company name, employee names, phone numbers, and emails
- ลบเอกสารอ้างอิงจริง เช่น HR document numbers ที่อาจ trace กลับได้
- ตรวจ screenshot และ fixtures ก่อนเผยแพร่

## Before First Deploy

- รัน app ด้วย env ใหม่และ login ได้
- ทดสอบ leave flow จบอย่างน้อย 1 เคส
- ทดสอบ probation flow จบอย่างน้อย 1 เคส
- ตรวจ browser network ว่าไม่มี request ไป production domains
- ตรวจ Netlify Functions logs ว่าไม่มี error จาก missing secret
