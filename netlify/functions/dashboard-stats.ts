import { Handler } from '@netlify/functions';
import { query } from './utils/db';
import { requireAuth, AuthenticatedEvent } from './utils/auth-middleware';
import { successResponse, errorResponse, handleCORS } from './utils/response';
import { getFiscalYear, getFiscalYearDateRange, getFiscalSettings } from './utils/fiscal-year';

const getDashboardStats = async (event: AuthenticatedEvent) => {
  const corsResponse = handleCORS(event);
  if (corsResponse) return corsResponse;

  if (event.httpMethod !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  const userId = event.user?.userId;
  const userRole = event.user?.role;

  try {
    // 🔧 ใช้ Fiscal Year แทน Calendar Year (Dynamic)
    const settings = await getFiscalSettings();
    const currentFiscalYear = getFiscalYear(new Date(), settings);
    const { start: fiscalStart, end: fiscalEnd } = getFiscalYearDateRange(currentFiscalYear, settings);

    console.log(`📅 Dashboard Stats using Fiscal Year ${currentFiscalYear}: ${fiscalStart} to ${fiscalEnd}`);

    // ===== 1. สถิติคำขอลา (Leave Requests) =====
    // 🔧 FIX: pending_leaves นับทั้งหมดที่ยังรออนุมัติ (ไม่จำกัดปี)
    // ส่วน approved/rejected/total นับตาม Fiscal Year
    const leaveStatsSql = `
      SELECT 
        (SELECT COUNT(*) FROM leave_requests WHERE employee_id = $1 AND status = 'pending') as pending_leaves,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_leaves,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_leaves,
        COUNT(*) FILTER (WHERE status = 'canceled') as canceled_leaves,
        COUNT(*) as total_leaves
      FROM leave_requests
      WHERE employee_id = $1 
        AND created_at >= $2 AND created_at <= $3
    `;
    const leaveStats = await query(leaveStatsSql, [userId, fiscalStart, fiscalEnd]);

    // ===== 2. Portfolio demo removes shift swap from dashboard scope =====
    const shiftStats = [{
      pending_shifts: '0',
      approved_shifts: '0',
      rejected_shifts: '0',
      total_shifts: '0',
    }];

    // ===== 3. ยอดวันลาคงเหลือ (Leave Balances) =====
    // ✅ ใช้ accumulated_minutes จาก database เพื่อความถูกต้อง
    // คำนวณ remaining_days จาก accumulated_minutes ที่ถูกต้องตามการคำนวณ Thailand pro rata
    const leaveBalanceSql = `
      SELECT
        lt.id as leave_type_id,
        lt.code as leave_type_code,
        lt.name_th,
        lt.name_en,
        lt.color,
        COALESCE(lb.total_days, 0) as total_days,
        COALESCE(lb.used_days, 0) as used_days,
        COALESCE(ROUND(lb.accumulated_minutes / 480.0, 2), 0) as accumulated_days,
        COALESCE(lb.accumulated_minutes, 0) as accumulated_minutes
      FROM leave_types lt
      LEFT JOIN leave_balances lb
        ON lb.leave_type_id = lt.id
        AND lb.employee_id = $1
        AND lb.year = $2
      WHERE lt.is_active = true
      ORDER BY lt.code ASC
    `;
    const leaveBalances = await query(leaveBalanceSql, [userId, currentFiscalYear]);

    // ===== 4. คำขอที่รออนุมัติ (For Manager/HR/Admin) =====
    let pendingApprovals = {
      leave_requests: 0,
      total: 0,
    };

    if (['manager', 'hr', 'admin'].includes(userRole || '')) {
      // คำขอลารออนุมัติ
      const pendingLeavesSql = `
        SELECT COUNT(*) as count
        FROM leave_requests lr
        LEFT JOIN employees e ON lr.employee_id = e.id
        WHERE lr.status = 'pending'
          ${userRole === 'manager'
          ? 'AND e.department_id = (SELECT department_id FROM employees WHERE id = $1)'
          : ''
        }
      `;
      const pendingLeavesResult = await query(
        pendingLeavesSql,
        userRole === 'manager' ? [userId] : []
      );

      pendingApprovals = {
        leave_requests: parseInt(pendingLeavesResult[0]?.count || '0'),
        total: parseInt(pendingLeavesResult[0]?.count || '0'),
      };
    }

    // ===== 5. คำขอลาล่าสุด (Recent Leaves) =====
    const recentLeavesSql = `
      SELECT 
        lr.id,
        lr.request_number,
        lr.start_date,
        lr.end_date,
        lr.total_days,
        lr.status,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en,
        lt.color as leave_type_color,
        lr.created_at
      FROM leave_requests lr
      INNER JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.employee_id = $1
      ORDER BY lr.created_at DESC
      LIMIT 5
    `;
    const recentLeaves = await query(recentLeavesSql, [userId]);

    // ===== 6. คำขอสลับวันล่าสุด (Recent Shift Swaps) =====
    const recentShifts: any[] = [];

    // ===== 7. สถิติรวม (Combined Stats) =====
    const combinedStats = {
      total_requests: parseInt(leaveStats[0]?.total_leaves || '0') +
        parseInt(shiftStats[0]?.total_shifts || '0'),
      pending_total: parseInt(leaveStats[0]?.pending_leaves || '0') +
        parseInt(shiftStats[0]?.pending_shifts || '0'),
      approved_total: parseInt(leaveStats[0]?.approved_leaves || '0') +
        parseInt(shiftStats[0]?.approved_shifts || '0'),
      rejected_total: parseInt(leaveStats[0]?.rejected_leaves || '0') +
        parseInt(shiftStats[0]?.rejected_shifts || '0'),
    };

    // ===== Response =====
    return successResponse({
      // สถิติคำขอลา
      leave_stats: {
        total: parseInt(leaveStats[0]?.total_leaves || '0'),
        pending: parseInt(leaveStats[0]?.pending_leaves || '0'),
        approved: parseInt(leaveStats[0]?.approved_leaves || '0'),
        rejected: parseInt(leaveStats[0]?.rejected_leaves || '0'),
        canceled: parseInt(leaveStats[0]?.canceled_leaves || '0'),
      },

      // สถิติการสลับวัน
      shift_stats: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      },

      // สถิติรวม
      combined_stats: combinedStats,

      // ยอดวันลาคงเหลือ
      leave_balances: leaveBalances.map((lb: any) => {
        const accumulatedDays = parseFloat((lb.accumulated_days || '0').toString());
        const usedDays = parseFloat((lb.used_days || '0').toString());
        const remainingDays = accumulatedDays - usedDays;

        // แก้ไขปัญหา floating point precision - ปัดเป็นทศนิยม 2 ตำแหน่ง
        const fixedAccumulatedDays = parseFloat(accumulatedDays.toFixed(2));
        const fixedUsedDays = parseFloat(usedDays.toFixed(2));
        const fixedRemainingDays = parseFloat(remainingDays.toFixed(2));

        return {
          leave_type_id: lb.leave_type_id,
          leave_type_code: lb.leave_type_code,
          name_th: lb.name_th,
          name_en: lb.name_en,
          color: lb.color,
          total_days: fixedAccumulatedDays, // Use accumulated_days as total available
          used_days: fixedUsedDays,
          remaining_days: fixedRemainingDays,
        };
      }),

      // คำขอรออนุมัติ (สำหรับ manager/hr/admin)
      pending_approvals: pendingApprovals,

      // คำขอล่าสุด
      recent_leaves: recentLeaves,
      recent_shifts: recentShifts,

      // Metadata
      year: currentFiscalYear,
      user_role: userRole,
    });

  } catch (error: any) {
    console.error('❌ Get dashboard stats error:', error);
    return errorResponse(error.message || 'Failed to get dashboard stats', 500);
  }
};

export const handler: Handler = requireAuth(getDashboardStats);
