-- =====================================================
-- ตรวจสอบวันลาพักร้อน - พนักงานที่จ้างงานปี 2025
-- =====================================================

-- STEP 1: ตรวจสอบ leave type codes ที่มีในระบบ
SELECT id, code, name_th, name_en 
FROM leave_types 
WHERE is_active = true 
ORDER BY code;

-- STEP 2: ตรวจสอบพนักงานที่จ้างในปี 2025
SELECT 
    e.employee_code,
    CONCAT(e.first_name_th, ' ', e.last_name_th) as name,
    e.hire_date
FROM employees e
WHERE e.is_active = true
  AND e.hire_date >= '2025-01-01'
  AND e.hire_date <= '2025-12-31'
ORDER BY e.hire_date;

-- STEP 3: ตรวจสอบวันลาพักร้อน (เปลี่ยน 'ANNUAL' เป็น code ที่ถูกต้อง)
SELECT 
    e.employee_code as "รหัส",
    CONCAT(e.first_name_th, ' ', e.last_name_th) as "ชื่อ",
    TO_CHAR(e.hire_date, 'DD/MM/YYYY') as "วันเริ่มงาน",
    lt.code as "ประเภทลา",
    
    -- เดือนรวม
    (
        EXTRACT(MONTH FROM AGE('2025-12-31'::date, e.hire_date::date))::integer +
        CASE WHEN EXTRACT(DAY FROM AGE('2025-12-31'::date, e.hire_date::date)) > 15 THEN 1 ELSE 0 END
    ) as "เดือน",
    
    -- ควรได้
    ROUND(
        (
            EXTRACT(MONTH FROM AGE('2025-12-31'::date, e.hire_date::date))::numeric +
            CASE WHEN EXTRACT(DAY FROM AGE('2025-12-31'::date, e.hire_date::date)) > 15 THEN 1 ELSE 0 END
        ) / 12.0 * 6, 2
    ) as "ควรได้",
    
    -- ใน DB
    lb.total_days as "ใน DB",
    
    -- สถานะ
    CASE
        WHEN lb.total_days = ROUND(
            (EXTRACT(MONTH FROM AGE('2025-12-31'::date, e.hire_date::date))::numeric +
             CASE WHEN EXTRACT(DAY FROM AGE('2025-12-31'::date, e.hire_date::date)) > 15 THEN 1 ELSE 0 END
            ) / 12.0 * 6, 2
        ) THEN '✅'
        ELSE '❌'
    END as "OK"

FROM employees e
LEFT JOIN leave_balances lb ON lb.employee_id = e.id AND lb.year = 2025
LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id
WHERE e.is_active = true
  AND e.hire_date >= '2025-01-01'
  AND e.hire_date <= '2025-12-31'
  AND (lt.code IN ('ANNUAL', 'VAC') OR lt.code IS NULL)
ORDER BY e.hire_date;
