"use client";
import { Button } from "@/components/ui/Button";
import { useAppDispatch } from "@/store/hooks";
import { acceptRequest, rejectRequest } from "@/store/slices/conversation.slice";

interface MessageRequestBannerProps { conversationId: string; requesterName?: string; }

export const MessageRequestBanner = ({ conversationId, requesterName }: MessageRequestBannerProps) => {
    const dispatch = useAppDispatch();
    return (
        <div className="bg-surface-elevated border-b border-border px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-text-secondary">
                <span className="font-medium text-text-primary">{requesterName ?? "Someone"}</span> wants to message you
            </p>
            <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => dispatch(rejectRequest(conversationId))}>Decline</Button>
                <Button size="sm" onClick={() => dispatch(acceptRequest(conversationId))}>Accept</Button>
            </div>
        </div>
    );
};