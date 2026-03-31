# Portfolio Scope

เอกสารนี้ใช้เป็นรายการตัดสินใจว่าอะไรควรอยู่ใน demo และอะไรควรถูกตัดออกก่อนเริ่ม refactor

## Demo Story

portfolio ตัวนี้ควรเล่าเรื่องเดียวให้จบ:

1. ผู้ใช้เข้าสู่ระบบด้วย role ตัวอย่าง
2. พนักงานยื่นคำขอลา
3. หัวหน้าหรือ HR อนุมัติคำขอ
4. HR ติดตามผล probation ของพนักงานใหม่
5. ผู้ชมเห็น dashboard และรายงานย่อที่สรุปผลลัพธ์ของระบบ

## Keep First

เก็บไว้เป็นแกนของ demo รอบแรก

### Frontend pages

- `src/pages/LoginPage.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/LeavePage.tsx`
- `src/pages/ProbationEvaluationsPage.tsx`
- `src/pages/ProbationEvaluationFormPage.tsx`
- `src/pages/ReportsHub.tsx`
- `src/pages/reports/ExecutiveDashboard.tsx`
- `src/pages/reports/DepartmentAnalyticsPage.tsx`
- `src/pages/reports/LeaveBalanceReportPage.tsx`

### Shared routing and auth

- `src/routes/index.tsx`
- `src/contexts/AuthContext.tsx`
- `src/hooks/useAuth.ts`
- `src/components/auth/ProtectedRoute.tsx`
- `src/components/layout/MainLayout.tsx`
- `src/config/navigation.ts`

### Leave and approval

- `src/components/leave/`
- `src/components/approval/`
- `src/api/leave.ts`
- `src/api/approval.ts`
- `src/api/dashboard.ts`
- `src/api/reports.ts`

### Probation

- `src/components/probation/`
- `src/api/probationEvaluations.ts`

### Supporting utilities

- `src/hooks/useToast.ts`
- `src/contexts/ToastContext.tsx`
- `src/utils/leaveCalculator.ts`
- `src/utils/permissions.ts`
- `src/utils/dateUtils.ts`

## Keep Later

เก็บไว้ได้ถ้าต้องใช้เพื่อเสริม demo หลังจาก flow หลักนิ่งแล้ว

- `src/pages/UserProfilePage.tsx`
- `src/pages/PublicHolidaysPage.tsx`
- `src/components/holidays/`
- `src/components/notifications/`
- `src/api/holidays.ts`
- `src/api/notifications.ts`

## Remove Early

ควรถูกตัดออกจาก routing, navigation, และ infra ก่อน เพื่อให้ demo เบาลงและไม่สับสน

### Feature groups

- warning system
- line attendance
- subcontract employee management
- off-days management
- shift swap workflow
- audit logs
- employee import/export
- AI chat
- impersonation
- heavy settings surfaces ที่ไม่ได้ใช้ใน demo story

### Frontend areas likely removable

- `src/pages/WarningManagementPage.tsx`
- `src/pages/WarningHistoryPage.tsx`
- `src/pages/MigrateWarningSystemPage.tsx`
- `src/pages/HeadcountConfigPage.tsx`
- `src/pages/LineAttendancePage.tsx`
- `src/pages/SubcontractEmployeesPage.tsx`
- `src/pages/OffDaysManagementPage.tsx`
- `src/pages/EmployeeOffDaysPage.tsx`
- `src/pages/ShiftSwapPage.tsx`
- `src/pages/ShiftSwapApprovalPage.tsx`
- `src/pages/AuditLogsPage.tsx`
- `src/components/warning/`
- `src/components/warnings/`
- `src/components/attendance/`
- `src/components/off-days/`
- `src/components/shift/`
- `src/components/ai/`

### Backend areas likely removable

- `netlify/functions/warning-*.ts`
- `netlify/functions/line-attendance.ts`
- `netlify/functions/subcontract-*.ts`
- `netlify/functions/employee-off-days*.ts`
- `netlify/functions/shift-*.ts`
- `netlify/functions/ai-*.ts`
- `netlify/functions/impersonate-user.ts`
- `netlify/functions/audit-logs.ts`

## Portfolio-Friendly Roles

สร้าง role สำหรับ demo ใหม่ทั้งหมด

- `employee`
- `manager`
- `hr`
- `admin` เฉพาะกรณีต้องใช้หน้า config หรือ admin summary

## Seed Data ที่ควรมี

- พนักงาน active อย่างน้อย 6-10 คน
- manager 1-2 คน
- HR 1 คน
- leave requests หลายสถานะ
- probation candidates หลาย stage
- dashboard stats และ report rows ที่มีข้อมูลพอให้ screenshot ได้

## Definition Of Done For Round 1

- route เหลือเฉพาะหน้าใน demo scope
- navigation เหลือไม่เกิน 6 รายการหลัก
- env ไม่อ้าง production services
- demo users login ได้
- leave flow และ probation flow เปิดใช้งานได้
- README อธิบาย story, roles, และ tech stack ได้ชัด
