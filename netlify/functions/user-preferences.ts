/**
 * User Preferences Management
 *
 * Allows employees to manage their own notification preferences
 * including email opt-out functionality
 */

import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

interface UserPreferences {
  employee_id: number;
  email_notifications_enabled: boolean;
  email_leave_balance_alerts: boolean;
  email_leave_approval_updates: boolean;
  email_shift_swap_updates: boolean;
  preferred_language: 'th' | 'en';
  dashboard_refresh_interval: number;
  dashboard_widgets: any[];
  timezone: string;
}

const userPreferencesHandler = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  const userId = event.user?.userId;

  if (!userId) {
    return errorResponse('User not authenticated', 401);
  }

  try {
    // GET - Retrieve user preferences
    if (event.httpMethod === 'GET') {
      let preferences = await query(`
        SELECT
          employee_id,
          email_notifications_enabled,
          email_leave_balance_alerts,
          email_leave_approval_updates,
          email_shift_swap_updates,
          preferred_language,
          dashboard_refresh_interval,
          dashboard_widgets,
          timezone,
          created_at,
          updated_at
        FROM user_preferences
        WHERE employee_id = $1
      `, [userId]);

      // If no preferences exist, create default
      if (preferences.length === 0) {
        await query(`
          INSERT INTO user_preferences (employee_id)
          VALUES ($1)
          ON CONFLICT (employee_id) DO NOTHING
        `, [userId]);

        preferences = await query(`
          SELECT
            employee_id,
            email_notifications_enabled,
            email_leave_balance_alerts,
            email_leave_approval_updates,
            email_shift_swap_updates,
            preferred_language,
            dashboard_refresh_interval,
            dashboard_widgets,
            timezone,
            created_at,
            updated_at
          FROM user_preferences
          WHERE employee_id = $1
        `, [userId]);
      }

      return successResponse({ preferences: preferences[0] });
    }

    // POST/PUT - Update user preferences
    if (event.httpMethod === 'POST' || event.httpMethod === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const prefs: Partial<UserPreferences> = body.preferences;

      if (!prefs) {
        return errorResponse('Preferences object is required', 400);
      }

      // Build update query dynamically
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (prefs.email_notifications_enabled !== undefined) {
        updates.push(`email_notifications_enabled = $${paramIndex++}`);
        values.push(prefs.email_notifications_enabled);
      }

      if (prefs.email_leave_balance_alerts !== undefined) {
        updates.push(`email_leave_balance_alerts = $${paramIndex++}`);
        values.push(prefs.email_leave_balance_alerts);
      }

      if (prefs.email_leave_approval_updates !== undefined) {
        updates.push(`email_leave_approval_updates = $${paramIndex++}`);
        values.push(prefs.email_leave_approval_updates);
      }

      if (prefs.email_shift_swap_updates !== undefined) {
        updates.push(`email_shift_swap_updates = $${paramIndex++}`);
        values.push(prefs.email_shift_swap_updates);
      }

      if (prefs.preferred_language) {
        updates.push(`preferred_language = $${paramIndex++}`);
        values.push(prefs.preferred_language);
      }

      if (prefs.dashboard_refresh_interval !== undefined) {
        updates.push(`dashboard_refresh_interval = $${paramIndex++}`);
        values.push(prefs.dashboard_refresh_interval);
      }

      if (prefs.dashboard_widgets) {
        updates.push(`dashboard_widgets = $${paramIndex++}`);
        values.push(JSON.stringify(prefs.dashboard_widgets));
      }

      if (prefs.timezone) {
        updates.push(`timezone = $${paramIndex++}`);
        values.push(prefs.timezone);
      }

      if (updates.length === 0) {
        return errorResponse('No preferences to update', 400);
      }

      // Add employee_id and updated_at
      updates.push(`updated_at = NOW()`);
      values.push(userId);

      // Upsert preferences
      await query(`
        INSERT INTO user_preferences (employee_id, ${updates.map((u, i) => u.split(' = ')[0]).join(', ')})
        VALUES ($${values.length}, ${values.slice(0, -1).map((_, i) => `$${i + 1}`).join(', ')})
        ON CONFLICT (employee_id)
        DO UPDATE SET ${updates.join(', ')}
      `, values);

      // Fetch updated preferences
      const updated = await query(`
        SELECT
          employee_id,
          email_notifications_enabled,
          email_leave_balance_alerts,
          email_leave_approval_updates,
          email_shift_swap_updates,
          preferred_language,
          dashboard_refresh_interval,
          dashboard_widgets,
          timezone,
          updated_at
        FROM user_preferences
        WHERE employee_id = $1
      `, [userId]);

      return successResponse({
        message: 'Preferences updated successfully',
        preferences: updated[0]
      });
    }

    return errorResponse('Method not allowed', 405);

  } catch (error: any) {
    console.error('User preferences error:', error);
    return errorResponse(error.message || 'Failed to manage user preferences', 500);
  }
};

export const handler: Handler = requireAuth(userPreferencesHandler);
