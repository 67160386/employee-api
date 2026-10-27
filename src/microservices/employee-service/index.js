require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const pool = require("./db");
const { getEmployeeEnrichment } = require("../services/enrichment-service");

const app = express();
app.use(helmet());
app.use(
  cors({
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

// Middleware เช็กสิทธิ์ Admin จาก Header ที่ Gateway ส่งมา
const requireAdmin = (req, res, next) => {
  const role = req.headers["x-user-role"];
  if (role !== "admin") {
    return res
      .status(403)
      .json({ error: { message: "ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้" } });
  }
  next();
};

// GET / - ดึงรายการพนักงานทั้งหมด
app.get("/", async (req, res, next) => {
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

// GET /attendance - ดึงประวัติการเข้างานพนักงานทั้งหมด (Admin)
app.get("/attendance", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.id, a.employee_id, e.employeeCode, e.name AS employee_name, e.department,
        DATE_FORMAT(a.work_date, '%Y-%m-%d') AS work_date, a.check_in, a.check_out, a.status
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
    `);
    res.status(200).json({
      message: "ดึงข้อมูลการเข้างานพนักงานทั้งหมดสำเร็จ",
      total: rows.length,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /:id - ดึงข้อมูลพนักงานรายบุคคล
app.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM employees WHERE id = ?", [
      id,
    ]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลพนักงาน" } });
    }

    res.status(200).json({ message: "ดึงข้อมูลพนักงานสำเร็จ", data: rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /:id/attendance - ดึงประวัติการเข้างานรายบุคคล (Admin)
app.get("/:id/attendance", requireAdmin, async (req, res, next) => {
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
    res.status(200).json({
      message:
        rows.length === 0
          ? "ยังไม่มีประวัติการลงเวลาทำงานของพนักงาน"
          : "ดึงข้อมูลการเข้างานพนักงานสำเร็จ",
      employee: employee[0],
      total: rows.length,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /:id/leave-requests - ดึงประวัติการลารายบุคคล
app.get("/:id/leave-requests", async (req, res, next) => {
  try {
    const { id } = req.params;
    const [employee] = await pool.query(
      "SELECT id, name FROM employees WHERE id = ?",
      [id],
    );

    if (employee.length === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลพนักงาน" } });
    }

    const sql = `
      SELECT id, leave_type, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
             DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, reason, status, created_at
      FROM leave_requests WHERE employee_id = ? ORDER BY created_at DESC
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

// GET /:id/enrichment - ข้อมูลเสริมจาก External API
app.get("/:id/enrichment", async (req, res, next) => {
  try {
    const enrichment = await getEmployeeEnrichment(req.params.id);
    res.status(200).json({ data: { employeeId: req.params.id, enrichment } });
  } catch (err) {
    next(err);
  }
});

// POST / - เพิ่มพนักงานใหม่ (Admin)
app.post("/", requireAdmin, async (req, res, next) => {
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

// POST /:id/attendance - ลงเวลาเข้างาน (Admin)
app.post("/:id/attendance", requireAdmin, async (req, res, next) => {
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
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลพนักงาน" } });
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

// POST /:id/leave-requests - ยื่นคำขอลา
app.post("/:id/leave-requests", async (req, res, next) => {
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
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลพนักงาน" } });
    }

    const formattedLeaveType = String(leave_type).toUpperCase();
    if (!["SICK", "PERSONAL", "VACATION"].includes(formattedLeaveType)) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message:
            "ประเภทการลาต้องเป็น 'SICK', 'PERSONAL' หรือ 'VACATION' เท่านั้น",
        },
      });
    }

    const [result] = await pool.query(
      "INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)",
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

// PUT /:id - แก้ไขพนักงาน (Admin)
app.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { employeeCode, name, department } = req.body;

    if (!employeeCode || !name || !department) {
      return res.status(400).json({
        error: {
          code: "BAD_REQUEST",
          message: "กรุณากรอกข้อมูลที่ต้องการแก้ไขให้ครบถ้วน",
        },
      });
    }

    const [result] = await pool.query(
      "UPDATE employees SET employeeCode = ?, name = ?, department = ? WHERE id = ?",
      [employeeCode, name, department, id],
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลพนักงาน" } });
    }

    res.status(200).json({
      message: "อัปเดตข้อมูลพนักงานสำเร็จ",
      data: { id: Number(id), employeeCode, name, department },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /:employee_id/attendance/:attendance_id - แก้ไขประวัติการลงเวลา (Admin)
app.patch(
  "/:employee_id/attendance/:attendance_id",
  requireAdmin,
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
        "SELECT id, employee_id, DATE_FORMAT(work_date, '%Y-%m-%d') AS work_date, check_in, check_out, status FROM attendance WHERE id = ? AND employee_id = ?",
        [attendance_id, employee_id],
      );

      if (existing.length === 0) {
        return res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: "ไม่พบข้อมูลการลงเวลาพนักงาน",
          },
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

      res.status(200).json({
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

// DELETE /:id - ลบพนักงาน (Admin)
app.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const [employee] = await pool.query(
      "SELECT * FROM employees WHERE id = ?",
      [id],
    );

    if (employee.length === 0) {
      return res
        .status(404)
        .json({ error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลพนักงาน" } });
    }

    await pool.query("DELETE FROM employees WHERE id = ?", [id]);
    res
      .status(200)
      .json({ message: "ลบข้อมูลพนักงานสำเร็จ", employee: employee[0] });
  } catch (err) {
    next(err);
  }
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "เกิดข้อผิดพลาดภายใน Employee Service",
    },
  });
});

if (require.main === module) {
  app.listen(3002, () => console.log(`Employee Service running on port 3002`));
}
module.exports = app;
