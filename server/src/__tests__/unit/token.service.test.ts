import { tokenService } from "../../services/token.service";
import { ApiError } from "../../utils/ApiError";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";

// Unit tests for tokenService.
// No DB or Redis — tokens are self-contained cryptographic objects.
// We use the real JWT library here (not mocked) because the logic IS jwt.

describe("tokenService", () => {
  const mockUserId = new Types.ObjectId();
  const mockPhone = "+919876543210";

  describe("sign()", () => {
    it("should return a JWT string", () => {
      const token = tokenService.sign(mockUserId, mockPhone);
      expect(typeof token).toBe("string");
      // JWT format: three base64 segments separated by dots
      expect(token.split(".")).toHaveLength(3);
    });

    it("should embed userId and phone in the payload", () => {
      const token = tokenService.sign(mockUserId, mockPhone);
      // Decode without verification to inspect payload
      const decoded = jwt.decode(token) as Record<string, string>;

      expect(decoded.userId).toBe(mockUserId.toString());
      expect(decoded.phone).toBe(mockPhone);
    });

    it("should embed an expiry (exp) in the payload", () => {
      const token = tokenService.sign(mockUserId, mockPhone);
      const decoded = jwt.decode(token) as Record<string, number>;
      expect(decoded.exp).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000); // exp is in the future
    });
  });

  describe("verify()", () => {
    it("should return the payload for a valid token", () => {
      const token = tokenService.sign(mockUserId, mockPhone);
      const payload = tokenService.verify(token);

      expect(payload.userId).toBe(mockUserId.toString());
      expect(payload.phone).toBe(mockPhone);
    });

    it("should throw ApiError 401 for a tampered token", () => {
      const token = tokenService.sign(mockUserId, mockPhone);
      const tampered = token.slice(0, -5) + "XXXXX"; // corrupt the signature

      expect(() => tokenService.verify(tampered)).toThrow(ApiError);
      expect(() => tokenService.verify(tampered)).toThrow("Invalid token.");
    });

    it("should throw ApiError 401 for a completely invalid string", () => {
      expect(() => tokenService.verify("not.a.token")).toThrow(ApiError);
    });

    it("should throw ApiError 401 for an expired token", () => {
      // Sign a token that expired 1 second ago
      const expiredToken = jwt.sign(
        { userId: mockUserId.toString(), phone: mockPhone },
        process.env.JWT_SECRET!,
        { expiresIn: -1 } // already expired
      );

      expect(() => tokenService.verify(expiredToken)).toThrow("Session expired");
    });

    it("should throw ApiError with statusCode 401", () => {
      try {
        tokenService.verify("invalid");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).statusCode).toBe(401);
      }
    });
  });
});