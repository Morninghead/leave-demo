BEGIN;

DELETE FROM evaluation_form_actions
WHERE evaluation_form_id IN (
    '50000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002'
);

DELETE FROM evaluation_form_scores
WHERE evaluation_form_id IN (
    '50000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002'
);

DELETE FROM evaluation_forms
WHERE id IN (
    '50000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002'
);

DELETE FROM leave_requests
WHERE id IN (
    '40000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000004',
    '40000000-0000-0000-0000-000000000005',
    '40000000-0000-0000-0000-000000000006'
);

DELETE FROM leave_balances
WHERE employee_id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000008'
);

DELETE FROM employees
WHERE id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000007',
    '20000000-0000-0000-0000-000000000008'
);

DELETE FROM departments
WHERE id IN (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003'
);

DELETE FROM leave_types
WHERE id IN (
    '30000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000003'
);

INSERT INTO departments (
    id,
    department_code,
    name_th,
    name_en,
    description_th,
    description_en,
    is_active,
    level,
    sort_order
) VALUES
    ('10000000-0000-0000-0000-000000000001', 'HR', 'ทรัพยากรบุคคล', 'Human Resources', 'ฝ่ายดูแล demo workflow', 'Demo HR team', true, 0, 1),
    ('10000000-0000-0000-0000-000000000002', 'OPS', 'ปฏิบัติการ', 'Operations', 'ทีมหลักสำหรับ leave และ probation demo', 'Core department for leave and probation demo', true, 0, 2),
    ('10000000-0000-0000-0000-000000000003', 'WH', 'คลังสินค้า', 'Warehouse', 'ทีมรองสำหรับรายงานระดับแผนก', 'Secondary team for analytics views', true, 0, 3);

INSERT INTO leave_types (
    id,
    code,
    name_th,
    name_en,
    description_th,
    description_en,
    default_days,
    requires_attachment,
    is_paid,
    color,
    is_active,
    allow_hourly_leave,
    working_hours_per_day,
    minutes_per_day
) VALUES
    ('30000000-0000-0000-0000-000000000001', 'ANNUAL', 'ลาพักร้อน', 'Annual Leave', 'ใช้สำหรับโชว์สิทธิ์วันลาพักร้อน', 'Annual leave for demo balances', 10, false, true, '#16A34A', true, false, 8.0, 480),
    ('30000000-0000-0000-0000-000000000002', 'SICK', 'ลาป่วย', 'Sick Leave', 'ใช้สำหรับเคสอนุมัติและคงเหลือ', 'Sick leave for approved and pending cases', 30, false, true, '#DC2626', true, true, 8.0, 480),
    ('30000000-0000-0000-0000-000000000003', 'PERSONAL', 'ลากิจ', 'Personal Leave', 'ใช้สำหรับเคสปฏิเสธในรายงาน', 'Personal leave for rejected report cases', 7, false, true, '#2563EB', true, true, 8.0, 480);

INSERT INTO employees (
    id,
    employee_code,
    scan_code,
    national_id,
    first_name_th,
    last_name_th,
    first_name_en,
    last_name_en,
    email,
    phone_number,
    emergency_contact_name,
    emergency_contact_phone,
    hire_date,
    department_id,
    position_th,
    position_en,
    password_hash,
    must_change_password,
    role,
    is_active,
    status,
    is_department_admin,
    is_department_manager,
    has_custom_password,
    direct_leader_id
) VALUES
    ('20000000-0000-0000-0000-000000000001', '900100001', 'H1001', '1100100000001', 'มณี', 'ศรีสุข', 'Manee', 'Srisuk', 'hr.demo@example.com', '0800000001', 'HR Contact', '0800000091', DATE '2024-01-15', '10000000-0000-0000-0000-000000000001', 'เจ้าหน้าที่ HR', 'HR Specialist', '$2b$10$ahQSYQsmYIHZaLLM01zJ8.iSQmozxa0FSMBU4hHxVgC.GVqE8GNBa', false, 'hr', true, 'active', false, false, true, NULL),
    ('20000000-0000-0000-0000-000000000002', '900100002', 'H1002', '1100100000002', 'อริสา', 'จันทร์ดี', 'Arisa', 'Chandee', 'admin.demo@example.com', '0800000002', 'Admin Contact', '0800000092', DATE '2023-09-01', '10000000-0000-0000-0000-000000000001', 'ผู้ดูแลระบบ', 'Administrator', '$2b$10$ahQSYQsmYIHZaLLM01zJ8.iSQmozxa0FSMBU4hHxVgC.GVqE8GNBa', false, 'admin', true, 'active', true, true, true, NULL),
    ('20000000-0000-0000-0000-000000000003', '900200001', 'O2001', '1100200000001', 'กิตติ', 'พงศ์ชัย', 'Kitti', 'Pongchai', 'ops.manager@example.com', '0800000003', 'Ops Contact', '0800000093', DATE '2023-08-10', '10000000-0000-0000-0000-000000000002', 'ผู้จัดการฝ่ายปฏิบัติการ', 'Operations Manager', '$2b$10$ahQSYQsmYIHZaLLM01zJ8.iSQmozxa0FSMBU4hHxVgC.GVqE8GNBa', false, 'manager', true, 'active', false, true, true, NULL),
    ('20000000-0000-0000-0000-000000000004', '900200002', 'O2002', '1100200000002', 'ธนา', 'รุ่งเรือง', 'Thana', 'Rungruang', 'ops.leader@example.com', '0800000004', 'Leader Contact', '0800000094', DATE '2024-02-01', '10000000-0000-0000-0000-000000000002', 'หัวหน้าทีมปฏิบัติการ', 'Operations Leader', '$2b$10$ahQSYQsmYIHZaLLM01zJ8.iSQmozxa0FSMBU4hHxVgC.GVqE8GNBa', false, 'leader', true, 'active', false, false, true, NULL),
    ('20000000-0000-0000-0000-000000000005', '900200003', 'O2003', '1100200000003', 'พราว', 'แสงทอง', 'Proud', 'Saengthong', 'employee.one@example.com', '0800000005', 'Family Contact', '0800000095', DATE '2024-06-03', '10000000-0000-0000-0000-000000000002', 'เจ้าหน้าที่ปฏิบัติการ', 'Operations Officer', '$2b$10$ahQSYQsmYIHZaLLM01zJ8.iSQmozxa0FSMBU4hHxVgC.GVqE8GNBa', false, 'employee', true, 'active', false, false, true, '20000000-0000-0000-0000-000000000004'),
    ('20000000-0000-0000-0000-000000000006', '900200004', 'O2004', '1100200000004', 'ภูมิ', 'ทวีศักดิ์', 'Phumi', 'Taweesak', 'employee.two@example.com', '0800000006', 'Family Contact', '0800000096', DATE '2025-12-15', '10000000-0000-0000-0000-000000000002', 'เจ้าหน้าที่ปฏิบัติการ', 'Operations Officer', '$2b$10$ahQSYQsmYIHZaLLM01zJ8.iSQmozxa0FSMBU4hHxVgC.GVqE8GNBa', false, 'employee', true, 'active', false, false, true, '20000000-0000-0000-0000-000000000004'),
    ('20000000-0000-0000-0000-000000000007', '900300001', 'W3001', '1100300000001', 'ศรัณย์', 'โชติช่วง', 'Sarun', 'Chotchoung', 'warehouse.manager@example.com', '0800000007', 'Warehouse Contact', '0800000097', DATE '2023-07-20', '10000000-0000-0000-0000-000000000003', 'ผู้จัดการคลังสินค้า', 'Warehouse Manager', '$2b$10$ahQSYQsmYIHZaLLM01zJ8.iSQmozxa0FSMBU4hHxVgC.GVqE8GNBa', false, 'manager', true, 'active', false, true, true, NULL),
    ('20000000-0000-0000-0000-000000000008', '900300002', 'W3002', '1100300000002', 'ขวัญ', 'มั่นคง', 'Kwan', 'Mankong', 'warehouse.employee@example.com', '0800000008', 'Warehouse Family', '0800000098', DATE '2026-01-20', '10000000-0000-0000-0000-000000000003', 'เจ้าหน้าที่คลังสินค้า', 'Warehouse Officer', '$2b$10$ahQSYQsmYIHZaLLM01zJ8.iSQmozxa0FSMBU4hHxVgC.GVqE8GNBa', false, 'employee', true, 'active', false, false, true, '20000000-0000-0000-0000-000000000007');

INSERT INTO company_settings (setting_key, setting_value, description) VALUES
    ('company_name_th', 'บริษัทเดโมบริหารการลา', 'Thai company name for portfolio demo'),
    ('company_name_en', 'Portfolio Demo Company', 'English company name for portfolio demo'),
    ('work_days_per_week', '5', 'Working days per week'),
    ('working_days_per_week', '5', 'Working days per week'),
    ('branding_settings', '{"logo":{"type":"icon","iconName":"Calendar","backgroundColor":"#2563eb","width":64,"height":64,"iconSize":48,"rounded":"lg","imagePath":""},"primaryColor":"#2563eb"}', 'Branding settings'),
    ('require_1_year_tenure_for_vacation', 'false', 'Allow prorated annual leave in demo'),
    ('force_password_change_on_first_login', 'false', 'Keep demo login friction low'),
    ('password_min_length', '8', 'Password minimum length'),
    ('password_require_uppercase', 'true', 'Password uppercase requirement'),
    ('password_require_lowercase', 'true', 'Password lowercase requirement'),
    ('password_require_numbers', 'true', 'Password number requirement'),
    ('password_require_special_chars', 'true', 'Password special character requirement'),
    ('password_expiry_days', '90', 'Password expiry days'),
    ('notification_settings', '{"email":{"leave_request":false,"approved":false,"rejected":false},"line":{"leave_request":false,"approved":false,"rejected":false},"telegram":{"leave_request":false,"approved":false,"rejected":false}}', 'Disable notification channels by default in demo')
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO leave_balances (
    employee_id,
    leave_type_id,
    year,
    total_days,
    used_days,
    remaining_days,
    accumulated_minutes,
    pending_days,
    probation_end_date,
    is_probation_complete,
    pro_rata_months,
    pro_rata_days
) VALUES
    ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', 2026, 10.00, 3.00, 7.00, 4800, 0.00, NULL, true, 0, 0),
    ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 2026, 30.00, 1.00, 29.00, 14400, 0.00, NULL, true, 0, 0),
    ('20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', 2026, 7.00, 0.00, 7.00, 3360, 0.00, NULL, true, 0, 0),
    ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000001', 2026, 3.00, 0.00, 2.00, 1440, 1.00, DATE '2026-04-13', false, 3.00, 1.50),
    ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000002', 2026, 30.00, 0.50, 29.00, 14400, 0.50, DATE '2026-04-13', false, 3.00, 1.50),
    ('20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000003', 2026, 7.00, 0.00, 7.00, 3360, 0.00, DATE '2026-04-13', false, 3.00, 1.50),
    ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000001', 2026, 2.50, 0.00, 2.50, 1200, 0.00, DATE '2026-05-19', false, 2.50, 1.25),
    ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000002', 2026, 30.00, 0.00, 30.00, 14400, 0.00, DATE '2026-05-19', false, 2.50, 1.25),
    ('20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000003', 2026, 7.00, 1.00, 6.00, 3360, 0.00, DATE '2026-05-19', false, 2.50, 1.25),
    ('20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 2026, 10.00, 1.00, 9.00, 4800, 0.00, NULL, true, 0, 0),
    ('20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001', 2026, 10.00, 2.00, 8.00, 4800, 0.00, NULL, true, 0, 0);

INSERT INTO leave_requests (
    id,
    request_number,
    employee_id,
    leave_type_id,
    start_date,
    end_date,
    total_days,
    reason,
    reason_language,
    attachment_urls,
    status,
    current_approval_stage,
    department_manager_approved_by,
    department_manager_approved_at,
    hr_approved_by,
    hr_approved_at,
    rejection_stage,
    rejection_reason_th,
    created_at,
    updated_at,
    is_half_day,
    shift_type,
    is_hourly_leave,
    leave_hours,
    leave_minutes,
    skipped_stages
) VALUES
    ('40000000-0000-0000-0000-000000000001', 'LR-2026-0001', '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000001', DATE '2026-01-13', DATE '2026-01-14', 2.00, 'พักผ่อนประจำปี', 'th', '[]'::jsonb, 'approved', 2, '20000000-0000-0000-0000-000000000003', TIMESTAMP '2026-01-08 10:00:00', '20000000-0000-0000-0000-000000000001', TIMESTAMP '2026-01-08 13:00:00', NULL, NULL, TIMESTAMP '2026-01-07 09:00:00', TIMESTAMP '2026-01-08 13:00:00', false, 'day', false, NULL, NULL, '[]'::jsonb),
    ('40000000-0000-0000-0000-000000000002', 'LR-2026-0002', '20000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000002', DATE '2026-04-02', DATE '2026-04-02', 0.50, 'พบแพทย์ช่วงเช้า', 'th', '[]'::jsonb, 'pending', 1, NULL, NULL, NULL, NULL, NULL, NULL, TIMESTAMP '2026-03-30 08:30:00', TIMESTAMP '2026-03-30 08:30:00', true, 'day', true, 4.0, 240, '[]'::jsonb),
    ('40000000-0000-0000-0000-000000000003', 'LR-2026-0003', '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000003', DATE '2026-02-18', DATE '2026-02-18', 1.00, 'ติดต่อราชการ', 'th', '[]'::jsonb, 'rejected', 1, '20000000-0000-0000-0000-000000000007', TIMESTAMP '2026-02-12 11:15:00', NULL, NULL, 'department_manager', 'ทีมงานยังไม่พร้อมรองรับวันลานี้', TIMESTAMP '2026-02-12 09:00:00', TIMESTAMP '2026-02-12 11:15:00', false, 'day', false, NULL, NULL, '[]'::jsonb),
    ('40000000-0000-0000-0000-000000000004', 'LR-2026-0004', '20000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000001', DATE '2026-03-10', DATE '2026-03-11', 2.00, 'ลาพักร้อนหลัง inventory รอบใหญ่', 'th', '[]'::jsonb, 'approved', 2, '20000000-0000-0000-0000-000000000007', TIMESTAMP '2026-03-03 15:00:00', '20000000-0000-0000-0000-000000000001', TIMESTAMP '2026-03-04 09:30:00', NULL, NULL, TIMESTAMP '2026-03-03 10:20:00', TIMESTAMP '2026-03-04 09:30:00', false, 'day', false, NULL, NULL, '[]'::jsonb),
    ('40000000-0000-0000-0000-000000000005', 'LR-2026-0005', '20000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', DATE '2026-03-20', DATE '2026-03-20', 1.00, 'ไข้หวัด', 'th', '[]'::jsonb, 'approved', 2, '20000000-0000-0000-0000-000000000003', TIMESTAMP '2026-03-19 13:00:00', '20000000-0000-0000-0000-000000000001', TIMESTAMP '2026-03-19 15:00:00', NULL, NULL, TIMESTAMP '2026-03-19 09:00:00', TIMESTAMP '2026-03-19 15:00:00', false, 'day', false, NULL, NULL, '[]'::jsonb),
    ('40000000-0000-0000-0000-000000000006', 'LR-2026-0006', '20000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000001', DATE '2026-03-27', DATE '2026-03-27', 1.00, 'ลาหลังตรวจนับ stock', 'th', '[]'::jsonb, 'pending', 1, NULL, NULL, NULL, NULL, NULL, NULL, TIMESTAMP '2026-03-26 14:00:00', TIMESTAMP '2026-03-26 14:00:00', false, 'day', false, NULL, NULL, '[1]'::jsonb);

INSERT INTO evaluation_forms (
    id,
    form_number,
    employee_id,
    department_id,
    issuer_hr_id,
    leader_id,
    manager_id,
    hr_ack_id,
    hr_manager_id,
    probation_start_date,
    probation_end_date,
    extension_end_date,
    has_leader_stage,
    status,
    current_step,
    pass_threshold,
    total_score,
    recommendation,
    result_comment,
    employee_visible,
    created_at,
    updated_at,
    completed_at
) VALUES
    ('50000000-0000-0000-0000-000000000001', 'PF-2026-0001', '20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', DATE '2025-12-15', DATE '2026-04-13', NULL, true, 'PENDING_LEADER', 'LEADER', 65, 42.00, NULL, 'รอหัวหน้าประเมินในรอบแรก', true, TIMESTAMP '2026-03-15 09:00:00', TIMESTAMP '2026-03-28 16:00:00', NULL),
    ('50000000-0000-0000-0000-000000000002', 'PF-2026-0002', '20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', NULL, '20000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', DATE '2026-01-20', DATE '2026-05-19', NULL, false, 'COMPLETED', 'COMPLETED', 65, 84.00, 'PASS', 'ผ่านการทดลองงานและพร้อมรับผิดชอบงานประจำ', true, TIMESTAMP '2026-03-01 08:45:00', TIMESTAMP '2026-03-25 17:30:00', TIMESTAMP '2026-03-25 17:30:00');

INSERT INTO evaluation_form_scores (
    evaluation_form_id,
    question_code,
    section_code,
    question_text_th,
    question_text_en,
    max_score,
    score,
    comment
) VALUES
    ('50000000-0000-0000-0000-000000000001', '1.1', 'QUALITY', 'คุณภาพของงานตามมาตรฐานที่กำหนด', 'The standards quality of work', 20, 12, 'ยังต้องเพิ่มความสม่ำเสมอ'),
    ('50000000-0000-0000-0000-000000000001', '1.2', 'QUALITY', 'ปริมาณงาน ผลงาน', 'Quantity of work', 20, 11, 'ส่งมอบงานทันตามแผน'),
    ('50000000-0000-0000-0000-000000000001', '2.1', 'ABILITY', 'ความสามารถในการตัดสินใจแก้ไขปัญหา', 'Adjudication to solving problems', 5, 3, 'ต้องการ coaching เพิ่ม'),
    ('50000000-0000-0000-0000-000000000001', '2.2', 'ABILITY', 'ความสามารถในการเรียนรู้งานใหม่', 'Learning new jobs', 5, 4, 'เรียนรู้งานใหม่ได้ดี'),
    ('50000000-0000-0000-0000-000000000001', '2.3', 'ABILITY', 'ความคิดริเริ่มและการปรับปรุงวิธีการทำงาน', 'Initiative and improvement', 10, 5, 'เริ่มเสนอไอเดียได้บ้าง'),
    ('50000000-0000-0000-0000-000000000001', '2.4', 'ABILITY', 'ความรอบรู้ในหน้าที่การงาน', 'Knowledge in duty', 10, 7, 'เข้าใจ SOP หลักแล้ว'),
    ('50000000-0000-0000-0000-000000000001', '3.1', 'HABITS', 'ความร่วมมือกับเพื่อนร่วมงาน', 'Collaboration with other', 5, 5, 'ทำงานร่วมทีมได้ดี'),
    ('50000000-0000-0000-0000-000000000001', '3.2', 'HABITS', 'การปฏิบัติงานตามระเบียบ คำสั่งบริษัท', 'Compliance and regulatory company', 5, 4, 'มีวินัยดี'),
    ('50000000-0000-0000-0000-000000000001', '3.3', 'HABITS', 'ความขยันหมั่นเพียรและความเอาใจใส่ในหน้าที่', 'Diligent and caring work', 10, 7, 'ตั้งใจทำงาน'),
    ('50000000-0000-0000-0000-000000000001', '3.4', 'HABITS', 'ทัศนคติต่อบริษัทและการปกครองบังคับบัญชา', 'Attitude towards company', 5, 4, 'ตอบรับ feedback ดี'),
    ('50000000-0000-0000-0000-000000000001', '3.5', 'HABITS', 'ความเชื่อถือได้', 'Trust', 5, 4, 'ตรงเวลาและรับผิดชอบ'),
    ('50000000-0000-0000-0000-000000000002', '1.1', 'QUALITY', 'คุณภาพของงานตามมาตรฐานที่กำหนด', 'The standards quality of work', 20, 17, 'ผลงานสม่ำเสมอ'),
    ('50000000-0000-0000-0000-000000000002', '1.2', 'QUALITY', 'ปริมาณงาน ผลงาน', 'Quantity of work', 20, 16, 'รับโหลดงานได้ดี'),
    ('50000000-0000-0000-0000-000000000002', '2.1', 'ABILITY', 'ความสามารถในการตัดสินใจแก้ไขปัญหา', 'Adjudication to solving problems', 5, 4, 'แก้ปัญหาหน้างานได้'),
    ('50000000-0000-0000-0000-000000000002', '2.2', 'ABILITY', 'ความสามารถในการเรียนรู้งานใหม่', 'Learning new jobs', 5, 4, 'เรียนรู้งานเร็ว'),
    ('50000000-0000-0000-0000-000000000002', '2.3', 'ABILITY', 'ความคิดริเริ่มและการปรับปรุงวิธีการทำงาน', 'Initiative and improvement', 10, 8, 'มีข้อเสนอปรับปรุงจริง'),
    ('50000000-0000-0000-0000-000000000002', '2.4', 'ABILITY', 'ความรอบรู้ในหน้าที่การงาน', 'Knowledge in duty', 10, 8, 'เข้าใจงานรอบคลังสินค้า'),
    ('50000000-0000-0000-0000-000000000002', '3.1', 'HABITS', 'ความร่วมมือกับเพื่อนร่วมงาน', 'Collaboration with other', 5, 5, 'ทำงานกับทีมได้ดี'),
    ('50000000-0000-0000-0000-000000000002', '3.2', 'HABITS', 'การปฏิบัติงานตามระเบียบ คำสั่งบริษัท', 'Compliance and regulatory company', 5, 4, 'มีวินัยดี'),
    ('50000000-0000-0000-0000-000000000002', '3.3', 'HABITS', 'ความขยันหมั่นเพียรและความเอาใจใส่ในหน้าที่', 'Diligent and caring work', 10, 8, 'ลงรายละเอียดครบ'),
    ('50000000-0000-0000-0000-000000000002', '3.4', 'HABITS', 'ทัศนคติต่อบริษัทและการปกครองบังคับบัญชา', 'Attitude towards company', 5, 5, 'เปิดรับ feedback'),
    ('50000000-0000-0000-0000-000000000002', '3.5', 'HABITS', 'ความเชื่อถือได้', 'Trust', 5, 5, 'เชื่อถือได้');

INSERT INTO evaluation_form_actions (
    evaluation_form_id,
    action_step,
    action_type,
    actor_id,
    comment,
    recommendation,
    signature_data,
    signed_at,
    metadata,
    created_at
) VALUES
    ('50000000-0000-0000-0000-000000000001', 'ISSUE', 'ISSUED', '20000000-0000-0000-0000-000000000001', 'ออกเอกสารสำหรับ probation round นี้', NULL, NULL, NULL, '{"source":"demo-seed"}', TIMESTAMP '2026-03-15 09:00:00'),
    ('50000000-0000-0000-0000-000000000002', 'ISSUE', 'ISSUED', '20000000-0000-0000-0000-000000000001', 'เริ่มต้นเอกสารประเมิน', NULL, NULL, NULL, '{"source":"demo-seed"}', TIMESTAMP '2026-03-01 08:45:00'),
    ('50000000-0000-0000-0000-000000000002', 'MANAGER', 'SIGNED', '20000000-0000-0000-0000-000000000007', 'ผู้จัดการคลังสินค้าประเมินครบถ้วน', NULL, 'Sarun Chotchoung', TIMESTAMP '2026-03-18 14:00:00', '{"source":"demo-seed"}', TIMESTAMP '2026-03-18 14:00:00'),
    ('50000000-0000-0000-0000-000000000002', 'HR', 'SIGNED', '20000000-0000-0000-0000-000000000001', 'HR ตรวจสอบเอกสารแล้ว', 'PASS', 'Manee Srisuk', TIMESTAMP '2026-03-22 10:00:00', '{"source":"demo-seed"}', TIMESTAMP '2026-03-22 10:00:00'),
    ('50000000-0000-0000-0000-000000000002', 'HR_MANAGER', 'COMPLETED', '20000000-0000-0000-0000-000000000002', 'ปิดผลการประเมินเรียบร้อย', 'PASS', 'Arisa Chandee', TIMESTAMP '2026-03-25 17:30:00', '{"source":"demo-seed"}', TIMESTAMP '2026-03-25 17:30:00');

COMMIT;
