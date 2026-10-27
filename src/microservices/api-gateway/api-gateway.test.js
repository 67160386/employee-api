const request = require("supertest");
const app = require("./index.js");

// Mock Middleware ให้ผ่านการเช็กสิทธิ์และ Rate Limit เสมอ
jest.mock("../middleware/auth", () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1, role: "admin" };
    next();
  },
}));

jest.mock("../middleware/rateLimiter", () => ({
  generalLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
}));

// Mock global fetch เพื่อไม่ต้องยิงไป Service จริง
global.fetch = jest.fn();

describe("API Gateway - All Endpoints Coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===============================================
  // ทดสอบฟังก์ชัน forwardRequest (Success & Body)
  // ===============================================
  it("should forward POST request with body successfully", async () => {
    // จำลองให้ fetch คืนค่ากลับมาเป็นสำเร็จ
    global.fetch.mockResolvedValueOnce({
      status: 201,
      json: async () => ({ message: "Success POST" }),
    });

    const payload = { email: "test@test.com", password: "123" };
    const res = await request(app).post("/api/v1/auth/register").send(payload);

    expect(res.statusCode).toBe(201);
    expect(res.body.message).toBe("Success POST");

    // ตรวจสอบว่า fetch ถูกเรียกด้วย Method POST และส่ง Body ไปด้วย
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/register"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
  });

  // ===============================================
  // ทดสอบ Route ที่ไม่มีอยู่จริง (404)
  // ===============================================
  it("should return 404 for unknown route", async () => {
    const res = await request(app).get("/api/v1/unknown");
    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  // ===============================================
  // ทดสอบกรณี Downstream Service ล่ม (503)
  // ===============================================
  it("should return 503 if downstream service throws an error", async () => {
    // จำลองให้ fetch พัง (เช่น network error)
    global.fetch.mockRejectedValueOnce(new Error("Connection Refused"));

    const res = await request(app).get("/api/v1/auth/me");
    expect(res.statusCode).toBe(503);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
  });

  // ===============================================
  // ทดสอบ Employee Endpoints (GET Methods)
  // ===============================================
  const getEndpoints = [
    { route: "/api/v1/employees", target: "/" },
    { route: "/api/v1/employees/attendance", target: "/attendance" },
    { route: "/api/v1/employees/99", target: "/99" },
    {
      route: "/api/v1/employees/99/leave-requests",
      target: "/99/leave-requests",
    },
    { route: "/api/v1/employees/99/enrichment", target: "/99/enrichment" },
    { route: "/api/v1/leave-requests", target: "/" }, // ของ leave service
  ];

  getEndpoints.forEach(({ route, target }) => {
    it(`should forward GET ${route}`, async () => {
      global.fetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ msg: "OK" }),
      });

      const res = await request(app).get(route);
      expect(res.statusCode).toBe(200);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(target),
        expect.objectContaining({ method: "GET" }),
      );
    });
  });

  // ทดสอบการส่ง Query String
  it("should forward query strings in GET /api/v1/employees/:id/attendance", async () => {
    global.fetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ msg: "OK" }),
    });

    const res = await request(app).get(
      "/api/v1/employees/1/attendance?startDate=2023-01-01",
    );
    expect(res.statusCode).toBe(200);
    // ต้องมี query string ต่อท้าย URL
    expect(global.fetch.mock.calls[0][0]).toContain("?startDate=2023-01-01");
  });

  // ===============================================
  // ทดสอบ Employee Endpoints (POST, PUT, PATCH, DELETE)
  // ===============================================
  it("should forward POST /api/v1/employees", async () => {
    global.fetch.mockResolvedValueOnce({ status: 201, json: async () => ({}) });
    await request(app).post("/api/v1/employees").send({ name: "A" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("should forward POST /api/v1/employees/:id/attendance", async () => {
    global.fetch.mockResolvedValueOnce({ status: 201, json: async () => ({}) });
    await request(app)
      .post("/api/v1/employees/1/attendance")
      .send({ check_in: "09:00" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("should forward POST /api/v1/employees/:id/leave-requests", async () => {
    global.fetch.mockResolvedValueOnce({ status: 201, json: async () => ({}) });
    await request(app)
      .post("/api/v1/employees/1/leave-requests")
      .send({ type: "SICK" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("should forward PUT /api/v1/employees/:id", async () => {
    global.fetch.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    await request(app).put("/api/v1/employees/1").send({ name: "B" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("should forward PATCH /api/v1/employees/:employee_id/attendance/:attendance_id", async () => {
    global.fetch.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    await request(app)
      .patch("/api/v1/employees/1/attendance/10")
      .send({ status: "LATE" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("should forward PATCH /api/v1/leave-requests/:id", async () => {
    global.fetch.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    await request(app)
      .patch("/api/v1/leave-requests/5")
      .send({ status: "APPROVED" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("should forward DELETE /api/v1/employees/:id", async () => {
    global.fetch.mockResolvedValueOnce({ status: 200, json: async () => ({}) });
    await request(app).delete("/api/v1/employees/1");
    // สังเกตว่า DELETE มักไม่มี Body
    expect(global.fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
