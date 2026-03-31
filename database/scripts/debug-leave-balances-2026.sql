-- ตรวจสอบสถานะข้อมูลปัจจุบัน
-- 1. มี leave_balances ปี 2026 หรือยัง?
SELECT 
  'สถานะข้อมูล leave_balances ปี 2026' as check_type,
  COUNT(*) as total_records,
  COUNT(DISTINCT employee_id) as employees_with_balances
FROM leave_balances lb
JOIN leave_types lt ON lb.leave_type_id = lt.id
WHERE lb.year = 2026 AND lt.code = 'ANNUAL';

-- 2. มีพนักงานที่เข้าปี 2025 (ยังไม่ครบ 1 ปี) หรือไม่?
SELECT 
  'พนักงานที่เข้าปี 2025' as check_type,
  COUNT(*) as total_employees,
  STRING_AGG(employee_code, ', ' ORDER BY employee_code) as employee_codes
FROM employees
WHERE hire_date >= '2025-01-01'
  AND hire_date < '2026-01-05'
  AND is_active = true;

-- 3. ตัวอย่างข้อมูลปัจจุบันของพนักงานที่เข้าปี 2025
SELECT 
  e.employee_code,
  e.hire_date,
  
  -- เดือนที่ทำงาน
  (
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) * 12 +
    EXTRACT(MONTH FROM AGE(CURRENT_DATE, e.hire_date)) +
    CASE
      WHEN EXTRACT(DAY FROM AGE(CURRENT_DATE, e.hire_date)) > 15 THEN 1
      ELSE 0
    END
  ) as months_worked,
  
  -- ค่าใน database ตอนนี้
  lb.total_days as current_in_database,
  
  -- ค่าที่ควรจะเป็น (tenure-based)
  LEAST(
    ROUND(
      (
        (
          EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date::date)) * 12 +
          EXTRACT(MONTH FROM AGE(CURRENT_DATE, e.hire_date::date)) +
          CASE
            WHEN EXTRACT(DAY FROM AGE(CURRENT_DATE, e.hire_date::date)) > 15 THEN 1
            ELSE 0
          END
        ) / 12.0
      ) * 6.0 * 2
    ) / 2.0,
    6.0
  ) as should_be,
  
  -- ผลต่าง
  LEAST(
    ROUND(
      (
        (
          EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date::date)) * 12 +
          EXTRACT(MONTH FROM AGE(CURRENT_DATE, e.hire_date::date)) +
          CASE
            WHEN EXTRACT(DAY FROM AGE(CURRENT_DATE, e.hire_date::date)) > 15 THEN 1
            ELSE 0
          END
        ) / 12.0
      ) * 6.0 * 2
    ) / 2.0,
    6.0
  ) - COALESCE(lb.total_days, 0) as difference
  
FROM employees e
LEFT JOIN leave_balances lb ON e.id = lb.employee_id
LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id AND lt.code = 'ANNUAL' AND lb.year = 2026
WHERE e.hire_date >= '2025-01-01'
  AND e.hire_date < '2026-01-05'
  AND e.is_active = true
ORDER BY e.hire_date
LIMIT 10;
