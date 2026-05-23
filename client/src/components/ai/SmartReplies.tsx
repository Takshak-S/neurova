interface SmartRepliesProps { replies: string[]; onSelect: (text: string) => void; }

export const SmartReplies = ({ replies, onSelect }: SmartRepliesProps) => (
    <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
            <span>💬</span>
            <h3 className="font-semibold text-text-primary text-sm">Suggested Replies</h3>
        </div>
        <div className="flex flex-col gap-2">
            {replies.map((reply, i) => (
                <button
                    key={i}
                    onClick={() => onSelect(reply)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-border bg-surface-elevated hover:border-primary hover:bg-primary/5 transition-all text-sm text-text-primary"
                >
                    {reply}
                </button>
            ))}
        </div>
        <p className="text-xs text-text-muted">Tap to use as your reply</p>
    </div>
);