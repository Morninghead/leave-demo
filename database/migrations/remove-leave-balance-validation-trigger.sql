-- ============================================================
-- Migration: Remove Leave Balance Validation Trigger
-- Date: 2025-12-16
-- Purpose: Allow HR to approve leave requests even when the 
--          employee's balance would go to zero or negative.
--          HR/Manager discretion should override balance checks.
-- ============================================================

-- Step 1: Find existing triggers on leave_balances table
-- Run this query first to identify the trigger name:
-- 
-- SELECT 
--     trigger_name,
--     event_manipulation,
--     action_statement
-- FROM information_schema.triggers 
-- WHERE event_object_table IN ('leave_balances', 'leave_requests');

-- Step 2: Drop the balance validation trigger(s)
-- Common trigger names - uncomment the one that matches your database:

DROP TRIGGER IF EXISTS check_leave_balance_trigger ON leave_balances;
DROP TRIGGER IF EXISTS validate_leave_balance_trigger ON leave_balances;
DROP TRIGGER IF EXISTS enforce_leave_balance_trigger ON leave_balances;
DROP TRIGGER IF EXISTS leave_balance_check_trigger ON leave_balances;

-- Also check for triggers on leave_requests table
DROP TRIGGER IF EXISTS check_leave_balance_trigger ON leave_requests;
DROP TRIGGER IF EXISTS validate_leave_balance_trigger ON leave_requests;

-- Step 3: Drop the associated function(s) if they exist
DROP FUNCTION IF EXISTS check_leave_balance() CASCADE;
DROP FUNCTION IF EXISTS validate_leave_balance() CASCADE;
DROP FUNCTION IF EXISTS enforce_leave_balance() CASCADE;

-- ============================================================
-- Alternative: If you want to MODIFY instead of REMOVE the trigger,
-- you can create a new version that only WARNS instead of ERRORS:
-- ============================================================

-- CREATE OR REPLACE FUNCTION check_leave_balance()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     -- Just log a warning but allow the operation to proceed
--     IF NEW.remaining_days < 0 THEN
--         RAISE WARNING 'Leave balance for employee % is negative: % days', 
--             NEW.employee_id, NEW.remaining_days;
--     END IF;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- ============================================================
-- Verification: After running this migration, verify triggers are removed
-- ============================================================

-- SELECT 
--     trigger_name,
--     event_manipulation 
-- FROM information_schema.triggers 
-- WHERE event_object_table = 'leave_balances';
