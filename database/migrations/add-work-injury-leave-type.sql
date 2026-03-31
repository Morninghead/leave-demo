INSERT INTO leave_types (
    code,
    name_th,
    name_en,
    description_th,
    description_en,
    default_days,
    requires_attachment,
    is_paid,
    color_code,
    is_active,
    color,
    allow_hourly_leave,
    working_hours_per_day,
    minutes_per_day
)
SELECT
    'WORK_INJURY',
    'ลาป่วยจากอุบัติเหตุจากการทำงาน',
    'Work Injury Leave',
    'ใช้สำหรับลาป่วยที่เกิดจากอุบัติเหตุหรือการบาดเจ็บจากการทำงาน ต้องแนบใบรับรองแพทย์ทุกครั้ง และไม่หักโควตาลาป่วย 30 วัน',
    'Used for sickness caused by work-related accidents or injuries. Medical certificate is required for every request and this leave does not deduct the 30-day sick leave quota.',
    999,
    TRUE,
    TRUE,
    '#B45309',
    TRUE,
    '#B45309',
    FALSE,
    8,
    480
WHERE NOT EXISTS (
    SELECT 1
    FROM leave_types
    WHERE code = 'WORK_INJURY'
);

INSERT INTO leave_policies (
    leave_type_id,
    year,
    default_days,
    effective_from,
    notes,
    is_active,
    created_at,
    updated_at
)
SELECT
    lt.id,
    years.year,
    999,
    make_date(years.year, 1, 1),
    'Auto-created policy for work injury leave',
    TRUE,
    NOW(),
    NOW()
FROM leave_types lt
CROSS JOIN (
    SELECT DISTINCT year
    FROM leave_policies
    UNION
    SELECT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
) years
WHERE lt.code = 'WORK_INJURY'
  AND NOT EXISTS (
      SELECT 1
      FROM leave_policies lp
      WHERE lp.leave_type_id = lt.id
        AND lp.year = years.year
  );
