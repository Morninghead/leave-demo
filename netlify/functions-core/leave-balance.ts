import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';

const getLeaveBalances = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;
  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }
  const userId = event.user?.userId;

  try {
    const params = event.queryStringParameters || {};
    const year = params.year ? parseInt(params.year) : new Date().getFullYear();

    console.log(`[leave-balance] Fetching balances for user: ${userId}, year: ${year}`);

    // ✅ Step 1: Load balances (เพิ่ม accumulated_minutes/allow_hour_leave + pending_days)
    const sql = `
      SELECT
        lb.id,
        lb.employee_id,
        lb.leave_type_id,
        lb.year,
        lb.total_days,
        lb.used_days,
        lb.pending_days,
        lb.remaining_days,
        lb.accumulated_minutes,
        lb.created_at,
        lb.updated_at,
        lt.code as leave_type_code,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en,
        lt.allow_hourly_leave
      FROM leave_balances lb
      LEFT JOIN leave_types lt ON lb.leave_type_id = lt.id
      WHERE lb.employee_id = $1
        AND lb.year = $2
      ORDER BY lt.code ASC
    `;

    const result = await query(sql, [userId, year]);
    console.log(`[leave-balance] Found ${result.length} balances in database`);

    // ✅ Step 2: If no balances, create them from existing policies (exclude UNPAID leave)
    if (result.length === 0) {
      console.log('No balances found, creating from existing leave policies...');

      // Create leave balances for this employee from existing leave_policies (include UNPAID as counter)
      await query(`
        INSERT INTO leave_balances (
          employee_id, leave_type_id, year, total_days, used_days, pending_days,
          accumulated_minutes, created_at, updated_at
        )
        SELECT
          $1, p.leave_type_id, p.year,
          CASE
            WHEN lt.code = 'UNPAID' OR lt.code = 'UNPAID' OR
                 LOWER(lt.name_en) LIKE '%unpaid%' OR lt.name_th LIKE '%ไม่รับค่าจ้าง%' THEN 0
            ELSE p.default_days
          END,
          0, 0,
          CASE
            WHEN lt.code = 'UNPAID' OR lt.code = 'UNPAID' OR
                 LOWER(lt.name_en) LIKE '%unpaid%' OR lt.name_th LIKE '%ไม่รับค่าจ้าง%' THEN 0
            ELSE p.default_days * 480
          END,
          NOW(), NOW()
        FROM leave_policies p
        JOIN leave_types lt ON p.leave_type_id = lt.id
        WHERE p.year = $2
          AND p.is_active = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM leave_balances lb
            WHERE lb.employee_id = $1
              AND lb.leave_type_id = p.leave_type_id
              AND lb.year = $2
          )
      `, [userId, year]);

      console.log('Leave balances created from existing policies...');

      // Query the newly created balances
      const newResult = await query(sql, [userId, year]);
      console.log('Created balances:', newResult.length);

      return successResponse({
        leave_balances: newResult.map(processLeaveBalanceRow),
        message: `Created ${newResult.length} leave balances from existing policies`,
      });
    }

    // ✅ Step 3: Process balances with display formatting
    const leave_balances = result.map(processLeaveBalanceRow);

    return successResponse({
      leave_balances,
    });
  } catch (error: any) {
    console.error('=== ERROR ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    return errorResponse(error.message || 'Failed to get leave balance', 500);
  }
};

/**
 * ประมวลผลแต่ละ leave balance และรวม vacation leave ชั่วโมงเป็นวัน/ชม./นาที
 */
function processLeaveBalanceRow(row: any) {
  // ✅ UNLIMITED LEAVE: Special counter display
  // Admin-configurable: If leave policy has default_days >= 999, it's unlimited
  const isUnlimitedLeave = parseFloat(row.total_days || 0) >= 999;

  if (isUnlimitedLeave) {
    const daysTaken = parseFloat((row.used_days || 0).toString());
    const displayTaken = daysTaken % 1 === 0 ? daysTaken.toString() : daysTaken.toFixed(1);

    console.log(`💳 [UNLIMITED] Processing balance: ${daysTaken} days taken (total_days >= 999)`);

    return {
      ...row,
      total_days: displayTaken,
      used_days: displayTaken,
      pending_days: '0',
      available_days: 'Unlimited', // Clear indication that unlimited leave has no balance limit
      remaining_days: displayTaken, // Shows total taken for tracking
      is_unlimited_leave: true, // Add flag for client-side validation
      display_days: displayTaken,
      display_hours: 0,
      display_minutes: 0,
      display_text_th: `${displayTaken} วันที่ลาไป`,
      display_text_en: `${displayTaken} day${daysTaken !== 1 ? 's' : ''} taken`
    };
  }

  // ✅ PROFESSIONAL HRM: Calculate available balance including pending requests
  const totalDays = parseFloat((row.total_days || 0).toString());
  const usedDays = parseFloat((row.used_days || 0).toString());
  const pendingDays = parseFloat((row.pending_days || 0).toString());

  // Available balance = Total - Used - Pending
  const availableDays = totalDays - usedDays - pendingDays;

  // Format pending days for display
  const displayPending = pendingDays % 1 === 0
    ? pendingDays.toString()
    : pendingDays.toFixed(1);

  if (row.allow_hourly_leave) {
    // ✅ FIXED: For hourly leave, use same calculation as regular leave
    // accumulated_minutes = total allocated minutes (NOT additional minutes)
    // Calculate remaining = (accumulated_minutes / 480) - used_days
    // Then format as days + hours

    const MINUTES_PER_DAY = 480; // 8-hour workday
    const MINUTES_PER_HALF_DAY = 240; // 4 hours = 0.5 day
    const MINUTES_INTERVAL = 30; // Round to 30-minute intervals

    // Calculate total allocated days from accumulated_minutes
    const accumulatedDays = parseFloat(((row.accumulated_minutes || 0) / MINUTES_PER_DAY).toFixed(2));

    // Calculate remaining days (subtract BOTH used_days AND pending_days for accurate display)
    const remainingDaysExact = accumulatedDays - usedDays - pendingDays;

    console.log(`[DEBUG] ${row.leave_type_code}: accumulated_minutes=${row.accumulated_minutes} → ${accumulatedDays} days, used=${usedDays} days, pending=${pendingDays} days, remaining=${remainingDaysExact.toFixed(2)} days`);

    // Split into whole days and fractional minutes
    const wholeDays = Math.floor(remainingDaysExact);
    const fractionalDays = remainingDaysExact - wholeDays;
    const fractionalMinutes = Math.round(fractionalDays * MINUTES_PER_DAY);

    // Round minutes to 30-minute intervals
    const roundedMinutes = Math.round(fractionalMinutes / MINUTES_INTERVAL) * MINUTES_INTERVAL;

    // Convert minutes to hours
    const totalHours = roundedMinutes / 60;
    const roundedHours = Math.round(totalHours * 2) / 2; // Round to 0.5

    // Round whole days to 0.5
    const roundedWholeDays = Math.round(wholeDays * 2) / 2;

    const roundedTotalDays = Math.round(accumulatedDays * 2) / 2;
    const roundedUsedDays = Math.round(usedDays * 2) / 2;

    // Format display values
    const displayDays = roundedWholeDays % 1 === 0
      ? roundedWholeDays.toString()
      : roundedWholeDays.toFixed(1);
    const displayHours = roundedHours % 1 === 0
      ? roundedHours.toString()
      : roundedHours.toFixed(1);
    const displayTotal = roundedTotalDays % 1 === 0
      ? roundedTotalDays.toString()
      : roundedTotalDays.toFixed(1);
    const displayUsed = roundedUsedDays % 1 === 0
      ? roundedUsedDays.toString()
      : roundedUsedDays.toFixed(1);

    // ✅ PROFESSIONAL HRM: Format available balance for hourly leave
    const displayAvailable = availableDays % 1 === 0
      ? availableDays.toString()
      : availableDays.toFixed(1);

    console.log(`[HOURLY] ${row.leave_type_code}: Displaying ${displayDays} days + ${displayHours} hours (from ${remainingDaysExact.toFixed(2)} total days)`);

    // สร้างข้อความแสดงผล - แสดง days + hours (ถ้ามี)
    let thText = '';
    let enText = '';

    const displayDaysNum = parseFloat(displayDays);
    const displayHoursNum = parseFloat(displayHours);

    if (displayDaysNum > 0 && displayHoursNum > 0) {
      // มีทั้งวันและชั่วโมง: "1.5 วัน 2.5 ชั่วโมง"
      thText = `${displayDays} วัน ${displayHours} ชั่วโมง`;
      enText = `${displayDays} day${displayDaysNum !== 1 ? 's' : ''} ${displayHours} hour${displayHoursNum !== 1 ? 's' : ''}`;
    } else if (displayDaysNum > 0 && displayHoursNum === 0) {
      // มีแค่วัน: "1.5 วัน"
      thText = `${displayDays} วัน`;
      enText = `${displayDays} day${displayDaysNum !== 1 ? 's' : ''}`;
    } else if (displayDaysNum === 0 && displayHoursNum > 0) {
      // มีแค่ชั่วโมง: "0.5 ชั่วโมง" (ไม่แสดง "0 วัน")
      thText = `${displayHours} ชั่วโมง`;
      enText = `${displayHours} hour${displayHoursNum !== 1 ? 's' : ''}`;
    } else {
      // ไม่มีเลย: สำหรับ hourly leave แสดง "0 ชั่วโมง" แทน "0 วัน"
      thText = `0 ชั่วโมง`;
      enText = `0 hours`;
    }

    // Calculate remaining minutes for Thai time format display
    const remainingMinutes = Math.round(remainingDaysExact * MINUTES_PER_DAY);

    // Calculate used minutes for Thai time format display (include pending)
    const usedMinutes = Math.round((usedDays + pendingDays) * MINUTES_PER_DAY);

    return {
      ...row,
      total_days: displayTotal,
      used_days: displayUsed,
      pending_days: displayPending,
      available_days: displayAvailable,
      remaining_days: displayDays,
      remaining_minutes: remainingMinutes, // ✅ Add for Thai time format display
      used_minutes: usedMinutes, // ✅ Add for Thai time format display (used + pending)
      display_days: displayDays,
      display_hours: displayHours,
      display_minutes: 0,
      display_text_th: thText,
      display_text_en: enText
    };
  } else {
    // ✅ FIXED: Use accumulated_minutes for correct Thailand pro rata calculation
    // Convert accumulated_minutes to days for regular leave types
    const accumulatedDays = parseFloat(((row.accumulated_minutes || 0) / 480.0).toFixed(2));
    // ✅ CRITICAL FIX: Subtract BOTH used_days AND pending_days for accurate remaining balance
    const remainingDays = accumulatedDays - usedDays - pendingDays;

    // ปัดเป็น 0.5 เสมอ (30 นาที = 0.5 วัน)
    const roundedRemaining = Math.round(remainingDays * 2) / 2;
    const roundedTotal = Math.round(accumulatedDays * 2) / 2;
    const roundedUsed = Math.round(usedDays * 2) / 2;

    // แสดงทศนิยม 1 ตำแหน่งเมื่อเป็น .5 (half day), ไม่แสดงทศนิยมเมื่อเป็นเลขเต็ม
    const displayRemaining = roundedRemaining % 1 === 0
      ? roundedRemaining.toString()
      : roundedRemaining.toFixed(1);
    const displayTotal = roundedTotal % 1 === 0
      ? roundedTotal.toString()
      : roundedTotal.toFixed(1);
    const displayUsed = roundedUsed % 1 === 0
      ? roundedUsed.toString()
      : roundedUsed.toFixed(1);

    // ✅ PROFESSIONAL HRM: Format available balance for regular leave
    const displayAvailable = availableDays % 1 === 0
      ? availableDays.toString()
      : availableDays.toFixed(1);

    // leave type ปกติ
    const displayRemainingNum = parseFloat(displayRemaining);

    // ✅ Calculate remaining_minutes for ALL leave types (for Thai time format display)
    const remainingMinutes = Math.round(remainingDays * 480);

    // Calculate used minutes for Thai time format display (include pending)
    const usedMinutes = Math.round((usedDays + pendingDays) * 480);

    return {
      ...row,
      total_days: displayTotal,
      used_days: displayUsed,
      pending_days: displayPending,
      available_days: displayAvailable,
      remaining_days: displayRemaining,
      remaining_minutes: remainingMinutes, // ✅ Add for Thai time format display (ALL leave types)
      used_minutes: usedMinutes, // ✅ Add for Thai time format display (used + pending)
      display_days: displayRemaining,
      display_hours: 0,
      display_minutes: 0,
      display_text_th: `${displayRemaining} วัน`,
      display_text_en: `${displayRemaining} day${displayRemainingNum !== 1 ? 's' : ''}`
    };
  }
}

export const handler: Handler = requireAuth(getLeaveBalances);
