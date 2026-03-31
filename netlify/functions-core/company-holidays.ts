import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, requireHR, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { HOLIDAY_STANDARD_FIELDS, holidayYearFilter } from './utils/date-helpers';

interface HolidayRequest {
  holiday_date: string;
  name_th: string;
  name_en: string;
  holiday_type?: 'company' | 'public' | 'religious';
  departments?: string[];
  notify_days_before?: number;
  notification_message?: string;
  location?: string;
  notes?: string;
}

// GET: ดึงรายการวันหยุดประจำปี
const getCompanyHolidays = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const { year } = event.queryStringParameters || {};

    // Default to current year if not specified
    const selectedYear = year || new Date().getFullYear().toString();

    // Check if table exists first
    const tableExists = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'company_holidays'
      )`
    );

    if (!tableExists[0]?.exists) {
      console.log('company_holidays table does not exist yet, returning empty array');
      return successResponse({ holidays: [] });
    }

    const holidays = await query(
      `SELECT
        id,
        TO_CHAR(holiday_date AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') as holiday_date,
        name_th,
        name_en,
        holiday_type,
        is_active,
        created_at,
        updated_at
      FROM company_holidays
      WHERE EXTRACT(YEAR FROM holiday_date AT TIME ZONE 'Asia/Bangkok') = $1
        AND is_active = true
      ORDER BY holiday_date ASC`,
      [selectedYear]
    );

    return successResponse({ holidays });
  } catch (error: any) {
    console.error('Get company holidays error:', error);
    // If it's a table doesn't exist error, return empty array instead of error
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      console.log('Table does not exist, returning empty holidays array');
      return successResponse({ holidays: [] });
    }
    return errorResponse(error.message || 'Failed to get company holidays', 500);
  }
};

// POST: เพิ่มวันหยุดประจำปี
const addCompanyHoliday = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;
    if (!userId) {
      return errorResponse('User not authenticated', 401);
    }

    const body: HolidayRequest = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.holiday_date || !body.name_th || !body.name_en) {
      return errorResponse('Missing required fields: holiday_date, name_th, name_en', 400);
    }

    // Validate date format
    const holidayDate = new Date(body.holiday_date);
    if (isNaN(holidayDate.getTime())) {
      return errorResponse('Invalid holiday_date format. Use YYYY-MM-DD', 400);
    }

    // Check for duplicate holidays
    const existingHoliday = await query(
      `SELECT id FROM company_holidays
       WHERE holiday_date = $1
         AND is_active = true`,
      [body.holiday_date]
    );

    if (existingHoliday.length > 0) {
      return errorResponse('Holiday already exists for this date', 400);
    }

    // Insert holiday
    const result = await query(
      `INSERT INTO company_holidays (
        holiday_date, name_th, name_en,
        holiday_type, is_active
      ) VALUES ($1, $2, $3, $4, true)
      RETURNING *`,
      [
        body.holiday_date,
        body.name_th,
        body.name_en,
        body.holiday_type || 'company'
      ]
    );

    return successResponse({
      message: 'Company holiday added successfully',
      holiday: result[0]
    });
  } catch (error: any) {
    console.error('Add company holiday error:', error);
    return errorResponse(error.message || 'Failed to add company holiday', 500);
  }
};

// PUT: อัปเดตวันหยุดประจำปี
const updateCompanyHoliday = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'PUT') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;
    if (!userId) {
      return errorResponse('User not authenticated', 401);
    }

    const holidayId = event.path.split('/').pop();
    if (!holidayId || holidayId === 'company-holidays') {
      return errorResponse('Holiday ID is required', 400);
    }

    const body: HolidayRequest = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!body.holiday_date || !body.name_th || !body.name_en) {
      return errorResponse('Missing required fields: holiday_date, name_th, name_en', 400);
    }

    // Check if holiday exists
    const existingHoliday = await query(
      `SELECT id FROM company_holidays
       WHERE holiday_date = $1
         AND is_active = true
         AND id != $2`,
      [body.holiday_date, holidayId]
    );

    if (existingHoliday.length > 0) {
      return errorResponse('Holiday already exists for this date', 400);
    }

    // Update holiday
    const result = await query(
      `UPDATE company_holidays
       SET holiday_date = $1, name_th = $2, name_en = $3,
           holiday_type = $4, is_active = true, updated_at = NOW()
       WHERE id = $5
      RETURNING *`,
      [
        body.holiday_date,
        body.name_th,
        body.name_en,
        body.holiday_type || 'company',
        holidayId
      ]
    );

    return successResponse({
      message: 'Company holiday updated successfully',
      holiday: result[0]
    });
  } catch (error: any) {
    console.error('Update company holiday error:', error);
    return errorResponse(error.message || 'Failed to update company holiday', 500);
  }
};

// DELETE: ลบวันหยุดประจำปี
const deleteCompanyHoliday = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'DELETE') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const userId = event.user?.userId;
    if (!userId) {
      return errorResponse('User not authenticated', 401);
    }

    const holidayId = event.path.split('/').pop();
    if (!holidayId || holidayId === 'company-holidays') {
      return errorResponse('Holiday ID is required', 400);
    }

    // Check if holiday exists
    const existingHoliday = await query(
      `SELECT id FROM company_holidays WHERE id = $1`,
      [holidayId]
    );

    if (existingHoliday.length === 0) {
      return errorResponse('Holiday not found', 404);
    }

    // Delete holiday
    await query(
      `DELETE FROM company_holidays WHERE id = $1`,
      [holidayId]
    );

    return successResponse({
      message: 'Company holiday deleted successfully'
    });
  } catch (error: any) {
    console.error('Delete company holiday error:', error);
    return errorResponse(error.message || 'Failed to delete company holiday', 500);
  }
};

// Router function to handle all holiday operations
const router = async (event: AuthenticatedEvent) => {
  const path = event.path;
  const method = event.httpMethod;

  console.log('🗓️ Company holidays router:', { path, method });

  // Normalize path - handle both /company-holidays and /.netlify/functions/company-holidays
  const isBaseEndpoint = path.includes('company-holidays') && !path.match(/company-holidays\/[\w-]+$/);
  const isHolidayIdEndpoint = path.match(/company-holidays\/([\w-]+)$/);

  // Route to appropriate handler based on path and method
  if (isBaseEndpoint && method === 'GET') {
    return await getCompanyHolidays(event);
  } else if (isBaseEndpoint && method === 'POST') {
    // Require HR or admin role for adding holidays
    if (!event.user || !['hr', 'admin'].includes(event.user.role)) {
      return errorResponse('Insufficient permissions', 403);
    }
    return await addCompanyHoliday(event);
  } else if (isHolidayIdEndpoint && method === 'PUT') {
    // Require HR or admin role for updating holidays
    if (!event.user || !['hr', 'admin'].includes(event.user.role)) {
      return errorResponse('Insufficient permissions', 403);
    }
    return await updateCompanyHoliday(event);
  } else if (isHolidayIdEndpoint && method === 'DELETE') {
    // Require HR or admin role for deleting holidays
    if (!event.user || !['hr', 'admin'].includes(event.user.role)) {
      return errorResponse('Insufficient permissions', 403);
    }
    return await deleteCompanyHoliday(event);
  } else {
    return errorResponse('Endpoint not found', 404);
  }
};

// Export handlers with appropriate authentication
export const handler: Handler = requireAuth(router);