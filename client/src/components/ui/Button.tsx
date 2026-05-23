import { ButtonHTMLAttributes, forwardRef } from "react";
import { Spinner } from "./Spinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "ghost" | "danger";
    size?: "sm" | "md" | "lg";
    loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = "primary", size = "md", loading, disabled, children, className = "", ...props }, ref) => {
        const base = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";
        const variants = {
            primary: "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
            ghost: "text-text-primary hover:bg-surface-elevated",
            danger: "bg-red-500 text-white hover:bg-red-600",
        };
        const sizes = { sm: "text-sm px-3 py-1.5 gap-1.5", md: "text-sm px-4 py-2.5 gap-2", lg: "text-base px-6 py-3 gap-2" };

        return (
            <button ref={ref} disabled={disabled || loading} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
                {loading ? <Spinner size="sm" /> : children}
            </button>
        );
    }
);
Button.displayName = "Button";