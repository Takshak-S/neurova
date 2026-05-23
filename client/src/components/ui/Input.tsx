import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, className = "", ...props }, ref) => (
        <div className="flex flex-col gap-1.5 w-full">
            {label && <label className="text-sm font-medium text-text-secondary">{label}</label>}
            <input
                ref={ref}
                className={`w-full px-4 py-3 rounded-xl border bg-surface text-text-primary placeholder:text-text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${error ? "border-destructive" : "border-border"} ${className}`}
                {...props}
            />
            {error && <span className="text-xs text-destructive">{error}</span>}
        </div>
    )
);
