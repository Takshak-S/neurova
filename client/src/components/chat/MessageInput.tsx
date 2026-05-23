"use client";
import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { useSocket } from "@/hooks/useSocket";

interface MessageInputProps { conversationId: string; onSend: (text: string) => Promise<void>; disabled?: boolean; }

export const MessageInput = ({ conversationId, onSend, disabled }: MessageInputProps) => {
    const [text, setText] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { emitTyping, emitStopTyping } = useSocket();
    const typingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const handleChange = (val: string) => {
        setText(val);
        emitTyping(conversationId);
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => emitStopTyping(conversationId), 2000);
    };

    const handleSend = useCallback(async () => {
        const trimmed = text.trim();
        if (!trimmed || sending) return;
        setSending(true);
        setError(null);
        setText("");
        emitStopTyping(conversationId);
        try {
            await onSend(trimmed);
        } catch {
            setError("Failed to send. Tap to retry.");
            setText(trimmed);
        } finally {
            setSending(false);
        }
    }, [text, sending, onSend, conversationId, emitStopTyping]);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    return (
        <div className="border-t border-border bg-surface px-4 py-3">
            {error && <p className="text-xs text-destructive mb-2">{error}</p>}
            <div className="flex items-end gap-3">
                <textarea
                    value={text}
                    onChange={e => handleChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message"
                    disabled={disabled || sending}
                    rows={1}
                    className="flex-1 resize-none bg-surface-elevated text-text-primary placeholder:text-text-muted rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary max-h-32 overflow-y-auto disabled:opacity-50 transition-all"
                    style={{ height: "auto", minHeight: "44px" }}
                    onInput={e => {
                        const t = e.target as HTMLTextAreaElement;
                        t.style.height = "auto";
                        t.style.height = `${Math.min(t.scrollHeight, 128)}px`;
                    }}
                />
                <Button onClick={handleSend} disabled={!text.trim() || disabled} loading={sending} className="shrink-0 w-11 h-11 rounded-full p-0 flex items-center justify-center">↑</Button>
            </div>
        </div>
    );
};