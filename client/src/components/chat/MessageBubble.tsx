"use client";
import { useEffect } from "react";
import { Message } from "@/types/api.types";
import { useEncryption } from "@/hooks/useEncryption";

interface MessageBubbleProps { message: Message; isSent: boolean; }

export const MessageBubble = ({ message, isSent }: MessageBubbleProps) => {
    const { decryptMessage } = useEncryption();

    useEffect(() => {
        if (!message.decryptedText && !message.isDeleted) decryptMessage(message);
    }, [message._id]);

    const statusIcon = isSent ? message.isFailed ? "❌" : message.isPending ? "🕐" : message.status === "read" ? "✓✓" : "✓" : null;

    return (
        <div className={`flex ${isSent ? "justify-end" : "justify-start"} mb-1 px-4`}>
            <div className={`relative max-w-[70%] px-4 py-2.5 rounded-2xl ${isSent ? "bg-bubble-sent text-bubble-sent-text rounded-br-sm" : "bg-bubble-received text-bubble-received-text rounded-bl-sm"} ${message.isPending ? "opacity-70" : ""} ${message.isFailed ? "opacity-50" : ""}`}>
                {message.isDeleted ? (
                    <span className="italic opacity-60 text-sm">Message deleted</span>
                ) : message.decryptedText ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.decryptedText}</p>
                ) : (
                    <div className="h-4 w-24 bg-current opacity-20 rounded animate-pulse" />
                )}
                <div className={`flex items-center justify-end gap-1 mt-1 ${isSent ? "text-white/70" : "text-text-muted"}`}>
                    <span className="text-[10px]">{new Date(message.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
                    {statusIcon && <span className={`text-xs ${message.status === "read" ? "text-blue-300" : ""}`}>{statusIcon}</span>}
                </div>
            </div>
        </div>
    );
};