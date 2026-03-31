import { query } from './utils/db.ts';

async function investigateLeaveRequests() {
  try {
    console.log('=== INVESTIGATING LEAVE REQUESTS ===\n');

    // Get both leave requests
    const leaveRequests = await query(`
      SELECT
        lr.*,
        e.employee_code,
        e.first_name_th,
        e.last_name_th,
        e.role,
        lt.name_th as leave_type_name_th,
        lt.name_en as leave_type_name_en,
        lt.auto_approve,
        lt.requires_document,
        lt.max_consecutive_days,
        d.name_th as department_name_th
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN departments d ON e.department_id = d.id
      WHERE lr.request_id IN ($1, $2)
      ORDER BY lr.created_at
    `, ['LV1761122336921', 'LV1761007101911']);

    console.log('LEAVE REQUESTS DATA:');
    leaveRequests.forEach((req, index) => {
      console.log(`\n--- Request ${index + 1}: ${req.request_id} ---`);
      console.log(`Employee: ${req.first_name_th} ${req.last_name_th} (${req.employee_code})`);
      console.log(`Role: ${req.role}`);
      console.log(`Department: ${req.department_name_th || 'N/A'}`);
      console.log(`Leave Type: ${req.leave_type_name_th} (${req.leave_type_name_en})`);
      console.log(`Leave Type Auto-approve: ${req.auto_approve}`);
      console.log(`Leave Type Max Consecutive Days: ${req.max_consecutive_days}`);
      console.log(`Date: ${req.start_date} ${req.start_time} - ${req.end_time}`);
      console.log(`Duration: ${req.total_days} days, ${req.leave_minutes || 0} minutes`);
      console.log(`Status: ${req.status}`);
      console.log(`Current Approval Stage: ${req.current_approval_stage}`);
      console.log(`Created At: ${req.created_at}`);
      console.log(`Reason: ${req.reason}`);
    });

    // Get detailed approval flow data
    console.log('\n=== APPROVAL FLOW DATA ===');
    for (const req of leaveRequests) {
      console.log(`\n--- Approval Flow for ${req.request_id} ---`);
      const approvals = await query(`
        SELECT * FROM leave_approvals
        WHERE leave_request_id = $1
        ORDER BY stage
      `, [req.id]);

      if (approvals.length > 0) {
        approvals.forEach(approval => {
          console.log(`Stage ${approval.stage}: ${approval.status} (Approver: ${approval.approver_id || 'N/A'})`);
        });
      } else {
        console.log('No approval records found');
      }
    }

    // Check employee details and approval permissions
    console.log('\n=== EMPLOYEE DETAILS ===');
    const employee = await query(`
      SELECT
        e.*,
        d.name_th as department_name_th,
        da.is_department_admin,
        da.is_department_manager
      FROM employees e
      LEFT JOIN departments d ON e.department_id = d.id
      LEFT JOIN department_approvers da ON e.id = da.employee_id
      WHERE e.employee_code = '202501001'
    `);

    if (employee.length > 0) {
      const emp = employee[0];
      console.log(`Employee: ${emp.first_name_th} ${emp.last_name_th} (${emp.employee_code})`);
      console.log(`Role: ${emp.role}`);
      console.log(`Department: ${emp.department_name_th || 'N/A'}`);
      console.log(`Department Admin: ${emp.is_department_admin}`);
      console.log(`Department Manager: ${emp.is_department_manager}`);
      console.log(`Active: ${emp.is_active}`);
    }

    // Check department approvers for this department
    if (employee.length > 0 && employee[0].department_id) {
      console.log('\n=== DEPARTMENT APPROVERS ===');
      const deptApprovers = await query(`
        SELECT
          da.*,
          e.employee_code,
          e.first_name_th,
          e.last_name_th,
          e.role
        FROM department_approvers da
        JOIN employees e ON da.employee_id = e.id
        WHERE da.department_id = $1
        ORDER BY da.is_department_admin DESC, da.is_department_manager DESC
      `, [employee[0].department_id]);

      deptApprovers.forEach(approver => {
        console.log(`${approver.first_name_th} ${approver.last_name_th} (${approver.employee_code}) - Role: ${approver.role}, Dept Admin: ${approver.is_department_admin}, Dept Manager: ${approver.is_department_manager}`);
      });
    }

    // Check leave types comparison
    console.log('\n=== LEAVE TYPES COMPARISON ===');
    const leaveTypes = await query(`
      SELECT
        lt.*,
        lpa.min_balance_required,
        lpa.max_days_per_year,
        lpa.auto_approve_threshold_days,
        lpa.auto_approve_threshold_minutes
      FROM leave_types lt
      LEFT JOIN leave_policies lpa ON lt.id = lpa.leave_type_id
      WHERE lt.name_th IN ($1, $2)
    `, ['ลากิจ', 'ลาพักร้อน']);

    leaveTypes.forEach(lt => {
      console.log(`\n--- ${lt.name_th} (${lt.name_en}) ---`);
      console.log(`Auto Approve: ${lt.auto_approve}`);
      console.log(`Requires Document: ${lt.requires_document}`);
      console.log(`Max Consecutive Days: ${lt.max_consecutive_days}`);
      console.log(`Policy - Min Balance Required: ${lt.min_balance_required || 'N/A'}`);
      console.log(`Policy - Max Days Per Year: ${lt.max_days_per_year || 'N/A'}`);
      console.log(`Policy - Auto Approve Threshold Days: ${lt.auto_approve_threshold_days || 'N/A'}`);
      console.log(`Policy - Auto Approve Threshold Minutes: ${lt.auto_approve_threshold_minutes || 'N/A'}`);
    });

  } catch (error) {
    console.error('Error investigating leave requests:', error);
  }
}

investigateLeaveRequests().then(() => {
  console.log('\n=== INVESTIGATION COMPLETE ===');
  process.exit(0);
});