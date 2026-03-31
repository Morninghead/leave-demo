import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { logger } from './utils/logger';

/**
 * Update User Profile
 * Allows users to update their own profile information
 *
 * Editable fields:
 * - phone
 * - email
 * - birth_date
 * - address_th
 * - emergency_contact_name
 * - emergency_contact_phone
 *
 * Read-only fields (cannot be edited by user):
 * - employee_code, scan_code, national_id
 * - first_name_*, last_name_*
 * - department_id, position_*
 * - role, status
 * - hire_date
 */
const updateProfile = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'PUT') {
    return errorResponse('Method not allowed', 405);
  }

  const userId = event.user?.userId;
  if (!userId) {
    return errorResponse('Unauthorized', 401);
  }

  try {
    const {
      phone,
      email,
      birth_date,
      address_th,
      emergency_contact_name,
      emergency_contact_phone
    } = JSON.parse(event.body || '{}');

    // Note: Database column is 'phone_number', but frontend sends 'phone'
    // We'll map it appropriately in the query

    // Validate email format if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return errorResponse('Invalid email format', 400);
    }

    // Validate phone format if provided (basic validation)
    if (phone && !/^[0-9\-\+\(\)\s]{9,20}$/.test(phone)) {
      return errorResponse('Invalid phone number format', 400);
    }

    // Validate emergency phone format if provided
    if (emergency_contact_phone && !/^[0-9\-\+\(\)\s]{9,20}$/.test(emergency_contact_phone)) {
      return errorResponse('Invalid emergency phone number format', 400);
    }

    // Validate birth date if provided (basic check)
    if (birth_date) {
      const date = new Date(birth_date);
      if (isNaN(date.getTime())) {
        return errorResponse('Invalid birth date format', 400);
      }

      // Check if birth date is not in the future
      if (date > new Date()) {
        return errorResponse('Birth date cannot be in the future', 400);
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (phone !== undefined) {
      updates.push(`phone_number = $${paramIndex++}`);
      values.push(phone || null);
    }

    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email || null);
    }

    if (birth_date !== undefined) {
      updates.push(`birth_date = $${paramIndex++}`);
      // Convert ISO date string to yyyy-MM-dd format if provided
      let formattedDate = null;
      if (birth_date) {
        try {
          // Handle both ISO string (2025-01-01T00:00:00.000Z) and yyyy-MM-dd format
          const dateObj = new Date(birth_date);
          if (!isNaN(dateObj.getTime())) {
            formattedDate = dateObj.toISOString().split('T')[0]; // Get yyyy-MM-dd part
          } else {
            // Try parsing as yyyy-MM-dd directly
            formattedDate = birth_date;
          }
        } catch (e) {
          logger.log('Invalid date format for birth_date:', birth_date);
        }
      }
      values.push(formattedDate);
    }

    if (address_th !== undefined) {
      updates.push(`address_th = $${paramIndex++}`);
      values.push(address_th || null);
    }

    if (emergency_contact_name !== undefined) {
      updates.push(`emergency_contact_name = $${paramIndex++}`);
      values.push(emergency_contact_name || null);
    }

    if (emergency_contact_phone !== undefined) {
      updates.push(`emergency_contact_phone = $${paramIndex++}`);
      values.push(emergency_contact_phone || null);
    }

    if (updates.length === 0) {
      return errorResponse('No fields to update', 400);
    }

    // Add updated_at timestamp
    updates.push(`updated_at = NOW()`);

    // Add user ID for WHERE clause
    values.push(userId);

    const updateQuery = `
      UPDATE employees
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING
        id, employee_code, scan_code, national_id,
        first_name_th, last_name_th, first_name_en, last_name_en,
        email, phone_number as phone, birth_date, address_th,
        emergency_contact_name, emergency_contact_phone,
        department_id, position_th, position_en,
        role, status, hire_date, profile_image_url,
        is_department_admin, is_department_manager
    `;

    logger.log('Updating profile for user:', userId);
    logger.log('Fields being updated:', updates);

    const result = await query(updateQuery, values);

    if (result.length === 0) {
      return errorResponse('User not found', 404);
    }

    logger.log('Profile updated successfully');

    return successResponse({
      message: 'Profile updated successfully',
      user: result[0]
    });

  } catch (error: any) {
    logger.error('Error updating profile:', error);

    // Handle unique constraint violations
    if (error.message?.includes('unique') || error.code === '23505') {
      return errorResponse('Email already exists', 409);
    }

    return errorResponse('Failed to update profile', 500);
  }
};

export const handler: Handler = requireAuth(updateProfile);
