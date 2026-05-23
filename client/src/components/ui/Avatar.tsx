interface AvatarProps {
    src?: string;
    name?: string;
    size?: "xs" | "sm" | "md" | "lg";
    isOnline?: boolean;
}

const COLORS = ["bg-indigo-500", "bg-violet-500", "bg-cyan-500", "bg-emerald-500", "bg-pink-500", "bg-amber-500"];

export const Avatar = ({ src, name, size = "md", isOnline }: AvatarProps) => {
    const sizes = { xs: "w-6 h-6 text-xs", sm: "w-8 h-8 text-sm", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" };
    const initials = name ? name.charAt(0).toUpperCase() : "?";
    const colorIdx = name ? name.charCodeAt(0) % COLORS.length : 0;

    return (
        <div className="relative shrink-0">
            <div className={`${sizes[size]} rounded-full overflow-hidden flex items-center justify-center ${COLORS[colorIdx]} text-white font-semibold`}>
                {src ? <img src={src} alt={name} className="w-full h-full object-cover" /> : initials}
            </div>
            {isOnline !== undefined && (
                <span className={`absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full border-2 border-surface ${isOnline ? "bg-green-500" : "bg-gray-400"}`} />
            )}
        </div>
    );
};