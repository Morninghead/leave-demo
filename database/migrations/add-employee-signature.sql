-- Migration: Add issuer signature support to employees table
-- Run this in Neon Console

-- Add signature_image column to store PNG/base64/URL of employee signature
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS signature_image TEXT;

-- Add metadata for signature
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS signature_uploaded_at TIMESTAMPTZ;

-- Comment for documentation
COMMENT ON COLUMN employees.signature_image IS 'URL or base64 of employee signature for official documents';
COMMENT ON COLUMN employees.signature_uploaded_at IS 'Timestamp when signature was uploaded/updated';

-- Verify columns added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND column_name IN ('signature_image', 'signature_uploaded_at');
