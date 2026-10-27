const request = require("supertest");
const app = require("./index.js");
const pool = require("./db");
const authHelpers = require("../auth-helpers");

// Mock Database และ Auth Helpers
jest.mock("./db", () => ({
  query: jest.fn(),
}));

jest.mock("../auth-helpers", () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
  generateToken: jest.fn(),
}));

describe("Auth Service Endpoints - Full Coverage", () => {
  // เคลียร์ mock ทุกครั้งหลังจบแต่ละ test
  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // GET /me
  // =========================================================================
  describe("GET /me", () => {
    it("ควรดึงข้อมูลตัวเองได้สำเร็จเมื่อมี x-user-id", async () => {
      pool.query.mockResolvedValue([
        [{ id: 1, email: "test@test.com", role: "employee" }],
      ]);

      const res = await request(app).get("/me").set("x-user-id", "1");

      expect(res.statusCode).toBe(200);
      expect(res.body.data.email).toBe("test@test.com");
    });

    it("ควรคืนค่า 401 เมื่อไม่ได้ส่ง x-user-id มาใน Header", async () => {
      const res = await request(app).get("/me");

      expect(res.statusCode).toBe(401);
      expect(res.body.error.message).toBe("ไม่พบข้อมูลผู้ใช้");
    });

    it("ควรคืนค่า 404 เมื่อไม่พบผู้ใช้ใน Database", async () => {
      pool.query.mockResolvedValue([[]]); // จำลองว่าหาใน DB ไม่เจอ

      const res = await request(app).get("/me").set("x-user-id", "99");

      expect(res.statusCode).toBe(404);
      expect(res.body.error.message).toBe("ไม่พบผู้ใช้");
    });

    it("ควรเข้าสู่ Global Error Handler (500) เมื่อ Database มีปัญหา", async () => {
      pool.query.mockRejectedValue(new Error("DB Connection Error"));

      const res = await request(app).get("/me").set("x-user-id", "1");

      expect(res.statusCode).toBe(500);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });
  });

  // =========================================================================
  // POST /register
  // =========================================================================
  describe("POST /register", () => {
    it("ควรสมัครสมาชิกสำเร็จ", async () => {
      authHelpers.hashPassword.mockResolvedValue("hashed_password");
      pool.query.mockResolvedValue([{ insertId: 1 }]);

      const res = await request(app)
        .post("/register")
        .send({ email: "test@test.com", password: "password123" });

      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe("สมัครสมาชิกสำเร็จ");
    });

    it("ควรคืนค่า 400 เมื่อไม่ได้ส่ง email หรือ password", async () => {
      const res = await request(app)
        .post("/register")
        .send({ email: "test@test.com" }); // ขาด password

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("ควรคืนค่า 409 ถ้าอีเมลซ้ำ (ER_DUP_ENTRY)", async () => {
      const error = new Error();
      error.code = "ER_DUP_ENTRY";
      pool.query.mockRejectedValue(error);

      const res = await request(app)
        .post("/register")
        .send({ email: "duplicate@test.com", password: "password123" });

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_EMAIL");
    });

    it("ควรเข้าสู่ Global Error Handler (500) เมื่อเกิด Error อื่นๆ ที่ไม่ใช่ข้อมูลซ้ำ", async () => {
      pool.query.mockRejectedValue(new Error("Unexpected DB Error"));

      const res = await request(app)
        .post("/register")
        .send({ email: "error@test.com", password: "password123" });

      expect(res.statusCode).toBe(500);
    });
  });

  // =========================================================================
  // POST /login
  // =========================================================================
  describe("POST /login", () => {
    it("ควรเข้าสู่ระบบสำเร็จและได้ Token", async () => {
      pool.query.mockResolvedValue([
        [{ id: 1, email: "test@test.com", password_hash: "hash" }],
      ]);
      authHelpers.verifyPassword.mockResolvedValue(true);
      authHelpers.generateToken.mockReturnValue("mocked_jwt_token");

      const res = await request(app)
        .post("/login")
        .send({ email: "test@test.com", password: "password123" });

      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBe("mocked_jwt_token");
    });

    it("ควรคืนค่า 400 เมื่อไม่ได้ส่ง email หรือ password", async () => {
      const res = await request(app)
        .post("/login")
        .send({ password: "password123" }); // ขาด email

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("ควรคืนค่า 401 เมื่อไม่พบอีเมลในระบบ", async () => {
      pool.query.mockResolvedValue([[]]); // คืนค่า array ว่าง

      const res = await request(app)
        .post("/login")
        .send({ email: "wrong@test.com", password: "password123" });

      expect(res.statusCode).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("ควรคืนค่า 401 เมื่อรหัสผ่านไม่ถูกต้อง", async () => {
      pool.query.mockResolvedValue([
        [{ id: 1, email: "test@test.com", password_hash: "hash" }],
      ]);
      authHelpers.verifyPassword.mockResolvedValue(false); // จำลองว่ารหัสผ่านผิด

      const res = await request(app)
        .post("/login")
        .send({ email: "test@test.com", password: "wrongpassword" });

      expect(res.statusCode).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("ควรเข้าสู่ Global Error Handler (500) เมื่อ Database มีปัญหาตอน Login", async () => {
      pool.query.mockRejectedValue(new Error("DB Error"));

      const res = await request(app)
        .post("/login")
        .send({ email: "test@test.com", password: "password123" });

      expect(res.statusCode).toBe(500);
    });
  });
});
