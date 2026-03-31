CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_code VARCHAR(20) NOT NULL UNIQUE,
    name_th VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    description_th TEXT,
    description_en TEXT,
    is_active BOOLEAN DEFAULT true,
    parent_department_id UUID,
    level INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code VARCHAR(9) NOT NULL UNIQUE,
    scan_code VARCHAR(5) NOT NULL UNIQUE,
    national_id VARCHAR(13) NOT NULL,
    first_name_th VARCHAR(100) NOT NULL,
    last_name_th VARCHAR(100) NOT NULL,
    first_name_en VARCHAR(100) NOT NULL,
    last_name_en VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone_number VARCHAR(20),
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    birth_date DATE,
    hire_date DATE NOT NULL,
    department_id UUID REFERENCES departments(id),
    position_th VARCHAR(100),
    position_en VARCHAR(100),
    profile_image_url TEXT,
    address_th TEXT,
    address_en TEXT,
    password_hash VARCHAR(255) NOT NULL,
    must_change_password BOOLEAN DEFAULT false,
    role VARCHAR(20) NOT NULL DEFAULT 'employee',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    is_department_admin BOOLEAN DEFAULT false,
    is_department_manager BOOLEAN DEFAULT false,
    has_custom_password BOOLEAN DEFAULT true,
    direct_leader_id UUID REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS company_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES employees(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fiscal_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cycle_start_day INTEGER NOT NULL DEFAULT 26,
    cycle_type VARCHAR(30) NOT NULL DEFAULT 'day_of_month',
    fiscal_year_start_month INTEGER NOT NULL DEFAULT 10,
    filter_pending_by_year BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name_th VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    description_th TEXT,
    description_en TEXT,
    default_days INTEGER NOT NULL DEFAULT 0,
    requires_attachment BOOLEAN DEFAULT false,
    is_paid BOOLEAN DEFAULT true,
    color_code VARCHAR(7),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    color VARCHAR(7) DEFAULT '#3B82F6',
    allow_hourly_leave BOOLEAN DEFAULT false,
    working_hours_per_day NUMERIC(3, 1) DEFAULT 8.0,
    minutes_per_day INTEGER DEFAULT 480
);

CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    total_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
    used_days NUMERIC(5, 2) NOT NULL DEFAULT 0,
    remaining_days NUMERIC(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accumulated_minutes INTEGER DEFAULT 0,
    pending_days NUMERIC(5, 2) DEFAULT 0,
    probation_end_date DATE,
    is_probation_complete BOOLEAN DEFAULT false,
    pro_rata_months NUMERIC(5, 2) DEFAULT 0,
    pro_rata_days NUMERIC(5, 2) DEFAULT 0,
    UNIQUE (employee_id, leave_type_id, year)
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number VARCHAR(20) NOT NULL UNIQUE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(5, 2) NOT NULL,
    reason_th TEXT,
    reason_en TEXT,
    attachment_urls JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    current_approval_stage INTEGER DEFAULT 1,
    department_approved_by UUID REFERENCES employees(id),
    department_approved_at TIMESTAMP,
    department_comment_th TEXT,
    department_comment_en TEXT,
    hr_approved_by UUID REFERENCES employees(id),
    hr_approved_at TIMESTAMP,
    hr_comment_th TEXT,
    hr_comment_en TEXT,
    rejection_stage VARCHAR(20),
    rejection_reason_th TEXT,
    rejection_reason_en TEXT,
    cancellation_reason_th TEXT,
    cancellation_reason_en TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    department_admin_approved_by UUID REFERENCES employees(id),
    department_admin_approved_at TIMESTAMP,
    department_manager_approved_by UUID REFERENCES employees(id),
    department_manager_approved_at TIMESTAMP,
    is_half_day BOOLEAN DEFAULT false,
    half_day_period VARCHAR(20),
    shift_type VARCHAR(20) DEFAULT 'day',
    start_time TIME,
    end_time TIME,
    reason TEXT,
    reason_language VARCHAR(5) DEFAULT 'th',
    canceled_by UUID REFERENCES employees(id),
    canceled_at TIMESTAMPTZ,
    is_hourly_leave BOOLEAN DEFAULT false,
    leave_hours NUMERIC(4, 1),
    leave_start_time TIME,
    leave_end_time TIME,
    leave_minutes INTEGER,
    skipped_stages JSONB DEFAULT '[]'::jsonb,
    auto_skip_reason TEXT
);

CREATE TABLE IF NOT EXISTS employee_department_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    permission_type VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES employees(id),
    type VARCHAR(50) NOT NULL,
    title_th VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    message_th TEXT NOT NULL,
    message_en TEXT NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    slack_sent BOOLEAN DEFAULT false,
    slack_sent_at TIMESTAMP,
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES employees(id),
    action VARCHAR(20) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_status
ON leave_requests(employee_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year
ON leave_balances(employee_id, year);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
ON notifications(recipient_id, created_at DESC);

INSERT INTO fiscal_settings (cycle_start_day, cycle_type, fiscal_year_start_month, filter_pending_by_year)
SELECT 26, 'day_of_month', 10, false
WHERE NOT EXISTS (SELECT 1 FROM fiscal_settings);
