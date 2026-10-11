require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const app = express();

const employeesRouter = require("./routes/employees");
const leaveRequestRouter = require("./routes/leave-requests");
const authRouter = require("./routes/authRouter");

const swaggerUi = require("swagger-ui-express");
const YAML = require("js-yaml");
const fs = require("fs");
const path = require("path");

const openapiDocument = YAML.load(
  fs.readFileSync(path.join(__dirname, "openapi.yaml"), "utf8"),
);

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

app.use("/api/v1/employees", employeesRouter);
app.use("/api/v1/leave-requests", leaveRequestRouter);
app.use("/api/v1/auth", authRouter);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

// 404: ไม่พบ route ที่ร้องขอ
app.use((req, res) => {
  res.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" },
  });
});

// Error-handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "เกิดข้อผิดพลาดภายในระบบ" },
  });
});

module.exports = app;
