-- ตรวจสอบผลกระทบต่อพนักงานทุกคน จากการเปลี่ยนเป็น Tenure-Based Calculation
-- วันที่: 2026-01-05

-- 1. สรุปภาพรวม: กี่คนได้รับผลกระทบ
SELECT 
  'ภาพรวมผลกระทบ' as category,
  COUNT(*) as total_employees,
  
  -- พนักงานที่วันลาจะเพิ่มขึ้น
  COUNT(*) FILTER (WHERE new_balance > old_balance) as will_increase,
  
  -- พนักงานที่วันลาจะลดลง
  COUNT(*) FILTER (WHERE new_balance < old_balance) as will_decrease,
  
  -- พนักงานที่ไม่เปลี่ยนแปลง
  COUNT(*) FILTER (WHERE new_balance = old_balance) as unchanged,
  
  -- ผลรวมวันลาที่ลดลงทั้งหมด (กรณีลบ)
  ROUND(SUM(CASE WHEN new_balance < old_balance THEN new_balance - old_balance ELSE 0 END), 1) as total_reduction,
  
  -- ผลรวมวันลาที่เพิ่มขึ้นทั้งหมด
  ROUND(SUM(CASE WHEN new_balance > old_balance THEN new_balance - old_balance ELSE 0 END), 1) as total_addition
  
FROM (
  SELECT 
    e.id,
    lb.total_days as old_balance,
    
    -- NEW: Tenure-based calculation
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
    ) as new_balance
    
  FROM employees e
  JOIN leave_balances lb ON e.id = lb.employee_id
  JOIN leave_types lt ON lb.leave_type_id = lt.id
  WHERE lt.code = 'ANNUAL'
    AND lb.year = 2026
    AND e.is_active = true
) comparison;

-- 2. รายละเอียดพนักงานที่ได้รับผลกระทบ (เรียงตามความแตกต่าง)
SELECT 
  e.employee_code,
  e.first_name_th || ' ' || e.last_name_th as name,
  e.hire_date,
  
  -- อายุงาน
  EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) || ' ปี ' ||
  EXTRACT(MONTH FROM AGE(CURRENT_DATE, e.hire_date)) || ' เดือน' as tenure,
  
  -- เดือนที่ทำงาน
  (
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) * 12 +
    EXTRACT(MONTH FROM AGE(CURRENT_DATE, e.hire_date)) +
    CASE
      WHEN EXTRACT(DAY FROM AGE(CURRENT_DATE, e.hire_date)) > 15 THEN 1
      ELSE 0
    END
  ) as total_months,
  
  -- เดิม
  COALESCE(lb.total_days, 0) as old_balance,
  
  -- ใหม่
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
  ) as new_balance,
  
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
  ) - COALESCE(lb.total_days, 0) as difference,
  
  -- ใช้ไปแล้ว
  COALESCE(lb.used_days, 0) as used,
  
  -- คงเหลือ (ใหม่)
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
  ) - COALESCE(lb.used_days, 0) as available_new,
  
  -- สถานะ
  CASE
    WHEN LEAST(
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
    ) > COALESCE(lb.total_days, 0) THEN '⬆️ เพิ่ม'
    WHEN LEAST(
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
    ) < COALESCE(lb.total_days, 0) THEN '⬇️ ลด'
    ELSE '➡️ เท่าเดิม'
  END as status
  
FROM employees e
LEFT JOIN leave_balances lb ON e.id = lb.employee_id
LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id AND lt.code = 'ANNUAL' AND lb.year = 2026
WHERE e.is_active = true
ORDER BY 
  -- เรียงตามความแตกต่าง (ลดมากที่สุดก่อน)
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
  ) - COALESCE(lb.total_days, 0) ASC;

-- 3. พนักงานที่เข้าทำงานปี 2025 (กลุ่มที่ได้รับผลกระทบมากที่สุด)
SELECT 
  '=== พนักงานที่เข้าปี 2025 (ยังไม่ครบ 1 ปี) ===' as info;

SELECT 
  e.employee_code,
  e.first_name_th || ' ' || e.last_name_th as name,
  e.hire_date,
  
  (
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, e.hire_date)) * 12 +
    EXTRACT(MONTH FROM AGE(CURRENT_DATE, e.hire_date)) +
    CASE
      WHEN EXTRACT(DAY FROM AGE(CURRENT_DATE, e.hire_date)) > 15 THEN 1
      ELSE 0
    END
  ) || ' เดือน' as months_worked,
  
  COALESCE(lb.total_days, 0) || ' วัน' as old,
  
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
  ) || ' วัน' as new,
  
  ROUND(
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
    ) - COALESCE(lb.total_days, 0),
    1
  ) || ' วัน' as diff,
  
  -- วันที่จะครบ 1 ปี
  (e.hire_date::date + INTERVAL '1 year')::date as anniversary_date
  
FROM employees e
LEFT JOIN leave_balances lb ON e.id = lb.employee_id
LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id AND lt.code = 'ANNUAL' AND lb.year = 2026
WHERE e.is_active = true
  AND e.hire_date >= '2025-01-01'
  AND e.hire_date < '2026-01-05'  -- ยังทำงานไม่ครบ 1 ปี
ORDER BY e.hire_date;
