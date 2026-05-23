"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { setActiveConversation } from "@/store/slices/conversation.slice";
import { markConversationRead } from "@/store/slices/message.slice";
import { openAIPanel, closeAIPanel } from "@/store/slices/ui.slice";
import { useMessages } from "@/hooks/useMessages";
import { useSocket } from "@/hooks/useSocket";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { MessageRequestBanner } from "@/components/chat/MessageRequestBanner";
import { Avatar } from "@/components/ui/Avatar";
import { AIPanel } from "@/components/ai/AiPanel";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

export default function ChatPage() {
    const params = useParams();
    const conversationId = params.id as string;
    const dispatch = useAppDispatch();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [replyText, setReplyText] = useState("");

    const currentUserId = useAppSelector(s => s.auth.user?.id) ?? "";
    const conversation = useAppSelector(s =>
        s.conversations.conversations.find(c => c._id === conversationId)
    );
    const typingUsers = useAppSelector(s => s.socket.typingUsers[conversationId] ?? []);
    const isTyping = typingUsers.length > 0;
    const aiPanelOpen = useAppSelector(s => s.ui.aiPanelOpen);

    const otherMember = conversation?.members.find(m => m.id !== currentUserId);
    const { messages, hasMore, loading, loadMore, sendMessage } = useMessages(
        conversationId,
        otherMember?.id ?? ""
    );
    const { joinConversation } = useSocket();

    useEffect(() => {
        dispatch(setActiveConversation(conversationId));
        joinConversation(conversationId);
        dispatch(markConversationRead(conversationId));
        return () => { dispatch(setActiveConversation(null)); };
    }, [conversationId]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages.length]);

    const isPending = conversation?.status === "pending";
    const isRecipient = conversation?.requestedBy !== currentUserId;
    const showBanner = isPending && isRecipient;
    const inputDisabled = isPending && !isRecipient;

    const displayName = conversation?.type === "group"
        ? conversation.groupName ?? "Group"
        : otherMember?.name ?? otherMember?.phone ?? "Unknown";

    if (!conversation) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="flex flex-1 min-w-0 overflow-hidden">
            {/* Chat area */}
            <div className="flex flex-col flex-1 min-w-0">
                {/* Header */}
                <header className="flex items-center justify-between px-4 border-b border-border bg-surface h-[60px] shrink-0">
                    <div className="flex items-center gap-3">
                        <Avatar
                            src={otherMember?.avatar}
                            name={displayName}
                            isOnline={otherMember?.isOnline}
                        />
                        <div>
                            <p className="font-semibold text-text-primary text-sm">{displayName}</p>
                            <p className="text-xs text-text-muted">
                                {otherMember?.isOnline ? "Online" : "Offline"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => aiPanelOpen ? dispatch(closeAIPanel()) : dispatch(openAIPanel("summarize"))}
                            className="text-lg"
                            title="AI Assistant"
                        >
                            🤖
                        </Button>
                    </div>
                </header>

                {/* Message request banner */}
                {showBanner && (
                    <MessageRequestBanner
                        conversationId={conversationId}
                        requesterName={otherMember?.name}
                    />
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto py-4 flex flex-col">
                    {/* Load more button */}
                    {hasMore && (
                        <div className="flex justify-center py-3">
                            <Button variant="ghost" size="sm" onClick={loadMore} loading={loading}>
                                Load earlier messages
                            </Button>
                        </div>
                    )}

                    {loading && messages.length === 0 && (
                        <div className="flex justify-center py-8">
                            <Spinner />
                        </div>
                    )}

                    {messages.map(message => (
                        <MessageBubble
                            key={message._id}
                            message={message}
                            isSent={message.senderId === currentUserId}
                        />
                    ))}

                    {isTyping && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <MessageInput
                    conversationId={conversationId}
                    onSend={async (text) => {
                        await sendMessage(replyText || text);
                        setReplyText("");
                    }}
                    disabled={inputDisabled}
                />
            </div>

            {/* AI Panel */}
            {aiPanelOpen && (
                <AIPanel
                    conversationId={conversationId}
                    onReplySelect={setReplyText}
                />
            )}
        </div>
    );
}