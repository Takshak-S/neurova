interface BadgeProps { count: number; max?: number; }

export const Badge = ({ count, max = 99 }: BadgeProps) => {
    if (count === 0) return null;
    return (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {count > max ? `${max}+` : count}
        </span>
    );
};