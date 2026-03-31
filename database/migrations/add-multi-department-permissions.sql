-- Migration: Add multi-department approval permissions
-- Description: Allow managers to approve leave requests from multiple departments

-- Create table to store department permissions for employees
CREATE TABLE IF NOT EXISTS employee_department_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    permission_type VARCHAR(50) NOT NULL DEFAULT 'approve', -- 'approve', 'view', 'manage'
    granted_by UUID REFERENCES employees(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique permission per employee-department-type combination
    UNIQUE(employee_id, department_id, permission_type)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_emp_dept_perms_employee ON employee_department_permissions(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_dept_perms_department ON employee_department_permissions(department_id);
CREATE INDEX IF NOT EXISTS idx_emp_dept_perms_active ON employee_department_permissions(is_active);

-- Add comment explaining the table
COMMENT ON TABLE employee_department_permissions IS 'Stores additional department permissions for employees (e.g., manager can approve multiple departments)';
COMMENT ON COLUMN employee_department_permissions.permission_type IS 'Type of permission: approve = can approve leave/shift requests, view = can view department data, manage = full management';
