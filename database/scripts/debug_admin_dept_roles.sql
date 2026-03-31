-- Check requestor details
SELECT id, employee_code, first_name_th, last_name_th, department_id 
FROM employees 
WHERE employee_code = '202505001';

-- Check manager details
SELECT id, employee_code, first_name_th, last_name_th, department_id, is_department_manager, is_department_admin
FROM employees 
WHERE employee_code = '201511002';

-- Find who is "ผู้พัฒนา โปรแกรม" and their role in that department
SELECT e.id, e.employee_code, e.first_name_th, e.last_name_th, e.department_id, e.is_department_admin, e.is_department_manager, d.name_th as dept_name
FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE e.first_name_th LIKE '%ผู้พัฒนา%' OR e.last_name_th LIKE '%โปรแกรม%'
   OR (e.department_id = (SELECT department_id FROM employees WHERE employee_code = '202505001') AND e.is_department_admin = true);
