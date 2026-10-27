require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const pool = require("./db");

const app = express();
app.use(helmet());
app.use(
  cors({
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

// Middleware เช็กสิทธิ์ Admin
const requireAdmin = (req, res, next) => {
  const role = req.headers["x-user-role"];
  if (role !== "admin") {
    return res
      .status(403)
      .json({ error: { message: "ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้" } });
  }
  next();
};

// GET / - ดึงรายการคำขอลาของพนักงานทั้งหมด (Admin)
app.get("/", requireAdmin, async (req, res, next) => {
  try {
    const sql = `
      SELECT 
        l.id, l.employee_id, e.employeeCode, e.name AS employee_name, e.department,
        l.leave_type, DATE_FORMAT(l.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(l.end_date, '%Y-%m-%d') AS end_date, l.reason, l.status, l.created_at
      FROM leave_requests l
      JOIN employees e ON l.employee_id = e.id
      ORDER BY l.created_at DESC
    `;

    const [rows] = await pool.query(sql);
    res.status(200).json({ total: rows.length, data: rows });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id - อนุมัติหรือปฏิเสธคำขอลา (Admin)
app.patch("/:id", requireAdmin, async (req, res, next) => {
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "เกิดข้อผิดพลาดภายใน Leave Service",
    },
  });
});

if (require.main === module) {
  app.listen(3003, () => console.log(`Leave Service running on port 3003`));
}
module.exports = app;
