# Software Requirement Specification (SRS)

## 1. ข้อมูลทั่วไปของระบบ (System Overview)

### 1.1 ชื่อระบบ

**Employee Management and Attendance Tracking API System** (ระบบจัดการข้อมูลพนักงานและการบันทึกเวลาทำงาน)

### 1.2 วัตถุประสงค์ (Objectives)

- จัดการข้อมูลพื้นฐานของพนักงานในองค์กรแบบรวมศูนย์ (เพิ่ม, ค้นหา, แก้ไข, ลบ)
- บันทึกและตรวจสอบประวัติการลงเวลาเข้า-ออกงาน (Attendance) ของพนักงานแต่ละบุคคลได้อย่างแม่นยำ
- จัดการระบบคำขอลา (Leave Requests) ครอบคลุมการยื่นคำขอ ตรวจสอบประวัติ และการอนุมัติ/ปฏิเสธคำขอ
- ให้บริการในรูปแบบ RESTful API ที่มีความปลอดภัย มีการจัดการข้อผิดพลาด (Error Handling)

---

## 2. รายการ Use Case หลัก (Core Use Cases)

| รหัส      | Use Case                                                     | ผู้ใช้งานหลัก      | คำอธิบาย                                                                                                                                   | Endpoint ที่เกี่ยวข้อง                                                                         |
| --------- | ------------------------------------------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **UC-01** | จัดการข้อมูลพนักงาน (Manage Employee Profiles)               | HR / Admin         | เพิ่มพนักงานใหม่, ดึงรายชื่อพนักงานทั้งหมด, ดูข้อมูลรายบุคคล, แก้ไขข้อมูล และลบข้อมูลพนักงานออกจากระบบ                                     | `GET/POST /api/v1/employees`<br>`GET/PUT/DELETE /api/v1/employees/:id`                         |
| **UC-02** | บันทึกเวลาเข้า-ออกงาน (Record Employee Attendance)           | พนักงาน / ระบบสแกน | บันทึกเวลาเข้างาน (Check-in) และเวลาออกงาน (Check-out) ประจำวัน พร้อมระบุสถานะ (ON_TIME, LATE, ABSENT) โดยป้องกันการบันทึกซ้ำในวันเดียวกัน | `POST /api/v1/employees/:id/attendance`                                                        |
| **UC-03** | ตรวจสอบและแก้ไขประวัติการเข้างาน (Track & Update Attendance) | HR / พนักงาน       | เรียกดูประวัติการเข้างานรายบุคคลตามช่วงเวลา (startDate - endDate) และอนุญาตให้ Admin/HR แก้ไขข้อมูลเวลาหรือสถานะย้อนหลังได้                | `GET /api/v1/employees/:id/attendance`<br>`PATCH /api/v1/employees/:emp_id/attendance/:att_id` |
| **UC-04** | ยื่นและตรวจสอบคำขอลา (Submit & View Leave Requests)          | พนักงาน            | ยื่นคำขอลาหยุดงาน ระบุประเภทการลา (SICK, PERSONAL, VACATION) พร้อมช่วงวันที่และเหตุผล รวมถึงเรียกดูประวัติการลาของตนเอง                    | `POST /api/v1/employees/:id/leave-requests`<br>`GET /api/v1/employees/:id/leave-requests`      |
| **UC-05** | พิจารณาอนุมัติคำขอลา (Manage Leave Approval)                 | ผู้จัดการ / HR     | ดึงรายการคำขอลาทั้งหมดในองค์กรเพื่อตรวจสอบ และทำการปรับสถานะคำขอเป็นอนุมัติ (`APPROVED`) หรือปฏิเสธ (`REJECTED`)                           | `GET /api/v1/leave-requests`<br>`PATCH /api/v1/leave-requests/:id`                             |

---

## 3. รายการ Resource หลักและความสัมพันธ์ (Resources & Entity Relationships)

### 3.1 รายการ Resource หลัก

#### 1. `Employee` (พนักงาน)

ข้อมูลพื้นฐานของบุคลากรภายในองค์กร

- `id` (PK, Integer): รหัสประจำตัวในฐานข้อมูล
- `employeeCode` (Unique String): รหัสพนักงาน (เช่น `EMP001`)
- `name` (String): ชื่อ-นามสกุล
- `department` (String): แผนก/ฝ่าย
- `created_at` (Timestamp): วันที่และเวลาที่บันทึกข้อมูล

#### 2. `Attendance` (การลงเวลาเข้า-ออกงาน)

ประวัติการลงเวลาทำงานของพนักงานในแต่ละวัน

- `id` (PK, Integer): รหัสรายการลงเวลา
- `employee_id` (FK, Integer): เชื่อมโยงกับ `Employee.id`
- `work_date` (Date): วันที่ทำงาน
- `check_in` (Time): เวลาเข้างาน
- `check_out` (Time): เวลาออกงาน
- `status` (Enum): สถานะการเข้างาน (`ON_TIME`, `LATE`, `ABSENT`)
- `created_at` (Timestamp): วันที่และเวลาที่บันทึกข้อมูล

#### 3. `LeaveRequest` (คำขอลา)

รายการขอลางานของพนักงาน

- `id` (PK, Integer): รหัสคำขอลา
- `employee_id` (FK, Integer): เชื่อมโยงกับ `Employee.id`
- `leave_type` (Enum): ประเภทการลา (`SICK`, `PERSONAL`, `VACATION`)
- `start_date` (Date): วันที่เริ่มต้นลา
- `end_date` (Date): วันที่สิ้นสุดการลา
- `reason` (Text): เหตุผลการลา
- `status` (Enum): สถานะคำขอ (`PENDING`, `APPROVED`, `REJECTED`)
- `created_at` (Timestamp): วันที่และเวลาที่ยื่นคำขอ

---

### 3.2 แผนภาพและความสัมพันธ์ระหว่าง Resource (Entity Relationships)

```text
+-------------------+           1 : N           +----------------------+
|     employees     | ------------------------< |      attendance      |
|-------------------|                           |----------------------|
| id (PK)           |                           | id (PK)              |
| employeeCode (UQ) |                           | employee_id (FK)     |
| name              |                           | work_date            |
| department        |                           | check_in / check_out |
| created_at        |                           | status               |
+-------------------+                           +----------------------+
          |
          | 1 : N
          |
          v
+----------------------+
|    leave_requests    |
|----------------------|
| id (PK)              |
| employee_id (FK)     |
| leave_type           |
| start_date           |
| end_date             |
| status               |
+----------------------+
```
