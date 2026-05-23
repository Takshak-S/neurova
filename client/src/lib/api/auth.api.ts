import apiClient from "./client";
import { APIResponse, SendOTPResponse, VerifyOTPResponse, User } from "@/types/api.types";

export const authAPI = {
    sendOTP: (phone: string) =>
        apiClient.post<APIResponse<SendOTPResponse>>("/auth/send-otp", { phone }),

    verifyOTP: (phone: string, otp: string) =>
        apiClient.post<APIResponse<VerifyOTPResponse>>("/auth/verify-otp", { phone, otp }),

    getMe: () =>
        apiClient.get<APIResponse<User>>("/auth/me"),

    refreshToken: () =>
        apiClient.post<APIResponse<{ token: string }>>("/auth/refresh"),
};