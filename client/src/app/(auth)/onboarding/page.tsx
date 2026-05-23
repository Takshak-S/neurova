"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useAppDispatch } from "@/store/hooks";
import { updateUser } from "@/store/slices/auth.slice";
import { userAPI } from "@/lib/api/user.api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { KeyGeneration } from "@/components/auth/KeyGeneration";

type Step = "profile" | "keys";

export default function OnboardingPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const [step, setStep] = useState<Step>("profile");
    const [loading, setLoading] = useState(false);
    const { register, handleSubmit, formState: { errors } } = useForm<{ name: string }>();

    const onProfileSubmit = async ({ name }: { name: string }) => {
        setLoading(true);
        try {
            await userAPI.updateProfile({ name });
            dispatch(updateUser({ name }));
            setStep("keys");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            {step === "profile" && (
                <>
                    <div>
                        <h2 className="text-xl font-bold text-text-primary mb-1">Set up your profile</h2>
                        <p className="text-text-muted text-sm">How should others see you?</p>
                    </div>
                    <form onSubmit={handleSubmit(onProfileSubmit)} className="flex flex-col gap-4">
                        <Input
                            label="Your name"
                            placeholder="Enter your name"
                            error={errors.name?.message}
                            {...register("name", { required: "Name is required", minLength: { value: 1, message: "Name cannot be empty" } })}
                        />
                        <Button type="submit" loading={loading} size="lg" className="w-full">
                            Continue
                        </Button>
                    </form>
                </>
            )}

            {step === "keys" && (
                <KeyGeneration onComplete={() => router.push("/conversations")} />
            )}
        </div>
    );
}