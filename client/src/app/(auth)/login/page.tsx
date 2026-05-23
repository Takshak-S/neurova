"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { sendOTP } from "@/store/slices/auth.slice";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const schema = z.object({
    phone: z.string().regex(/^\+[1-9]\d{9,14}$/, "Enter a valid phone number (e.g. +919876543210)"),
});

type Form = z.infer<typeof schema>;

export default function LoginPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const { loading, error } = useAppSelector(s => s.auth);

    const { register, handleSubmit, formState: { errors } } = useForm<Form>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async ({ phone }: Form) => {
        const result = await dispatch(sendOTP(phone));
        if (sendOTP.fulfilled.match(result)) {
            // Store phone for verify page
            sessionStorage.setItem("neurova_otp_phone", phone);
            router.push("/verify");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-xl font-bold text-text-primary mb-1">Sign in</h2>
                <p className="text-text-muted text-sm">We'll send you a verification code</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <Input
                    label="Phone number"
                    placeholder="+919876543210"
                    type="tel"
                    error={errors.phone?.message ?? error ?? undefined}
                    {...register("phone")}
                />
                <Button type="submit" loading={loading} size="lg" className="w-full">
                    Send code
                </Button>
            </form>

            <p className="text-xs text-text-muted text-center">
                By continuing, you agree to our terms. Your messages are end-to-end encrypted.
            </p>
        </div>
    );
}