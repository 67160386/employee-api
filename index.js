require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = require("./db");

app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

app.get("/", (req, res) => {
  res.status(200).json({ message: "Employee API พร้อมใช้งาน" });
});

// 1. GET: ดึงรายการพนักงานทั้งหมด
app.get("/api/v1/employees", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM employees");
    res.status(200).json({
      message: "ดึงข้อมูลพนักงานสำเร็จ",
      total: rows.length,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// 2. GET: ดึงข้อมูลพนักงานเฉพาะรายบุคคล
app.get("/api/v1/employees/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM employees WHERE id = ?", [
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลพนักงาน",
        },
      });
    }

    res.status(200).json({
      message: "ดึงข้อมูลพนักงานสำเร็จ",
      data: rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// 3. GET: ดึงประวัติการเข้างานของพนักงานเฉพาะรายบุคคล
app.get("/api/v1/employees/:id/attendance", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const [employee] = await pool.query(
      "SELECT id, name, department FROM employees WHERE id = ?",
      [id],
    );

    if (employee.length === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลพนักงาน" } });
    }

    let sql = "SELECT * FROM attendance WHERE employee_id = ?";
    const params = [id];

    if (startDate && endDate) {
      sql += " AND work_date BETWEEN ? AND ?";
      params.push(startDate, endDate);
    } else if (startDate) {
      sql += " AND work_date >= ?";
      params.push(startDate);
    } else if (endDate) {
      sql += " AND work_date <= ?";
      params.push(endDate);
    }

    const [rows] = await pool.query(sql, params);

    if (rows.length === 0) {
      return res.status(200).json({
        message: "ยังไม่มีประวัติการลงเวลาทำงานของพนักงาน",
        employee: employee[0],
        total: rows.length,
        data: [],
      });
    }

    res.status(200).json({
      message: "ดึงข้อมูลการเข้างานพนักงานสำเร็จ",
      employee: employee[0],
      total: rows.length,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// 4. GET: ดึงรายการคำขอลาทั้งหมด
app.get("/api/v1/leave-requests", async (req, res, next) => {
  try {
    const sql = `
      SELECT 
        l.id,
        l.employee_id,
        e.employeeCode,
        e.name AS employee_name,
        e.department,
        l.leave_type,
        DATE_FORMAT(l.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(l.end_date, '%Y-%m-%d') AS end_date,
        l.reason,
        l.status,
        l.created_at
      FROM leave_requests l
      JOIN employees e ON l.employee_id = e.id
      ORDER BY l.created_at DESC
    `;

    const [rows] = await pool.query(sql);

    res.status(200).json({
      total: rows.length,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// 5. GET: ดึงประวัติการลาของพนักงานเฉพาะรายบุคคล
app.get("/api/v1/employees/:id/leave-requests", async (req, res, next) => {
  try {
    const { id } = req.params;

    const [employee] = await pool.query(
      "SELECT id, name FROM employees WHERE id = ?",
      [id],
    );

    if (employee.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลพนักงาน",
        },
      });
    }

    const sql = `
      SELECT 
        id,
        leave_type,
        DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
        reason,
        status,
        created_at
      FROM leave_requests 
      WHERE employee_id = ? 
      ORDER BY created_at DESC
    `;

    const [rows] = await pool.query(sql, [id]);

    res.status(200).json({
      message:
        rows.length === 0
          ? "ยังไม่มีประวัติการลาของพนักงาน"
          : "ดึงข้อมูลประวัติการลาสำเร็จ",
      employee_id: Number(id),
      employee_name: employee[0].name,
      total: rows.length,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// 6. POST: เพิ่มข้อมูลพนักงานใหม่
app.post("/api/v1/employees", async (req, res, next) => {
  try {
    const { employeeCode, name, department } = req.body;

    if (!employeeCode || !name || !department) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "กรุณาระบุข้อมูลให้ครบถ้วน",
        },
      });
    }

    const [result] = await pool.query(
      "INSERT INTO employees (employeeCode, name, department) VALUES (?, ?, ?)",
      [employeeCode, name, department],
    );

    res.status(201).json({
      message: "เพิ่มข้อมูลพนักงานสำเร็จ",
      data: { id: result.insertId, employeeCode, name, department },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "DUPLICATE_ENTRY",
          message: "รหัสพนักงานนี้มีอยู่ในระบบแล้ว",
        },
      });
    }
    next(err);
  }
});

// 7. POST: บันทึกเวลาเข้างานของพนักงานเฉพาะรายบุคคล
app.post("/api/v1/employees/:id/attendance", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { work_date, check_in, check_out, status } = req.body;

    if (!work_date || !check_in) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "กรุณากรอกข้อมูลให้ครบถ้วน (work_date, check_in)",
        },
      });
    }

    const [employee] = await pool.query(
      "SELECT id, name, department FROM employees WHERE id = ?",
      [id],
    );

    if (employee.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลพนักงาน",
        },
      });
    }

    const attendanceStatus = status || "ON_TIME";

    const [result] = await pool.query(
      "INSERT INTO attendance (employee_id, work_date, check_in, check_out, status) VALUES (?, ?, ?, ?, ?)",
      [id, work_date, check_in, check_out || null, attendanceStatus],
    );

    res.status(201).json({
      message: "บันทึกเวลาเข้างานสำเร็จ",
      employee: employee[0],
      data: {
        id: result.insertId,
        employee_id: Number(id),
        work_date,
        check_in,
        check_out: check_out || null,
        status: attendanceStatus,
      },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "DUPLICATE_ATTENDANCE",
          message: "พนักงานคนนี้ได้บันทึกเวลาเข้างานวันนี้ไปแล้ว",
        },
      });
    }
    next(err);
  }
});

// 8. POST: ยื่นคำขอลาของพนักงานเฉพาะรายบุคคล
app.post("/api/v1/employees/:id/leave-requests", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { leave_type, start_date, end_date, reason } = req.body;

    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message:
            "กรุณากรอกข้อมูลให้ครบถ้วน (leave_type, start_date, end_date)",
        },
      });
    }

    const [employee] = await pool.query(
      "SELECT id FROM employees WHERE id = ?",
      [id],
    );
    if (employee.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลพนักงาน" },
      });
    }

    const formattedLeaveType = String(leave_type).toUpperCase();
    const validLeaveTypes = ["SICK", "PERSONAL", "VACATION"];

    if (!validLeaveTypes.includes(formattedLeaveType)) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message:
            "ประเภทการลาต้องเป็น 'SICK', 'PERSONAL' หรือ 'VACATION' เท่านั้น",
        },
      });
    }

    const [result] = await pool.query(
      `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, formattedLeaveType, start_date, end_date, reason || null],
    );

    res.status(201).json({
      message: "ยื่นคำขอลาเรียบร้อยแล้ว",
      data: {
        id: result.insertId,
        employee_id: Number(id),
        leave_type: formattedLeaveType,
        start_date,
        end_date,
        reason: reason || null,
        status: "PENDING",
      },
    });
  } catch (err) {
    next(err);
  }
});

// 9. PUT: แก้ไขข้อมูลพนักงานทั้งระเบียนเฉพาะรายบุคคล
app.put("/api/v1/employees/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, department } = req.body;

    if (!name || !department) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "กรุณากรอกข้อมูลที่ต้องการแก้ไขให้ครบถ้วน",
        },
      });
    }

    const [result] = await pool.query(
      "UPDATE employees SET name = ?, department = ? WHERE id = ?",
      [name, department, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลพนักงาน" },
      });
    }

    res.status(200).json({
      message: "อัปเดตข้อมูลพนักงานสำเร็จ",
      data: {
        id: Number(id),
        name,
        department,
      },
    });
  } catch (err) {
    next(err);
  }
});

// 10. PATCH: แก้ไขข้อมูลการลงเวลาของพนักงานเฉพาะรายบุคคล
app.patch(
  "/api/v1/employees/:employee_id/attendance/:attendance_id",
  async (req, res, next) => {
    try {
      const { employee_id, attendance_id } = req.params;
      const { check_in, check_out, status } = req.body;

      const [employee] = await pool.query(
        "SELECT id, name, department FROM employees WHERE id = ?",
        [employee_id],
      );

      if (employee.length === 0) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลพนักงาน" },
        });
      }

      const [existing] = await pool.query(
        `SELECT 
           id, 
           employee_id, 
           DATE_FORMAT(work_date, '%Y-%m-%d') AS work_date, 
           check_in, 
           check_out, 
           status 
         FROM attendance 
         WHERE id = ? AND employee_id = ?`,
        [attendance_id, employee_id],
      );

      if (existing.length === 0) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลการลงเวลาพนักงาน" },
        });
      }

      const updatedCheckIn =
        check_in !== undefined ? check_in : existing[0].check_in;
      const updatedCheckOut =
        check_out !== undefined ? check_out : existing[0].check_out;
      const updatedStatus = status !== undefined ? status : existing[0].status;

      await pool.query(
        "UPDATE attendance SET check_in = ?, check_out = ?, status = ? WHERE id = ? AND employee_id = ?",
        [
          updatedCheckIn,
          updatedCheckOut,
          updatedStatus,
          attendance_id,
          employee_id,
        ],
      );

      return res.status(200).json({
        message: "อัปเดตข้อมูลการลงเวลาเรียบร้อย",
        employee: employee[0],
        data: {
          attendance_id: Number(attendance_id),
          employee_id: Number(employee_id),
          work_date: existing[0].work_date,
          check_in: updatedCheckIn,
          check_out: updatedCheckOut,
          status: updatedStatus,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// 11. PATCH: อนุมัติหรือปฏิเสธคำขอลาของพนักงานเฉพาะรายบุคคล
app.patch("/api/v1/leave-requests/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "สถานะต้องเป็น 'APPROVED' หรือ 'REJECTED' เท่านั้น",
        },
      });
    }

    const [result] = await pool.query(
      "UPDATE leave_requests SET status = ? WHERE id = ?",
      [status, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลคำขอลาของพนักงาน" },
      });
    }

    res.status(200).json({
      message: `อัปเดตสถานะคำขอลาเป็น ${status} เรียบร้อยแล้ว`,
      data: { id: Number(id), status },
    });
  } catch (err) {
    next(err);
  }
});

// 12. DELETE: ลบข้อมูลพนักงานเฉพาะรายบุคคล
app.delete("/api/v1/employees/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const [employee] = await pool.query(
      "SELECT * FROM employees WHERE id = ?",
      [id],
    );

    if (employee.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลพนักงาน",
        },
      });
    }

    await pool.query("DELETE FROM employees WHERE id = ?", [id]);

    res.status(200).json({
      message: "ลบข้อมูลพนักงานสำเร็จ",
      employee: employee[0],
    });
  } catch (err) {
    next(err);
  }
});

// 404: NOT_FOUND
app.use((req, res) => {
  res.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" },
  });
});

// ERROR
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : err.type || "ERROR",
      message:
        statusCode === 500
          ? "เกิดข้อผิดพลาดที่ไม่คาดคิดภายในระบบ"
          : err.message,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่พอร์ต ${PORT} (${process.env.NODE_ENV})`);
});
