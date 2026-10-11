USE employee_api;

-- เคลียร์ข้อมูลเก่า (ป้องกันข้อมูลซ้ำซ้อนตอนรันไฟล์ซ้ำ)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE leave_requests;
TRUNCATE TABLE attendance;
TRUNCATE TABLE employees;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- เพิ่มข้อมูลพนักงานตัวอย่าง (Table: employees)
INSERT INTO employees (id, employeeCode, name, department) VALUES
(1, 'EMP001', 'สมชาย ใจดี', 'IT'),
(2, 'EMP002', 'สมหญิง รักสงบ', 'HR'),
(3, 'EMP003', 'อนันต์ ขยันยิ่ง', 'IT'),
(4, 'EMP004', 'กนกวรรณ มีสุข', 'Marketing');

-- เพิ่มข้อมูลประวัติการเข้า-ออกงานตัวอย่าง (Table: attendance)
INSERT INTO attendance (employee_id, work_date, check_in, check_out, status) VALUES
(1, '2026-08-17', '08:15:00', '17:30:00', 'ON_TIME'), 
(2, '2026-08-17', '08:45:00', '17:35:00', 'LATE'),    
(3, '2026-08-17', '08:20:00', '17:00:00', 'ABSENT'),
(1, '2026-08-18', '08:25:00', NULL,        'ON_TIME'); 

-- เพิ่มข้อมูลคำขอลาตัวอย่าง (Table: leave_requests)
INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status) VALUES
(4, 'SICK', '2026-08-18', '2026-08-18', 'เป็นไข้หวัด มีไข้สูง', 'APPROVED'),
(2, 'VACATION', '2026-08-25', '2026-08-27', 'พักร้อนต่างจังหวัด', 'PENDING'),
(1, 'PERSONAL', '2026-08-29', '2026-08-30', 'นอนเล่นที่ห้อง', 'REJECTED');

-- เพิ่มข้อมูลสมาชิก (Table: user)
INSERT INTO users (email, password_hash, role) VALUES
  ('admin@example.com', '$2b$10$CmWvWJ9SJV0whc3lMfy4l.zlvWAoyow3mD2F93nyBZdZyiGnUwYha', 'admin'),
  ('employee@example.com', '$2b$10$DCs7O2/FiQkay5LUUxg9CuqrdmlzjDpJ2JEpzcp0QRS2wHiwFR4HW', 'employee');