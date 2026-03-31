-- =====================================================
-- Check for Employee Deletions in Audit Logs
-- =====================================================
-- This script helps you find any employee deletions recorded in the audit logs

-- 1. Check all DELETE actions on employee resource
SELECT 
    al.created_at,
    al.action,
    al.resource_type,
    al.resource_id,
    e.employee_code,
    e.email as user_email,
    CONCAT(e.first_name_en, ' ', e.last_name_en) as performed_by,
    al.before_value::json->>'first_name_en' as deleted_employee_first_name,
    al.before_value::json->>'last_name_en' as deleted_employee_last_name,
    al.before_value::json->>'email' as deleted_employee_email,
    al.before_value::json->>'employee_code' as deleted_employee_code,
    al.ip_address,
    al.metadata
FROM audit_logs al
LEFT JOIN employees e ON al.user_id = e.id
WHERE al.action = 'DELETE' 
  AND al.resource_type = 'employee'
ORDER BY al.created_at DESC;

-- 2. Check for employee status changes to 'inactive' or 'resigned' (soft delete)
SELECT 
    al.created_at,
    al.action,
    al.resource_type,
    al.resource_id,
    e.employee_code,
    e.email as user_email,
    CONCAT(e.first_name_en, ' ', e.last_name_en) as performed_by,
    al.before_value::json->>'employment_status' as old_status,
    al.after_value::json->>'employment_status' as new_status,
    al.after_value::json->>'first_name_en' as employee_first_name,
    al.after_value::json->>'last_name_en' as employee_last_name,
    al.after_value::json->>'email' as employee_email,
    al.after_value::json->>'employee_code' as employee_code_changed,
    al.ip_address,
    al.metadata
FROM audit_logs al
LEFT JOIN employees e ON al.user_id = e.id
WHERE al.action = 'UPDATE' 
  AND al.resource_type = 'employee'
  AND (
    al.after_value::json->>'employment_status' = 'inactive'
    OR al.after_value::json->>'employment_status' = 'resigned'
  )
ORDER BY al.created_at DESC;

-- 3. Get summary count of different types of employee removals
SELECT 
    CASE 
        WHEN action = 'DELETE' THEN 'Hard Delete'
        WHEN after_value::json->>'employment_status' = 'resigned' THEN 'Resigned'
        WHEN after_value::json->>'employment_status' = 'inactive' THEN 'Inactive'
        ELSE 'Other'
    END as removal_type,
    COUNT(*) as count,
    MIN(created_at) as first_occurrence,
    MAX(created_at) as last_occurrence
FROM audit_logs
WHERE (action = 'DELETE' AND resource_type = 'employee')
   OR (action = 'UPDATE' AND resource_type = 'employee' 
       AND (after_value::json->>'employment_status' IN ('inactive', 'resigned')))
GROUP BY removal_type
ORDER BY last_occurrence DESC;

-- 4. Check for specific employee by email or employee code
-- Replace 'EMAIL_OR_CODE_HERE' with the actual email or employee code
/*
SELECT 
    al.created_at,
    al.action,
    al.resource_type,
    e.employee_code as performed_by_code,
    CONCAT(e.first_name_en, ' ', e.last_name_en) as performed_by,
    al.before_value,
    al.after_value,
    al.ip_address,
    al.metadata
FROM audit_logs al
LEFT JOIN employees e ON al.user_id = e.id
WHERE al.resource_type = 'employee'
  AND (
    al.before_value::json->>'email' = 'EMAIL_OR_CODE_HERE'
    OR al.before_value::json->>'employee_code' = 'EMAIL_OR_CODE_HERE'
    OR al.after_value::json->>'email' = 'EMAIL_OR_CODE_HERE'
    OR al.after_value::json->>'employee_code' = 'EMAIL_OR_CODE_HERE'
  )
ORDER BY al.created_at DESC;
*/
