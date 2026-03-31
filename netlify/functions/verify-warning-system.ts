// netlify/functions/verify-warning-system.ts
import { Handler } from '@netlify/functions';
import { sql } from './utils/db';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { createClient } from '@supabase/supabase-js';

/**
 * Verify and Initialize Warning System
 * GET: Check if warning system tables exist
 * POST: Apply migration (admin only)
 */

const handler: Handler = requireAuth(async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  try {
    if (event.httpMethod === 'GET') {
      // Check if tables exist
      const tables = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN (
          'warning_notices',
          'warning_acknowledgements',
          'warning_appeals',
          'warning_audit_logs',
          'disciplinary_offense_types',
          'warning_witnesses',
          'warning_system_settings'
        )
        ORDER BY table_name
      `;

      const tableNames = tables.map(t => t.table_name);
      const requiredTables = [
        'disciplinary_offense_types',
        'warning_acknowledgements',
        'warning_appeals',
        'warning_audit_logs',
        'warning_notices',
        'warning_system_settings',
        'warning_witnesses'
      ];

      const missingTables = requiredTables.filter(t => !tableNames.includes(t));

      // Check UUID extension
      const uuidExtension = await sql`
        SELECT * FROM pg_extension WHERE extname = 'uuid-ossp'
      `;

      return successResponse({
        tables_exist: tableNames,
        missing_tables: missingTables,
        all_tables_present: missingTables.length === 0,
        uuid_extension_installed: uuidExtension.length > 0,
        ready: missingTables.length === 0 && uuidExtension.length > 0
      });
    }

    if (event.httpMethod === 'POST') {
      const userId = event.user?.userId;
      const employeeCode = event.user?.employeeCode;
      const userRole = event.user?.role;

      // Debug logging
      console.log('🔍 Authorization check:', {
        userId,
        employeeCode,
        userRole,
        isAdmin: userRole === 'admin',
        employeeCodeMatch: employeeCode === '999999999'
      });

      // Only admin or employee code 999999999 can apply migration
      const isAuthorized = userRole === 'admin' || employeeCode === '999999999';

      if (!isAuthorized) {
        console.error('❌ Authorization failed:', {
          userId,
          employeeCode,
          userRole,
          expectedEmployeeCode: '999999999'
        });
        return errorResponse('Access denied. Admin privileges required.', 403);
      }

      console.log('🚀 Applying warning system migration...', {
        userId,
        employeeCode,
        userRole,
        isAdmin: userRole === 'admin',
        isSpecialUser: employeeCode === '999999999'
      });

      // Step 1: Enable UUID extension
      await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
      console.log('✅ UUID extension enabled');

      // Step 2: Create disciplinary_offense_types table
      await sql`
        CREATE TABLE IF NOT EXISTS disciplinary_offense_types (
          id SERIAL PRIMARY KEY,
          code VARCHAR(20) UNIQUE NOT NULL,
          name_th VARCHAR(255) NOT NULL,
          name_en VARCHAR(255) NOT NULL,
          description_th TEXT,
          description_en TEXT,
          severity_level INT CHECK (severity_level BETWEEN 1 AND 5),
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      console.log('✅ Table: disciplinary_offense_types');

      // Step 3: Create warning_notices table
      await sql`
        CREATE TABLE IF NOT EXISTS warning_notices (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          notice_number VARCHAR(50) UNIQUE NOT NULL,
          employee_id UUID NOT NULL REFERENCES employees(id),
          issued_by UUID NOT NULL REFERENCES employees(id),
          warning_type VARCHAR(50) NOT NULL,
          offense_type_id INTEGER REFERENCES disciplinary_offense_types(id),
          incident_date TIMESTAMP NOT NULL,
          incident_description TEXT NOT NULL,
          incident_location VARCHAR(255),
          penalty_description TEXT NOT NULL,
          suspension_days INT DEFAULT 0,
          suspension_start_date DATE,
          suspension_end_date DATE,
          effective_date DATE NOT NULL,
          expiry_date DATE,
          is_active BOOLEAN DEFAULT TRUE,
          auto_inactive_date DATE,
          requires_hr_approval BOOLEAN DEFAULT FALSE,
          hr_approval_status VARCHAR(50),
          hr_reviewed_by UUID REFERENCES employees(id),
          hr_review_notes TEXT,
          hr_reviewed_at TIMESTAMP,
          attachments_urls TEXT[],
          status VARCHAR(50) DEFAULT 'DRAFT',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          voided_at TIMESTAMP,
          voided_by UUID REFERENCES employees(id),
          void_reason TEXT
        )
      `;
      console.log('✅ Table: warning_notices');

      // Step 4: Create warning_witnesses table
      await sql`
        CREATE TABLE IF NOT EXISTS warning_witnesses (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          warning_notice_id UUID NOT NULL REFERENCES warning_notices(id) ON DELETE CASCADE,
          witness_employee_id UUID REFERENCES employees(id),
          witness_name VARCHAR(255),
          witness_position VARCHAR(255),
          statement TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      console.log('✅ Table: warning_witnesses');

      // Step 5: Create warning_acknowledgements table
      await sql`
        CREATE TABLE IF NOT EXISTS warning_acknowledgements (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          warning_notice_id UUID NOT NULL REFERENCES warning_notices(id) ON DELETE CASCADE,
          employee_id UUID NOT NULL REFERENCES employees(id),
          action_type VARCHAR(50) NOT NULL,
          acknowledged_at TIMESTAMP DEFAULT NOW(),
          ip_address VARCHAR(50),
          user_agent TEXT,
          scroll_completed BOOLEAN DEFAULT FALSE,
          scroll_percentage INT DEFAULT 0,
          time_spent_seconds INT,
          signature_data TEXT,
          signature_ip VARCHAR(50),
          signature_timestamp TIMESTAMP,
          signature_refused BOOLEAN DEFAULT FALSE,
          refused_at TIMESTAMP,
          refused_at TIMESTAMP,
          refuse_reason TEXT,
          refuse_ip VARCHAR(50),
          employee_comment TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      console.log('✅ Table: warning_acknowledgements');

      // Step 6: Create warning_appeals table
      await sql`
        CREATE TABLE IF NOT EXISTS warning_appeals (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          warning_notice_id UUID NOT NULL REFERENCES warning_notices(id) ON DELETE CASCADE,
          employee_id UUID NOT NULL REFERENCES employees(id),
          appeal_reason TEXT NOT NULL,
          evidence_urls TEXT[],
          status VARCHAR(50) DEFAULT 'PENDING',
          reviewed_by UUID REFERENCES employees(id),
          review_decision VARCHAR(50),
          review_decision_text TEXT,
          reviewed_at TIMESTAMP,
          submitted_at TIMESTAMP DEFAULT NOW(),
          appeal_deadline DATE NOT NULL
        )
      `;
      console.log('✅ Table: warning_appeals');

      // Step 7: Create warning_audit_logs table
      await sql`
        CREATE TABLE IF NOT EXISTS warning_audit_logs (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          warning_notice_id UUID REFERENCES warning_notices(id) ON DELETE CASCADE,
          action VARCHAR(100) NOT NULL,
          performed_by UUID NOT NULL REFERENCES employees(id),
          ip_address VARCHAR(50),
          user_agent TEXT,
          changes JSONB,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      console.log('✅ Table: warning_audit_logs');

      // Step 8: Create warning_system_settings table
      await sql`
        CREATE TABLE IF NOT EXISTS warning_system_settings (
          id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
          setting_key VARCHAR(100) UNIQUE NOT NULL,
          setting_value TEXT,
          value_type VARCHAR(50),
          description_th TEXT,
          description_en TEXT,
          updated_by UUID REFERENCES employees(id),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      console.log('✅ Table: warning_system_settings');

      // Step 9: Insert default settings
      await sql`
        INSERT INTO warning_system_settings (setting_key, setting_value, value_type, description_th, description_en) VALUES
        ('system_enabled', 'true', 'BOOLEAN', 'เปิด/ปิดระบบใบเตือนอิเล็กทรอนิกส์', 'Enable/Disable Warning Notice System'),
        ('appeal_deadline_days', '15', 'INTEGER', 'จำนวนวันที่พนักงานสามารถยื่นอุทธรณ์ได้', 'Number of days for employee to submit appeal'),
        ('warning_expiry_months', '12', 'INTEGER', 'จำนวนเดือนที่ใบเตือนจะหมดอายุ (active -> inactive)', 'Number of months until warning becomes inactive'),
        ('require_signature', 'true', 'BOOLEAN', 'บังคับให้ลงนามรับทราบ', 'Require employee signature'),
        ('allow_signature_refusal', 'true', 'BOOLEAN', 'อนุญาตให้ปฏิเสธการเซ็นได้', 'Allow employee to refuse signature'),
        ('min_scroll_percentage', '100', 'INTEGER', 'เปอร์เซ็นต์การเลื่อนอ่านขั้นต่ำก่อนยอมรับ', 'Minimum scroll percentage before acknowledgement'),
        ('auto_send_email', 'false', 'BOOLEAN', 'ส่งอีเมลอัตโนมัติเมื่อออกใบเตือน', 'Auto send email notification when warning issued'),
        ('email_provider', 'console', 'STRING', 'ผู้ให้บริการอีเมล (sendgrid/ses/smtp/console)', 'Email provider (sendgrid/ses/smtp/console)')
        ON CONFLICT (setting_key) DO NOTHING
      `;
      console.log('✅ Default settings inserted');

      // Step 10: Insert default offense types
      await sql`
        INSERT INTO disciplinary_offense_types (code, name_th, name_en, description_th, description_en, severity_level) VALUES
        ('LATE', 'มาสาย', 'Late Arrival', 'มาทำงานสายกว่าเวลาที่กำหนด', 'Arriving late to work', 2),
        ('ABSENT', 'ขาดงาน', 'Absence Without Leave', 'ขาดงานโดยไม่ได้รับอนุญาต', 'Absence without permission', 3),
        ('INSUBORDINATION', 'ไม่เชื่อฟังคำสั่ง', 'Insubordination', 'ไม่ปฏิบัติตามคำสั่งของผู้บังคับบัญชา', 'Refusing to follow supervisor instructions', 4),
        ('DRESS_CODE', 'แต่งกายไม่เหมาะสม', 'Dress Code Violation', 'แต่งกายไม่เป็นไปตามระเบียบบริษัท', 'Not following company dress code', 1),
        ('MISCONDUCT', 'ประพฤติมิชอบ', 'Misconduct', 'ประพฤติตนไม่เหมาะสม', 'Inappropriate conduct', 4),
        ('SAFETY', 'ละเมิดความปลอดภัย', 'Safety Violation', 'ไม่ปฏิบัติตามระเบียบความปลอดภัย', 'Violating safety regulations', 5),
        ('PERFORMANCE', 'ผลงานไม่เป็นไปตามมาตรฐาน', 'Poor Performance', 'ผลการปฏิบัติงานต่ำกว่ามาตรฐาน', 'Performance below standards', 3),
        ('HARASSMENT', 'คุกคาม/รบกวน', 'Harassment', 'คุกคามหรือรบกวนเพื่อนร่วมงาน', 'Harassing coworkers', 5),
        ('THEFT', 'ลักทรัพย์', 'Theft', 'ลักขโมยทรัพย์สินของบริษัท', 'Stealing company property', 5),
        ('FRAUD', 'ทุจริต', 'Fraud', 'การกระทำทุจริต', 'Fraudulent activities', 5)
        ON CONFLICT (code) DO NOTHING
      `;
      console.log('✅ Default offense types inserted');

      // Step 11: Create indexes
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_notices_employee ON warning_notices(employee_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_notices_status ON warning_notices(status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_notices_is_active ON warning_notices(is_active)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_notices_issued_by ON warning_notices(issued_by)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_notices_hr_approval ON warning_notices(hr_approval_status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_notices_created_at ON warning_notices(created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_acknowledgements_warning ON warning_acknowledgements(warning_notice_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_acknowledgements_employee ON warning_acknowledgements(employee_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_appeals_warning ON warning_appeals(warning_notice_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_appeals_status ON warning_appeals(status)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_appeals_employee ON warning_appeals(employee_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_audit_logs_warning ON warning_audit_logs(warning_notice_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_warning_audit_logs_created_at ON warning_audit_logs(created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_offense_types_code ON disciplinary_offense_types(code)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_offense_types_active ON disciplinary_offense_types(is_active)`;
      console.log('✅ Indexes created');

      // Step 12: Ensure Storage Bucket exists for Evidence (Images & Videos)
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseServiceKey);
          const { data: buckets } = await supabase.storage.listBuckets();
          const bucketExists = buckets?.find(b => b.name === 'warning-evidence');

          if (!bucketExists) {
            console.log('Creating warning-evidence bucket...');
            const { error: createError } = await supabase.storage.createBucket('warning-evidence', {
              public: true,
              fileSizeLimit: 52428800, // 50MB
              allowedMimeTypes: ['image/*', 'video/*']
            });

            if (createError) {
              console.warn('⚠️ Failed to create storage bucket:', createError.message);
            } else {
              console.log('✅ Storage bucket created: warning-evidence');
            }
          } else {
            console.log('✅ Storage bucket exists: warning-evidence');
          }
        } catch (bucketError) {
          console.error('❌ Error checking/creating bucket:', bucketError);
        }
      } else {
        console.warn('⚠️ Skipping bucket creation: Missing Supabase Env Vars');
      }

      // Step 13: Configure Storage Policies (RLS)
      // Ensure complete policies exist for the warning-evidence bucket
      try {
        await sql`
          DO $$
          BEGIN
              -- Drop old policies first to recreate with correct permissions
              DROP POLICY IF EXISTS "Give public access to warning-evidence" ON storage.objects;
              DROP POLICY IF EXISTS "Give public read access to warning-evidence" ON storage.objects;
              DROP POLICY IF EXISTS "Allow authenticated insert to warning-evidence" ON storage.objects;
              DROP POLICY IF EXISTS "Allow authenticated update to warning-evidence" ON storage.objects;
              DROP POLICY IF EXISTS "Allow authenticated delete to warning-evidence" ON storage.objects;
              DROP POLICY IF EXISTS "Allow public read access to warning-evidence" ON storage.objects;

              -- SELECT Policy: Allow public read access (for viewing attachments)
              CREATE POLICY "Allow public read access to warning-evidence" 
              ON storage.objects FOR SELECT 
              USING (bucket_id = 'warning-evidence');

              -- INSERT Policy: Allow authenticated users to upload
              CREATE POLICY "Allow authenticated insert to warning-evidence" 
              ON storage.objects FOR INSERT 
              TO authenticated
              WITH CHECK (bucket_id = 'warning-evidence');

              -- UPDATE Policy: Allow authenticated users to update their files
              CREATE POLICY "Allow authenticated update to warning-evidence" 
              ON storage.objects FOR UPDATE 
              TO authenticated
              USING (bucket_id = 'warning-evidence');

              -- DELETE Policy: Allow authenticated users to delete their files
              CREATE POLICY "Allow authenticated delete to warning-evidence" 
              ON storage.objects FOR DELETE 
              TO authenticated
              USING (bucket_id = 'warning-evidence');
          END
          $$;
        `;
        console.log('✅ Storage RLS policies configured (SELECT, INSERT, UPDATE, DELETE)');
      } catch (policyError) {
        console.warn('⚠️ Note: Could not apply storage policies (Check permissions or if storage schema is accessible):', policyError);
      }

      // Step 14: Migrate Data (Merge TH/EN fields)
      console.log('🔄 Running schema migration (merging language fields)...');
      await sql`
        DO $$
        BEGIN
          -- warning_notices: incident_description
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='warning_notices' AND column_name='incident_description') THEN
            ALTER TABLE warning_notices ADD COLUMN incident_description TEXT;
            UPDATE warning_notices SET incident_description = CONCAT_WS(E'\n---\n', incident_description_th, incident_description_en);
            -- Determine NOT NULL status later or set default
          END IF;
          ALTER TABLE warning_notices DROP COLUMN IF EXISTS incident_description_th;
          ALTER TABLE warning_notices DROP COLUMN IF EXISTS incident_description_en;

          -- warning_notices: penalty_description
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='warning_notices' AND column_name='penalty_description') THEN
            ALTER TABLE warning_notices ADD COLUMN penalty_description TEXT;
            UPDATE warning_notices SET penalty_description = CONCAT_WS(E'\n---\n', penalty_description_th, penalty_description_en);
          END IF;
          ALTER TABLE warning_notices DROP COLUMN IF EXISTS penalty_description_th;
          ALTER TABLE warning_notices DROP COLUMN IF EXISTS penalty_description_en;

          -- warning_notices: void_reason
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='warning_notices' AND column_name='void_reason') THEN
             ALTER TABLE warning_notices ADD COLUMN void_reason TEXT;
             UPDATE warning_notices SET void_reason = CONCAT_WS(E'\n---\n', void_reason_th, void_reason_en);
          END IF;
          ALTER TABLE warning_notices DROP COLUMN IF EXISTS void_reason_th;
          ALTER TABLE warning_notices DROP COLUMN IF EXISTS void_reason_en;

          -- warning_notices: hr_review_notes
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='warning_notices' AND column_name='hr_review_notes') THEN
             ALTER TABLE warning_notices ADD COLUMN hr_review_notes TEXT;
             UPDATE warning_notices SET hr_review_notes = CONCAT_WS(E'\n---\n', hr_review_notes_th, hr_review_notes_en);
          END IF;
          ALTER TABLE warning_notices DROP COLUMN IF EXISTS hr_review_notes_th;
          ALTER TABLE warning_notices DROP COLUMN IF EXISTS hr_review_notes_en;

          -- warning_witnesses: statement
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='warning_witnesses' AND column_name='statement') THEN
             ALTER TABLE warning_witnesses ADD COLUMN statement TEXT;
             UPDATE warning_witnesses SET statement = CONCAT_WS(E'\n---\n', statement_th, statement_en);
          END IF;
          ALTER TABLE warning_witnesses DROP COLUMN IF EXISTS statement_th;
          ALTER TABLE warning_witnesses DROP COLUMN IF EXISTS statement_en;

          -- warning_acknowledgements: refuse_reason, employee_comment
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='warning_acknowledgements' AND column_name='refuse_reason') THEN
             ALTER TABLE warning_acknowledgements ADD COLUMN refuse_reason TEXT;
             UPDATE warning_acknowledgements SET refuse_reason = CONCAT_WS(E'\n---\n', refuse_reason_th, refuse_reason_en);
          END IF;
          ALTER TABLE warning_acknowledgements DROP COLUMN IF EXISTS refuse_reason_th;
          ALTER TABLE warning_acknowledgements DROP COLUMN IF EXISTS refuse_reason_en;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='warning_acknowledgements' AND column_name='employee_comment') THEN
             ALTER TABLE warning_acknowledgements ADD COLUMN employee_comment TEXT;
             UPDATE warning_acknowledgements SET employee_comment = CONCAT_WS(E'\n---\n', employee_comment_th, employee_comment_en);
          END IF;
          ALTER TABLE warning_acknowledgements DROP COLUMN IF EXISTS employee_comment_th;
          ALTER TABLE warning_acknowledgements DROP COLUMN IF EXISTS employee_comment_en;

          -- warning_appeals: appeal_reason, review_decision_text
           IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='warning_appeals' AND column_name='appeal_reason') THEN
             ALTER TABLE warning_appeals ADD COLUMN appeal_reason TEXT;
             UPDATE warning_appeals SET appeal_reason = CONCAT_WS(E'\n---\n', appeal_reason_th, appeal_reason_en);
          END IF;
          ALTER TABLE warning_appeals DROP COLUMN IF EXISTS appeal_reason_th;
          ALTER TABLE warning_appeals DROP COLUMN IF EXISTS appeal_reason_en;

          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='warning_appeals' AND column_name='review_decision_text') THEN
             ALTER TABLE warning_appeals ADD COLUMN review_decision_text TEXT;
             UPDATE warning_appeals SET review_decision_text = CONCAT_WS(E'\n---\n', review_decision_th, review_decision_en);
          END IF;
          ALTER TABLE warning_appeals DROP COLUMN IF EXISTS review_decision_th;
          ALTER TABLE warning_appeals DROP COLUMN IF EXISTS review_decision_en;
          
          -- warning_audit_logs: notes
           IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='warning_audit_logs' AND column_name='notes') THEN
             ALTER TABLE warning_audit_logs ADD COLUMN notes TEXT;
             UPDATE warning_audit_logs SET notes = CONCAT_WS(E'\n---\n', notes_th, notes_en);
          END IF;
          ALTER TABLE warning_audit_logs DROP COLUMN IF EXISTS notes_th;
          ALTER TABLE warning_audit_logs DROP COLUMN IF EXISTS notes_en;

        END $$;
      `;
      console.log('✅ Schema migration completed (Language fields merged)');

      console.log('🎉 Warning system migration completed successfully!');

      return successResponse({
        success: true,
        message: 'Warning system tables created successfully',
        timestamp: new Date().toISOString()
      });
    }

    return errorResponse('Method not allowed', 405);
  } catch (error: any) {
    console.error('❌ Warning system verification/migration error:', error);
    return errorResponse(error.message || 'Failed to verify/apply migration', 500);
  }
});

export { handler };
