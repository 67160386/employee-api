require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const { authenticateToken } = require("../middleware/auth");
const { generalLimiter, authLimiter } = require("../middleware/rateLimiter");

const app = express();
const PORT = process.env.PORT || 3000;

const swaggerUi = require("swagger-ui-express");
const YAML = require("js-yaml");
const fs = require("fs");
const path = require("path");

const openapiDocument = YAML.load(
  fs.readFileSync(path.join(__dirname, "openapi.yaml"), "utf8"),
);

// กำหนด URL ของแต่ละ Microservice (ดึงจาก .env หรือใช้ค่าเริ่มต้น)
const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3001";
const EMPLOYEE_SERVICE_URL =
  process.env.EMPLOYEE_SERVICE_URL || "http://localhost:3002";
const LEAVE_SERVICE_URL =
  process.env.LEAVE_SERVICE_URL || "http://localhost:3003";

app.use(helmet());
app.use(
  cors({
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

// Helper function สำหรับทำ Forward Request
async function forwardRequest(req, res, targetUrl, method = "GET") {
  try {
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
        // ส่งข้อมูลที่แกะจาก Token ไปให้ Downstream Service นำไปเช็กสิทธิ์
        ...(req.user && {
          "x-user-role": req.user.role,
          "x-user-id": req.user.id,
        }),
      },
    };

    if (["POST", "PUT", "PATCH"].includes(method) && req.body) {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, options);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(503).json({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "ไมสามารถเชื่อมต่อบริการย่อยได้",
      },
    });
  }
}

// API Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

// =========================================================================
// 1. Auth Service Endpoints (จาก authRouter.js)
// =========================================================================

// GET /api/v1/auth/me
app.get("/api/v1/auth/me", generalLimiter, authenticateToken, (req, res) => {
  return forwardRequest(req, res, `${AUTH_SERVICE_URL}/me`, "GET");
});

// POST /api/v1/auth/register
app.post("/api/v1/auth/register", authLimiter, (req, res) => {
  return forwardRequest(req, res, `${AUTH_SERVICE_URL}/register`, "POST");
});

// POST /api/v1/auth/login
app.post("/api/v1/auth/login", authLimiter, (req, res) => {
  return forwardRequest(req, res, `${AUTH_SERVICE_URL}/login`, "POST");
});

// =========================================================================
// 2. Employee Service Endpoints (จาก employees.js)
// =========================================================================

// GET /api/v1/employees (ดึงข้อมูลพนักงานทั้งหมด)
app.get("/api/v1/employees", generalLimiter, authenticateToken, (req, res) => {
  return forwardRequest(req, res, `${EMPLOYEE_SERVICE_URL}/`, "GET");
});

// GET /api/v1/employees/attendance (ดึงประวัติการเข้างานพนักงานทั้งหมด - Admin)
app.get(
  "/api/v1/employees/attendance",
  generalLimiter,
  authenticateToken,
  (req, res) => {
    return forwardRequest(
      req,
      res,
      `${EMPLOYEE_SERVICE_URL}/attendance`,
      "GET",
    );
  },
);

// GET /api/v1/employees/:id (ดึงข้อมูลพนักงานเฉพาะรายบุคคล)
app.get(
  "/api/v1/employees/:id",
  generalLimiter,
  authenticateToken,
  (req, res) => {
    return forwardRequest(
      req,
      res,
      `${EMPLOYEE_SERVICE_URL}/${req.params.id}`,
      "GET",
    );
  },
);

// GET /api/v1/employees/:id/attendance (ดึงประวัติการเข้างานรายบุคคล - Admin)
app.get(
  "/api/v1/employees/:id/attendance",
  generalLimiter,
  authenticateToken,
  (req, res) => {
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${EMPLOYEE_SERVICE_URL}/${req.params.id}/attendance${queryString ? `?${queryString}` : ""}`;
    return forwardRequest(req, res, url, "GET");
  },
);

// GET /api/v1/employees/:id/leave-requests (ดึงประวัติการลารายบุคคล - Admin)
app.get(
  "/api/v1/employees/:id/leave-requests",
  generalLimiter,
  authenticateToken,
  (req, res) => {
    return forwardRequest(
      req,
      res,
      `${EMPLOYEE_SERVICE_URL}/${req.params.id}/leave-requests`,
      "GET",
    );
  },
);

// GET /api/v1/employees/:id/enrichment (ข้อมูลเสริมจาก External API)
app.get(
  "/api/v1/employees/:id/enrichment",
  generalLimiter,
  authenticateToken,
  (req, res) => {
    return forwardRequest(
      req,
      res,
      `${EMPLOYEE_SERVICE_URL}/${req.params.id}/enrichment`,
      "GET",
    );
  },
);

// POST /api/v1/employees (เพิ่มพนักงานใหม่ - Admin)
app.post("/api/v1/employees", generalLimiter, authenticateToken, (req, res) => {
  return forwardRequest(req, res, `${EMPLOYEE_SERVICE_URL}/`, "POST");
});

// POST /api/v1/employees/:id/attendance (ลงเวลาเข้างาน - Admin)
app.post(
  "/api/v1/employees/:id/attendance",
  generalLimiter,
  authenticateToken,
  (req, res) => {
    return forwardRequest(
      req,
      res,
      `${EMPLOYEE_SERVICE_URL}/${req.params.id}/attendance`,
      "POST",
    );
  },
);

// POST /api/v1/employees/:id/leave-requests (ยื่นคำขอลา)
app.post(
  "/api/v1/employees/:id/leave-requests",
  generalLimiter,
  authenticateToken,
  (req, res) => {
    return forwardRequest(
      req,
      res,
      `${EMPLOYEE_SERVICE_URL}/${req.params.id}/leave-requests`,
      "POST",
    );
  },
);

// PUT /api/v1/employees/:id (แก้ไขข้อมูลพนักงาน - Admin)
app.put(
  "/api/v1/employees/:id",
  generalLimiter,
  authenticateToken,
  (req, res) => {
    return forwardRequest(
      req,
      res,
      `${EMPLOYEE_SERVICE_URL}/${req.params.id}`,
      "PUT",
    );
  },
);

// PATCH /api/v1/employees/:employee_id/attendance/:attendance_id (แก้ไขประวัติการลงเวลา - Admin)
app.patch(
  "/api/v1/employees/:employee_id/attendance/:attendance_id",
  generalLimiter,
  authenticateToken,
  (req, res) => {
    const { employee_id, attendance_id } = req.params;
    return forwardRequest(
      req,
      res,
      `${EMPLOYEE_SERVICE_URL}/${employee_id}/attendance/${attendance_id}`,
      "PATCH",
    );
  },
);

// DELETE /api/v1/employees/:id (ลบพนักงาน - Admin)
app.delete(
  "/api/v1/employees/:id",
  generalLimiter,
  authenticateToken,
  (req, res) => {
    return forwardRequest(
      req,
      res,
      `${EMPLOYEE_SERVICE_URL}/${req.params.id}`,
      "DELETE",
    );
  },
);

// =========================================================================
// 3. Leave Requests Service Endpoints (จาก leave-requests.js)
// =========================================================================

// GET /api/v1/leave-requests (ดึงรายการคำขอลาทั้งหมด - Admin)
app.get(
  "/api/v1/leave-requests",
  generalLimiter,
  authenticateToken,
  (req, res) => {
    return forwardRequest(req, res, `${LEAVE_SERVICE_URL}/`, "GET");
  },
);

// PATCH /api/v1/leave-requests/:id (อนุมัติ/ปฏิเสธคำขอลา - Admin)
app.patch(
  "/api/v1/leave-requests/:id",
  generalLimiter,
  authenticateToken,
  (req, res) => {
    return forwardRequest(
      req,
      res,
      `${LEAVE_SERVICE_URL}/${req.params.id}`,
      "PATCH",
    );
  },
);

// -------------------------------------------------------------------------
// 404 & Global Error Handling
// -------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" },
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "เกิดข้อผิดพลาดภายในระบบ Gateway",
    },
  });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Api Gateway running on port ${PORT}`));
}
module.exports = app;
