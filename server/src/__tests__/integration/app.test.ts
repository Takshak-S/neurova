import request from "supertest";
import app from "../../app";
import "../helpers/redisMock";

// These tests verify the error handling infrastructure itself.
// They don't need a DB connection because they test routes that
// never reach the database.

describe("App-level error handling", () => {
  describe("404 handler", () => {
    it("should return 404 for unknown routes", async () => {
      const res = await request(app).get("/api/v1/nonexistent");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("not found");
    });

    it("should return 404 for unknown methods on known paths", async () => {
      const res = await request(app).delete("/api/v1/auth/send-otp");
      expect(res.status).toBe(404);
    });
  });

  describe("health check", () => {
    it("GET /api/v1/health should return 200", async () => {
      const res = await request(app).get("/api/v1/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptime).toBeDefined();
    });
  });

  describe("security headers", () => {
    it("should include helmet security headers", async () => {
      const res = await request(app).get("/api/v1/health");

      // Helmet sets these by default
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBeDefined();
    });
  });

  describe("content-type enforcement", () => {
    it("should handle requests with no Content-Type header gracefully", async () => {
      const res = await request(app)
        .post("/api/v1/auth/send-otp")
        .send("phone=+919876543210"); // raw string, not JSON

      // Should fail validation, not crash the server
      expect(res.status).toBe(400);
    });
  });
});
