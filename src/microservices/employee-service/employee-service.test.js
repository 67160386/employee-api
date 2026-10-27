const request = require("supertest");
const app = require("./index.js");
const pool = require("./db");
const { getEmployeeEnrichment } = require("../services/enrichment-service");

// Mock Database และ External Service
jest.mock("./db", () => ({
  query: jest.fn(),
}));

jest.mock("../services/enrichment-service", () => ({
  getEmployeeEnrichment: jest.fn(),
}));

describe("Employee Service Endpoints - Full Coverage", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Middleware Check
  // =========================================================================
  describe("Admin Middleware", () => {
    it("ควรคืนค่า 403 เมื่อไม่มีสิทธิ์ Admin", async () => {
      const res = await request(app)
        .get("/attendance")
        .set("x-user-role", "employee");
      expect(res.statusCode).toBe(403);
      expect(res.body.error.message).toBe("ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้");
    });
  });

  // =========================================================================
  // GET /
  // =========================================================================
  describe("GET /", () => {
    it("ควรดึงข้อมูลพนักงานทั้งหมดได้", async () => {
      pool.query.mockResolvedValue([[{ id: 1, name: "John Doe" }]]);
      const res = await request(app).get("/");
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it("ควรเข้า Global Error Handler (500) หาก DB พัง", async () => {
      pool.query.mockRejectedValue(new Error("DB Error"));
      const res = await request(app).get("/");
      expect(res.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // GET /attendance
  // =========================================================================
  describe("GET /attendance (Admin)", () => {
    it("ควรดึงประวัติการเข้างานทั้งหมดได้เมื่อเป็น Admin", async () => {
      pool.query.mockResolvedValue([[{ id: 1, employee_name: "John" }]]);
      const res = await request(app)
        .get("/attendance")
        .set("x-user-role", "admin");
      expect(res.statusCode).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  // =========================================================================
  // GET /:id
  // =========================================================================
  describe("GET /:id", () => {
    it("ควรดึงข้อมูลพนักงานรายบุคคลได้", async () => {
      pool.query.mockResolvedValue([[{ id: 1, name: "John Doe" }]]);
      const res = await request(app).get("/1");
      expect(res.statusCode).toBe(200);
      expect(res.body.data.name).toBe("John Doe");
    });

    it("ควรคืนค่า 404 เมื่อไม่พบพนักงาน", async () => {
      pool.query.mockResolvedValue([[]]);
      const res = await request(app).get("/99");
      expect(res.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // GET /:id/attendance
  // =========================================================================
  describe("GET /:id/attendance (Admin)", () => {
    it("ควรคืนค่า 404 หากไม่พบพนักงาน", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app)
        .get("/99/attendance")
        .set("x-user-role", "admin");
      expect(res.statusCode).toBe(404);
    });

    it("ควรต่อ Query String ถูกต้อง (ไม่มี Date)", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "John" }]]); // mock employee
      pool.query.mockResolvedValueOnce([[{ id: 10, work_date: "2026-10-25" }]]); // mock attendance
      const res = await request(app)
        .get("/1/attendance")
        .set("x-user-role", "admin");
      expect(res.statusCode).toBe(200);
    });

    it("ควรต่อ Query String ถูกต้อง (มี startDate และ endDate)", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "John" }]]);
      pool.query.mockResolvedValueOnce([[]]); // mock rows ว่าง
      const res = await request(app)
        .get("/1/attendance?startDate=2026-01-01&endDate=2026-12-31")
        .set("x-user-role", "admin");
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("ยังไม่มีประวัติการลงเวลาทำงานของพนักงาน");
    });

    it("ควรต่อ Query String ถูกต้อง (มีเฉพาะ startDate)", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "John" }]]);
      pool.query.mockResolvedValueOnce([[{ id: 10 }]]);
      await request(app)
        .get("/1/attendance?startDate=2026-01-01")
        .set("x-user-role", "admin");
      expect(pool.query.mock.calls[1][0]).toContain("work_date >= ?");
    });

    it("ควรต่อ Query String ถูกต้อง (มีเฉพาะ endDate)", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "John" }]]);
      pool.query.mockResolvedValueOnce([[{ id: 10 }]]);
      await request(app)
        .get("/1/attendance?endDate=2026-12-31")
        .set("x-user-role", "admin");
      expect(pool.query.mock.calls[1][0]).toContain("work_date <= ?");
    });
  });

  // =========================================================================
  // GET /:id/leave-requests
  // =========================================================================
  describe("GET /:id/leave-requests", () => {
    it("ควรคืนค่า 404 หากไม่พบพนักงาน", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).get("/99/leave-requests");
      expect(res.statusCode).toBe(404);
    });

    it("ควรดึงข้อมูลประวัติการลาได้", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "John" }]]);
      pool.query.mockResolvedValueOnce([[{ id: 5, leave_type: "SICK" }]]);
      const res = await request(app).get("/1/leave-requests");
      expect(res.statusCode).toBe(200);
      expect(res.body.data[0].leave_type).toBe("SICK");
    });
  });

  // =========================================================================
  // GET /:id/enrichment
  // =========================================================================
  describe("GET /:id/enrichment", () => {
    it("ควรดึงข้อมูล Enrichment ได้", async () => {
      getEmployeeEnrichment.mockResolvedValue({ externalData: "info" });
      const res = await request(app).get("/1/enrichment");
      expect(res.statusCode).toBe(200);
      expect(res.body.data.enrichment.externalData).toBe("info");
    });
  });

  // =========================================================================
  // POST /
  // =========================================================================
  describe("POST / (Admin)", () => {
    it("ควรคืนค่า 400 หากข้อมูลไม่ครบ", async () => {
      const res = await request(app)
        .post("/")
        .set("x-user-role", "admin")
        .send({ name: "John" });
      expect(res.statusCode).toBe(400);
    });

    it("ควรเพิ่มพนักงานใหม่สำเร็จ", async () => {
      pool.query.mockResolvedValue([{ insertId: 1 }]);
      const res = await request(app)
        .post("/")
        .set("x-user-role", "admin")
        .send({ employeeCode: "E01", name: "John", department: "IT" });
      expect(res.statusCode).toBe(201);
    });

    it("ควรคืนค่า 409 หากรหัสพนักงานซ้ำ (ER_DUP_ENTRY)", async () => {
      const error = new Error();
      error.code = "ER_DUP_ENTRY";
      pool.query.mockRejectedValue(error);
      const res = await request(app)
        .post("/")
        .set("x-user-role", "admin")
        .send({ employeeCode: "E01", name: "John", department: "IT" });
      expect(res.statusCode).toBe(409);
    });
  });

  // =========================================================================
  // POST /:id/attendance
  // =========================================================================
  describe("POST /:id/attendance (Admin)", () => {
    it("ควรคืนค่า 400 หากข้อมูลไม่ครบ", async () => {
      const res = await request(app)
        .post("/1/attendance")
        .set("x-user-role", "admin")
        .send({});
      expect(res.statusCode).toBe(400);
    });

    it("ควรคืนค่า 404 หากไม่พบพนักงาน", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app)
        .post("/99/attendance")
        .set("x-user-role", "admin")
        .send({ work_date: "2026-10-25", check_in: "08:00" });
      expect(res.statusCode).toBe(404);
    });

    it("ควรลงเวลาเข้างานได้สำเร็จ", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // mock find employee
      pool.query.mockResolvedValueOnce([{ insertId: 10 }]); // mock insert
      const res = await request(app)
        .post("/1/attendance")
        .set("x-user-role", "admin")
        .send({ work_date: "2026-10-25", check_in: "08:00" });
      expect(res.statusCode).toBe(201);
    });

    it("ควรคืนค่า 409 หากลงเวลาซ้ำ (ER_DUP_ENTRY)", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // mock find employee
      const error = new Error();
      error.code = "ER_DUP_ENTRY";
      pool.query.mockRejectedValueOnce(error); // mock insert error
      const res = await request(app)
        .post("/1/attendance")
        .set("x-user-role", "admin")
        .send({ work_date: "2026-10-25", check_in: "08:00" });
      expect(res.statusCode).toBe(409);
    });
  });

  // =========================================================================
  // POST /:id/leave-requests
  // =========================================================================
  describe("POST /:id/leave-requests", () => {
    it("ควรคืนค่า 400 หากข้อมูลไม่ครบ", async () => {
      const res = await request(app)
        .post("/1/leave-requests")
        .send({ leave_type: "SICK" });
      expect(res.statusCode).toBe(400);
    });

    it("ควรคืนค่า 404 หากไม่พบพนักงาน", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).post("/99/leave-requests").send({
        leave_type: "SICK",
        start_date: "2026-10-25",
        end_date: "2026-10-26",
      });
      expect(res.statusCode).toBe(404);
    });

    it("ควรคืนค่า 400 หากประเภทการลาไม่ถูกต้อง", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
      const res = await request(app).post("/1/leave-requests").send({
        leave_type: "INVALID",
        start_date: "2026-10-25",
        end_date: "2026-10-26",
      });
      expect(res.statusCode).toBe(400);
    });

    it("ควรบันทึกคำขอลาสำเร็จ", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
      pool.query.mockResolvedValueOnce([{ insertId: 5 }]);
      const res = await request(app).post("/1/leave-requests").send({
        leave_type: "SICK",
        start_date: "2026-10-25",
        end_date: "2026-10-26",
      });
      expect(res.statusCode).toBe(201);
    });
  });

  // =========================================================================
  // PUT /:id
  // =========================================================================
  describe("PUT /:id (Admin)", () => {
    it("ควรคืนค่า 400 หากข้อมูลแก้ไขไม่ครบ", async () => {
      const res = await request(app)
        .put("/1")
        .set("x-user-role", "admin")
        .send({ name: "John" });
      expect(res.statusCode).toBe(400);
    });

    it("ควรคืนค่า 404 หากแก้ไขไม่สำเร็จ (ไม่พบพนักงาน)", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
      const res = await request(app)
        .put("/99")
        .set("x-user-role", "admin")
        .send({ employeeCode: "E01", name: "John", department: "IT" });
      expect(res.statusCode).toBe(404);
    });

    it("ควรแก้ไขข้อมูลพนักงานสำเร็จ", async () => {
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const res = await request(app)
        .put("/1")
        .set("x-user-role", "admin")
        .send({ employeeCode: "E01", name: "John", department: "IT" });
      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // PATCH /:employee_id/attendance/:attendance_id
  // =========================================================================
  describe("PATCH /:employee_id/attendance/:attendance_id (Admin)", () => {
    it("ควรคืนค่า 404 หากไม่พบพนักงาน", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app)
        .patch("/99/attendance/10")
        .set("x-user-role", "admin")
        .send({});
      expect(res.statusCode).toBe(404);
    });

    it("ควรคืนค่า 404 หากไม่พบประวัติการลงเวลา", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]); // mock employee
      pool.query.mockResolvedValueOnce([[]]); // mock existing attendance
      const res = await request(app)
        .patch("/1/attendance/10")
        .set("x-user-role", "admin")
        .send({});
      expect(res.statusCode).toBe(404);
    });

    it("ควรแก้ไขข้อมูลลงเวลาสำเร็จ (Partial update)", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
      pool.query.mockResolvedValueOnce([
        [{ id: 10, check_in: "08:00", check_out: null, status: "ON_TIME" }],
      ]);
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // mock update

      // ทดสอบอัปเดตเฉพาะ check_out
      const res = await request(app)
        .patch("/1/attendance/10")
        .set("x-user-role", "admin")
        .send({ check_out: "17:00" });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.check_out).toBe("17:00");
    });
  });

  // =========================================================================
  // DELETE /:id
  // =========================================================================
  describe("DELETE /:id (Admin)", () => {
    it("ควรคืนค่า 404 หากไม่พบพนักงานที่ต้องการลบ", async () => {
      pool.query.mockResolvedValueOnce([[]]);
      const res = await request(app).delete("/99").set("x-user-role", "admin");
      expect(res.statusCode).toBe(404);
    });

    it("ควรลบพนักงานสำเร็จ", async () => {
      pool.query.mockResolvedValueOnce([[{ id: 1, name: "John" }]]); // mock find
      pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // mock delete
      const res = await request(app).delete("/1").set("x-user-role", "admin");
      expect(res.statusCode).toBe(200);
    });
  });
});
