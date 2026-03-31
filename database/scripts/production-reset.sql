-- =====================================================
-- SSTH Leave Management System
-- Production Reset Script
-- =====================================================
-- ⚠️ WARNING: This script will DELETE all test data!
-- Run ONLY when ready to go to production!
-- Created: 2024-12-24
-- =====================================================

-- =====================================================
-- SECTION 1: TABLES TO CLEAR (Test/Transaction Data)
-- These will be completely emptied
-- =====================================================

-- 1.1 Clear all leave requests (test data)
TRUNCATE TABLE leave_requests CASCADE;
SELECT 'Cleared: leave_requests' as status;

-- 1.2 Clear all leave balances (will be recreated from policies)
TRUNCATE TABLE leave_balances CASCADE;
SELECT 'Cleared: leave_balances' as status;

-- 1.3 Clear shift swap requests (test data)
TRUNCATE TABLE shift_swap_requests CASCADE;
SELECT 'Cleared: shift_swap_requests' as status;

-- 1.4 Clear all notifications (system messages)
TRUNCATE TABLE notifications CASCADE;
SELECT 'Cleared: notifications' as status;

-- 1.5 Clear audit logs (test actions)
TRUNCATE TABLE audit_logs CASCADE;
SELECT 'Cleared: audit_logs' as status;

-- 1.6 Clear warning notices (HR warnings - test data)
TRUNCATE TABLE warning_notices CASCADE;
SELECT 'Cleared: warning_notices' as status;

-- 1.7 Clear warning appeals (test data)
TRUNCATE TABLE warning_appeals CASCADE;
SELECT 'Cleared: warning_appeals' as status;

-- 1.8 Clear multi-department permissions (test assignments)
TRUNCATE TABLE employee_department_permissions CASCADE;
SELECT 'Cleared: employee_department_permissions' as status;

-- 1.9 Clear balance history (transaction log)
-- Note: This table may not exist in your schema
-- TRUNCATE TABLE balance_history CASCADE;
-- SELECT 'Cleared: balance_history' as status;


-- =====================================================
-- SECTION 2: TABLES TO KEEP (Configuration Data)
-- These contain important configuration - DO NOT DELETE
-- =====================================================
-- ✅ employees - Real employee data (KEEP)
-- ✅ departments - Department structure (KEEP)
-- ✅ leave_types - Leave type configuration (KEEP)
-- ✅ leave_policies - Leave policy settings (KEEP)
-- ✅ company_settings - Company configuration (KEEP)
-- ✅ company_holidays - Holiday calendar (KEEP)
-- ✅ approval_flows - Approval workflow config (KEEP)
-- ✅ approval_stages - Approval stages config (KEEP)


-- =====================================================
-- SECTION 3: RESET SEQUENCES (Optional)
-- Reset auto-increment counters if needed
-- =====================================================

-- Reset leave_requests sequence (if using serial/identity)
-- ALTER SEQUENCE leave_requests_id_seq RESTART WITH 1;

-- Reset other sequences as needed...


-- =====================================================
-- SECTION 4: RECREATE LEAVE BALANCES FOR ALL EMPLOYEES
-- This will create fresh balances from current policies
-- =====================================================

-- Get current year
DO $$
DECLARE
    current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
    -- Insert leave balances for all active employees based on policies
    INSERT INTO leave_balances (
        employee_id,
        leave_type_id,
        year,
        total_days,
        used_days,
        pending_days,
        adjustment_days,
        notes,
        created_at,
        updated_at
    )
    SELECT 
        e.id as employee_id,
        lp.leave_type_id,
        current_year as year,
        lp.default_days as total_days,
        0 as used_days,
        0 as pending_days,
        0 as adjustment_days,
        'Created for production - ' || TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') as notes,
        NOW() as created_at,
        NOW() as updated_at
    FROM employees e
    CROSS JOIN leave_policies lp
    WHERE e.status = 'active'
      AND lp.year = current_year
      AND lp.is_active = true
      AND NOT EXISTS (
          SELECT 1 FROM leave_balances lb 
          WHERE lb.employee_id = e.id 
            AND lb.leave_type_id = lp.leave_type_id 
            AND lb.year = current_year
      );
    
    RAISE NOTICE 'Created leave balances for year %', current_year;
END $$;

SELECT 'Leave balances recreated for all active employees' as status;


-- =====================================================
-- SECTION 5: VERIFY CLEAN STATE
-- Run these queries to verify data was cleared
-- =====================================================

SELECT 'Verification Results:' as status;
SELECT 'leave_requests count: ' || COUNT(*) FROM leave_requests;
SELECT 'leave_balances count: ' || COUNT(*) FROM leave_balances;
SELECT 'shift_swap_requests count: ' || COUNT(*) FROM shift_swap_requests;
SELECT 'notifications count: ' || COUNT(*) FROM notifications;
SELECT 'audit_logs count: ' || COUNT(*) FROM audit_logs;

-- Also verify configuration is intact
SELECT 'Configuration Status:' as status;
SELECT 'employees (active): ' || COUNT(*) FROM employees WHERE status = 'active';
SELECT 'departments: ' || COUNT(*) FROM departments WHERE is_active = true;
SELECT 'leave_types: ' || COUNT(*) FROM leave_types WHERE is_active = true;
SELECT 'leave_policies (current year): ' || COUNT(*) 
FROM leave_policies 
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE) AND is_active = true;


-- =====================================================
-- SECTION 6: SUPABASE STORAGE CLEANUP
-- Run this in Supabase Dashboard or via API
-- =====================================================
-- 
-- You need to manually clear the storage bucket:
-- 1. Go to Supabase Dashboard
-- 2. Navigate to Storage > leave-attachments
-- 3. Delete all test files
-- 
-- Or use Supabase API/CLI:
-- supabase storage rm -r leave-attachments/*
--


-- =====================================================
-- PRODUCTION READINESS CHECKLIST
-- =====================================================
-- □ All test leave requests cleared
-- □ All test notifications cleared  
-- □ All audit logs cleared
-- □ Leave balances recreated from policies
-- □ Supabase storage bucket cleared
-- □ Test employees removed (if any)
-- □ Leave policies set correctly for production year
-- □ Company holidays configured
-- □ Approval flows configured
-- □ Email/LINE/Telegram notifications configured
-- □ SSL certificate valid
-- □ Backup strategy in place


SELECT '✅ PRODUCTION RESET COMPLETE!' as status;
SELECT 'Please verify all data and clear Supabase Storage manually.' as note;
