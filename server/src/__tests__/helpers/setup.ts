// This file runs before every test file via jest "setupFiles".
// It sets all required environment variables to safe test values
// so env.ts validation passes without a real .env file.
// Real external services (Twilio, Redis, MongoDB) are mocked — never called.
import "./redisMock";
 
process.env.NODE_ENV = "test";
process.env.PORT = "5001";
process.env.MONGODB_URI = "mongodb://localhost:27017/neurova_test"; // overridden by memory server
process.env.REDIS_URL = "redis://localhost:6379"; // overridden by ioredis-mock
process.env.JWT_SECRET = "test_jwt_secret_that_is_at_least_32_characters_long";
process.env.JWT_EXPIRES_IN = "7d";
process.env.TWILIO_ACCOUNT_SID = "ACtest00000000000000000000000000000";
process.env.TWILIO_AUTH_TOKEN = "test_auth_token_00000000000000000";
process.env.TWILIO_PHONE_NUMBER = "+15005550006";  // Twilio magic test number
process.env.OTP_EXPIRY_MINUTES = "10";
process.env.OTP_MAX_ATTEMPTS = "5";
process.env.OTP_RATE_LIMIT_WINDOW_MINUTES = "10";
process.env.OTP_RATE_LIMIT_MAX_REQUESTS = "5";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";