const request = require("supertest");
const app = require("./index.js");
const pool = require("./db");

// Mock Database
jest.mock("./db", () => ({
  query: jest.fn(),
}));

// ปิดการแสดงผล console.error ในหน้าจอ Test (เพื่อให้ log สะอาดตอนจำลอง Error)
beforeAll(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});

describe("Leave Service Endpoints - Full Coverage", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Middleware Check
  // =========================================================================
  describe("Admin Middleware", () => {
    it("ควรบล็อกถ้าไม่ใช่ Admin", async () => {
      const res = await request(app).get("/").set("x-user-role", "employee");
      expect(res.statusCode).toBe(403);
      expect(res.body.error.message).toBe("ไม่มีสิทธิ์เข้าถึงข้อมูลส่วนนี้");
    });
  });

  // =========================================================================
  // GET /
  // =========================================================================
  describe("GET /", () => {
    it("ควรคืนค่ารายการลาทั้งหมดถ้าเป็น Admin", async () => {
      pool.query.mockResolvedValue([[{ id: 1, leave_type: "SICK" }]]);

      const res = await request(app).get("/").set("x-user-role", "admin");

      expect(res.statusCode).toBe(200);
      expect(res.body.data[0].leave_type).toBe("SICK");
      expect(res.body.total).toBe(1);
    });

    it("ควรเข้าสู่ Global Error Handler (500) เมื่อ DB พัง", async () => {
      // จำลองให้ Database คืนค่า Error เพื่อเข้าบล็อก catch (err)
      pool.query.mockRejectedValue(new Error("Database Connection Failed"));

      const res = await request(app).get("/").set("x-user-role", "admin");

      expect(res.statusCode).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });
  });

  // =========================================================================
  // PATCH /:id
  // =========================================================================
  describe("PATCH /:id", () => {
    it("ควรคืนค่า 400 ถ้า status ว่างเปล่า หรือไม่ถูกต้อง", async () => {
      const res = await request(app)
        .patch("/1")
        .set("x-user-role", "admin")
        .send({ status: "MAYBE" }); // ส่งสถานะผิด

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("BAD_REQUEST");
    });

    it("ควรคืนค่า 404 หากไม่พบข้อมูลคำขอลา (affectedRows = 0)", async () => {
      // จำลองกรณีที่หาคำขอลาไม่เจอ (เช่น ถูกลบไปแล้ว)
      pool.query.mockResolvedValue([{ affectedRows: 0 }]);

      const res = await request(app)
        .patch("/99")
        .set("x-user-role", "admin")
        .send({ status: "APPROVED" });

      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("ควรอนุมัติหรือปฏิเสธคำขอลาได้สำเร็จ (Admin)", async () => {
      // จำลองว่าอัปเดตสำเร็จ
      pool.query.mockResolvedValue([{ affectedRows: 1 }]);

      const res = await request(app)
        .patch("/1")
        .set("x-user-role", "admin")
        .send({ status: "REJECTED" });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe("REJECTED");
    });

    it("ควรเข้าสู่ Global Error Handler (500) หาก DB พังขณะอัปเดต", async () => {
      // จำลองให้ Database พังตอนรันคำสั่ง UPDATE
      pool.query.mockRejectedValue(new Error("Update Query Failed"));

      const res = await request(app)
        .patch("/1")
        .set("x-user-role", "admin")
        .send({ status: "APPROVED" });

      expect(res.statusCode).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });
  });
});
