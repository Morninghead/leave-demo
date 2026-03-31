-- =====================================================
-- SSTH Leave Management System
-- Verify & Fix Annual Leave Pro-rata Calculation
-- =====================================================
-- Run in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- STEP 1: VERIFICATION - ดูข้อมูลปัจจุบันและเปรียบเทียบ
-- =====================================================

SELECT 
    e.employee_code,
    CONCAT(e.first_name_th, ' ', e.last_name_th) as employee_name,
    e.hire_date,
    -- คำนวณจำนวนเดือนที่ทำงาน
    EXTRACT(MONTH FROM AGE(
        ('2025-12-31')::date,
        GREATEST(e.hire_date::date, ('2025-01-01')::date)
    ))::integer as months_worked,
    -- คำนวณจำนวนวันที่เหลือ
    EXTRACT(DAY FROM AGE(
        ('2025-12-31')::date,
        GREATEST(e.hire_date::date, ('2025-01-01')::date)
    ))::integer as extra_days,
    -- จำนวนเดือนหลังปัดเศษ (ถ้าเกิน 15 วัน = +1 เดือน)
    (
        EXTRACT(MONTH FROM AGE(
            ('2025-12-31')::date,
            GREATEST(e.hire_date::date, ('2025-01-01')::date)
        ))::integer +
        CASE
            WHEN EXTRACT(DAY FROM AGE(
                ('2025-12-31')::date,
                GREATEST(e.hire_date::date, ('2025-01-01')::date)
            )) > 15 THEN 1
            ELSE 0
        END
    ) as total_months_rounded,
    -- ค่าปัจจุบันใน database
    lb.total_days as current_db_value,
    -- ค่าที่ควรจะเป็น (Pro-rata)
    CASE
        WHEN e.hire_date::date < ('2025-01-01')::date THEN
            -- ทำงานก่อนปีนี้ = ได้เต็ม
            COALESCE(lp.annual_leave_after_probation, 6)::numeric
        ELSE
            -- ทำงานในปีนี้ = Pro-rata
            ROUND(
                (
                    (
                        EXTRACT(MONTH FROM AGE(
                            ('2025-12-31')::date,
                            e.hire_date::date
                        ))::numeric +
                        CASE
                            WHEN EXTRACT(DAY FROM AGE(
                                ('2025-12-31')::date,
                                e.hire_date::date
                            )) > 15 THEN 1
                            ELSE 0
                        END
                    ) / 12.0
                ) * COALESCE(lp.annual_leave_after_probation, 6)::numeric,
                2
            )
    END as expected_prorata,
    -- Status
    CASE
        WHEN lb.total_days = 
            CASE
                WHEN e.hire_date::date < ('2025-01-01')::date THEN
                    COALESCE(lp.annual_leave_after_probation, 6)::numeric
                ELSE
                    ROUND(
                        (
                            (
                                EXTRACT(MONTH FROM AGE(
                                    ('2025-12-31')::date,
                                    e.hire_date::date
                                ))::numeric +
                                CASE
                                    WHEN EXTRACT(DAY FROM AGE(
                                        ('2025-12-31')::date,
                                        e.hire_date::date
                                    )) > 15 THEN 1
                                    ELSE 0
                                END
                            ) / 12.0
                        ) * COALESCE(lp.annual_leave_after_probation, 6)::numeric,
                        2
                    )
            END
        THEN '✅ ถูกต้อง'
        ELSE '❌ ต้องแก้ไข'
    END as status
FROM employees e
LEFT JOIN leave_balances lb ON lb.employee_id = e.id AND lb.year = 2025
LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id AND lt.code IN ('ANNUAL', 'VAC')
LEFT JOIN leave_policies lp ON lp.leave_type_id = lt.id AND lp.year = 2025 AND lp.is_active = true
WHERE e.is_active = true
  AND lt.code IN ('ANNUAL', 'VAC')
ORDER BY e.hire_date DESC;


-- =====================================================
-- STEP 2: FIX - อัปเดตเฉพาะคนที่คำนวณผิด
-- ⚠️ รัน STEP 1 ก่อนเพื่อดูผลลัพธ์
-- =====================================================

/*
UPDATE leave_balances lb
SET 
    total_days = CASE
        WHEN e.hire_date::date < (lb.year || '-01-01')::date THEN
            -- ทำงานก่อนปีนี้ = ได้เต็ม
            COALESCE(lp.annual_leave_after_probation, 6)::numeric
        ELSE
            -- ทำงานในปีนี้ = Pro-rata
            ROUND(
                (
                    (
                        EXTRACT(MONTH FROM AGE(
                            (lb.year || '-12-31')::date,
                            e.hire_date::date
                        ))::numeric +
                        CASE
                            WHEN EXTRACT(DAY FROM AGE(
                                (lb.year || '-12-31')::date,
                                e.hire_date::date
                            )) > 15 THEN 1
                            ELSE 0
                        END
                    ) / 12.0
                ) * COALESCE(lp.annual_leave_after_probation, 6)::numeric,
                2
            )
    END,
    accumulated_minutes = CASE
        WHEN e.hire_date::date < (lb.year || '-01-01')::date THEN
            ROUND(COALESCE(lp.annual_leave_after_probation, 6)::numeric * 480.0)
        ELSE
            ROUND(
                (
                    (
                        EXTRACT(MONTH FROM AGE(
                            (lb.year || '-12-31')::date,
                            e.hire_date::date
                        ))::numeric +
                        CASE
                            WHEN EXTRACT(DAY FROM AGE(
                                (lb.year || '-12-31')::date,
                                e.hire_date::date
                            )) > 15 THEN 1
                            ELSE 0
                        END
                    ) / 12.0
                ) * COALESCE(lp.annual_leave_after_probation, 6)::numeric * 480.0
            )
    END,
    updated_at = NOW()
FROM employees e
JOIN leave_types lt ON lb.leave_type_id = lt.id
LEFT JOIN leave_policies lp ON lp.leave_type_id = lt.id AND lp.year = lb.year AND lp.is_active = true
WHERE lb.employee_id = e.id
  AND lb.year = 2025
  AND lt.code IN ('ANNUAL', 'VAC')
  AND e.is_active = true;
*/


-- =====================================================
-- ตัวอย่างการคำนวณ Pro-rata (สำหรับอ้างอิง)
-- =====================================================
-- hire_date       | เดือนทำงาน | วันเพิ่ม | เดือนรวม | Pro-rata (6วัน/ปี)
-- --------------- | ---------- | -------- | -------- | ------------------
-- 2024-01-01      | ก่อนปีนี้   | -        | 12       | 6.00 วัน (เต็ม)
-- 2025-01-01      | 12         | 0        | 12       | 6.00 วัน
-- 2025-01-15      | 11         | 16       | 12       | 6.00 วัน
-- 2025-06-01      | 7          | 0        | 7        | 3.50 วัน
-- 2025-06-15      | 6          | 16       | 7        | 3.50 วัน
-- 2025-07-01      | 6          | 0        | 6        | 3.00 วัน
-- 2025-10-01      | 3          | 0        | 3        | 1.50 วัน
-- 2025-12-01      | 1          | 0        | 1        | 0.50 วัน
-- =====================================================

SELECT 'รัน STEP 1 เพื่อตรวจสอบ แล้ว uncomment STEP 2 เพื่อแก้ไข' as instruction;
