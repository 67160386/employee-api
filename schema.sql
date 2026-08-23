CREATE DATABASE IF NOT EXISTS employee_api;
USE employee_api;

CREATE TABLE employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employeeCode VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  work_date DATE NOT NULL,              
  check_in TIME DEFAULT NULL,           
  check_out TIME DEFAULT NULL,          
  status ENUM('ON_TIME', 'LATE', 'ABSENT') DEFAULT 'ON_TIME', 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY unique_employee_date (employee_id, work_date) -- ป้องกันการบันทึกซ้ำในวันเดียวกัน
);

CREATE TABLE leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  leave_type ENUM('SICK', 'PERSONAL', 'VACATION') NOT NULL, 
  start_date DATE NOT NULL,                                  
  end_date DATE NOT NULL,                                    
  reason TEXT,                                               
  status ENUM('PENDING', 'APPROVED', 'REJECTED') DEFAULT 'PENDING', 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);