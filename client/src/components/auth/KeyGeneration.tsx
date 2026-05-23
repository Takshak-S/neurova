"use client";
import { useState } from "react";
import { keyManager } from "@/lib/crypto/keyManager";
import { userAPI } from "@/lib/api/user.api";
import { Button } from "@/components/ui/Button";
import { useAppDispatch } from "@/store/hooks";
import { updateUser } from "@/store/slices/auth.slice";

interface KeyGenerationProps { onComplete: () => void; }

export const KeyGeneration = ({ onComplete }: KeyGenerationProps) => {
    const dispatch = useAppDispatch();
    const [state, setState] = useState<"idle" | "generating" | "done" | "error">("idle");
    const [error, setError] = useState<string | null>(null);

    const generate = async () => {
        setState("generating");
        setError(null);
        try {
            const publicKey = await keyManager.generateAndStore();
            await userAPI.registerPublicKey(publicKey);
            dispatch(updateUser({ publicKey }));
            setState("done");
            setTimeout(onComplete, 800);
        } catch {
            setState("error");
            setError("Key generation failed. Please try again.");
        }
    };

    return (
        <div className="flex flex-col items-center gap-6 text-center p-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-4xl">🔐</div>
            <div>
                <h2 className="text-xl font-bold text-text-primary mb-2">Set up encryption</h2>
                <p className="text-text-secondary text-sm leading-relaxed max-w-xs">
                    Neurova uses end-to-end encryption. Your private key is generated on this device and never leaves it.
                </p>
            </div>
            {state === "done" && <div className="flex items-center gap-2 text-green-500 font-medium"><span>✓</span> Keys generated securely</div>}
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button onClick={generate} loading={state === "generating"} disabled={state === "done"} size="lg" className="w-full">
                {state === "idle" ? "Generate encryption keys" : state === "generating" ? "Generating..." : "Done"}
            </Button>
            <p className="text-xs text-text-muted">⚠️ Clearing your browser data will delete your private key and make old messages unreadable.</p>
        </div>
    );
};