export const TypingIndicator = () => (
    <div className="flex justify-start px-4 mb-2">
        <div className="bg-bubble-received px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
            {[0, 1, 2].map(i => (
                <span key={i} className="typing-dot w-2 h-2 rounded-full bg-text-muted animate-typing-dot" style={{ animationDelay: `${i * 0.2}s` }} />
            ))}
        </div>
    </div>
);