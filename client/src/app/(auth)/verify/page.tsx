"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { verifyOTP, sendOTP } from "@/store/slices/auth.slice";
import { OTPInput } from "@/components/auth/OTPInput";
import { Button } from "@/components/ui/Button";
import { keyManager } from "@/lib/crypto/keyManager";

export default function VerifyPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const { loading, error } = useAppSelector(s => s.auth);
    const [otp, setOtp] = useState("");
    const [phone, setPhone] = useState("");
    const [resendCooldown, setResendCooldown] = useState(60);
    const [otpError, setOtpError] = useState(false);

    useEffect(() => {
        const stored = sessionStorage.getItem("neurova_otp_phone");
        if (!stored) { router.replace("/login"); return; }
        setPhone(stored);
        // Countdown timer for resend
        const interval = setInterval(() => {
            setResendCooldown(c => c > 0 ? c - 1 : 0);
        }, 1000);
        return () => clearInterval(interval);
    }, [router]);

    useEffect(() => {
        // Auto-submit when all 6 digits entered
        if (otp.length === 6) handleVerify(otp);
    }, [otp]);

    const handleVerify = async (code: string) => {
        setOtpError(false);
        const result = await dispatch(verifyOTP({ phone, otp: code }));
        if (verifyOTP.fulfilled.match(result)) {
            sessionStorage.removeItem("neurova_otp_phone");
            // Check if keys exist — new users need onboarding
            const hasKeys = await keyManager.hasKeyPair();
            if (result.payload.isNewUser || !hasKeys) {
                router.push("/onboarding");
            } else {
                router.push("/conversations");
            }
        } else {
            setOtpError(true);
            setOtp("");
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        await dispatch(sendOTP(phone));
        setResendCooldown(60);
        setOtp("");
        setOtpError(false);
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-xl font-bold text-text-primary mb-1">Enter code</h2>
                <p className="text-text-muted text-sm">
                    Sent to <span className="font-medium text-text-primary">{phone}</span>
                </p>
            </div>

            <div className="flex flex-col gap-4">
                <OTPInput
                    value={otp}
                    onChange={setOtp}
                    disabled={loading}
                    error={otpError}
                />

                {(error || otpError) && (
                    <p className="text-sm text-red-500 text-center">
                        {error ?? "Invalid code. Please try again."}
                    </p>
                )}

                <Button
                    onClick={() => handleVerify(otp)}
                    disabled={otp.length < 6}
                    loading={loading}
                    size="lg"
                    className="w-full"
                >
                    Verify
                </Button>
            </div>

            <div className="text-center">
                <button
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className="text-sm text-primary disabled:text-text-muted transition-colors"
                >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
            </div>

            <button
                onClick={() => router.push("/login")}
                className="text-xs text-text-muted text-center hover:text-text-secondary transition-colors"
            >
                ← Use a different number
            </button>
        </div>
    );
}