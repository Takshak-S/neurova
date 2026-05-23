"use client";
import { Conversation } from "@/types/api.types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useAppSelector } from "@/store/hooks";
import { formatDistanceToNow } from "@/lib/utils/date";

interface ConversationItemProps {
    conversation: Conversation;
    isActive: boolean;
    currentUserId: string;
    onClick: () => void;
}

export const ConversationItem = ({ conversation, isActive, currentUserId, onClick }: ConversationItemProps) => {
    const otherMember = conversation.members.find(m => m.id !== currentUserId);
    const typingUsers = useAppSelector(s => s.socket.typingUsers[conversation._id] ?? []);
    const isTyping = typingUsers.length > 0;

    const displayName = conversation.type === "group"
        ? conversation.groupName ?? "Group"
        : otherMember?.name ?? otherMember?.phone ?? "Unknown";

    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-elevated ${isActive ? "bg-surface-elevated border-l-2 border-primary" : ""}`}
        >
            <Avatar src={conversation.type === "group" ? conversation.groupAvatar : otherMember?.avatar} name={displayName} isOnline={conversation.type === "direct" ? otherMember?.isOnline : undefined} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-text-primary truncate text-sm">{displayName}</span>
                    {conversation.lastMessage && <span className="text-xs text-text-muted shrink-0">{formatDistanceToNow(conversation.lastMessage.createdAt)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-text-secondary truncate">
                        {conversation.status === "pending" ? "📩 Message request" : isTyping ? "typing..." : conversation.lastMessage?.encryptedPreview ?? "🔒 Encrypted message"}
                    </span>
                </div>
            </div>
        </button>
    );
};