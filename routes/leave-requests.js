const express = require("express");
const router = express.Router();
const pool = require("../db");
const { authenticateToken, authorizeRole } = require("../middleware/auth");

// GET: ดึงรายการคำขอลาของพนักงานทั้งหมด
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  async (req, res, next) => {
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
  },
);

// PATCH: อนุมัติหรือปฏิเสธคำขอลาของพนักงานเฉพาะรายบุคคล
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  async (req, res, next) => {
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
  },
);

module.exports = router;
