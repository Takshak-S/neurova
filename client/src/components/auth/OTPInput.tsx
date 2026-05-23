"use client";
import { useRef, KeyboardEvent, ClipboardEvent } from "react";

interface OTPInputProps {
    value: string;
    onChange: (val: string) => void;
    length?: number;
    disabled?: boolean;
    error?: boolean;
}

export const OTPInput = ({ value, onChange, length = 6, disabled, error }: OTPInputProps) => {
    const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

    const handleChange = (idx: number, val: string) => {
        if (!/^\d*$/.test(val)) return;
        const digits = value.split("");
        digits[idx] = val.slice(-1);
        onChange(digits.join("").slice(0, length));
        if (val && idx < length - 1) inputsRef.current[idx + 1]?.focus();
    };

    const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !value[idx] && idx > 0) inputsRef.current[idx - 1]?.focus();
    };

    const handlePaste = (e: ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        onChange(pasted);
        inputsRef.current[Math.min(pasted.length, length - 1)]?.focus();
    };

    return (
        <div className="flex gap-3 justify-center">
            {Array.from({ length }).map((_, i) => (
                <input
                    key={i}
                    ref={el => { inputsRef.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={value[i] ?? ""}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    disabled={disabled}
                    className={`otp-input ${value[i] ? "filled" : ""} ${error ? "border-destructive" : ""} disabled:opacity-50`}
                />
            ))}
        </div>
    );
};