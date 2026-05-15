import { ApiError } from "../../utils/ApiError";

describe("ApiError", ()=>{
    describe("constructor", ()=>{
        it("should create an error with the correct statusCode and message", ()=>{
            const error = new ApiError(400,"Bad request");
            expect(error.statusCode).toBe(400);
            expect(error.message).toBe("Bad request");
        });

        it("should be an instance of Error", ()=>{
            const error=new ApiError(500, "Server error");
            expect(error).toBeInstanceOf(Error);
        })

        it("should default isOperational to true", ()=>{
            const error = new ApiError(400,"Bad request");
            expect(error.isOperational).toBe(true);
        });

            it("should capture a stack trace", () => {
      const error = new ApiError(400, "Bad request");
      expect(error.stack).toBeDefined();
    });
  });
 
  describe("static factory methods", () => {
    it("badRequest() should return 400", () => {
      const error = ApiError.badRequest("Invalid input");
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe("Invalid input");
    });
 
    it("unauthorized() should return 401 with default message", () => {
      const error = ApiError.unauthorized();
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe("Unauthorized");
    });
 
    it("unauthorized() should use custom message when provided", () => {
      const error = ApiError.unauthorized("Token expired");
      expect(error.message).toBe("Token expired");
    });
 
    it("forbidden() should return 403", () => {
      const error = ApiError.forbidden();
      expect(error.statusCode).toBe(403);
    });
 
    it("notFound() should return 404", () => {
      const error = ApiError.notFound("User not found");
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("User not found");
    });
 
    it("tooManyRequests() should return 429", () => {
      const error = ApiError.tooManyRequests();
      expect(error.statusCode).toBe(429);
    });
 
    it("internal() should return 500 and set isOperational to false", () => {
      const error = ApiError.internal();
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
    });
  });
});