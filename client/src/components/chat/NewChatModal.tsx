"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/hooks";
import { createConversation } from "@/store/slices/conversation.slice";
import { setNewChatModalOpen } from "@/store/slices/ui.slice";
import { userAPI } from "@/lib/api/user.api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { User } from "@/types/api.types";
import { extractErrorMessage } from "@/lib/api/client";

export const NewChatModal = () => {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const [phone, setPhone] = useState("");
    const [found, setFound] = useState<User | null>(null);
    const [searching, setSearching] = useState(false);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const close = () => dispatch(setNewChatModalOpen(false));

    const search = async () => {
        if (!phone) return;
        setSearching(true);
        setError(null);
        setFound(null);
        try {
            const res = await userAPI.searchByPhone(phone);
            if (res.data.data.user) setFound(res.data.data.user);
            else setError("No user found with that number");
        } catch (err) {
            setError(extractErrorMessage(err));
        } finally {
            setSearching(false);
        }
    };

    const startChat = async () => {
        if (!found) return;
        setStarting(true);
        try {
            const result = await dispatch(createConversation(found.id));
            if (createConversation.fulfilled.match(result)) {
                router.push(`/conversations/${result.payload._id}`);
                close();
            }
        } finally {
            setStarting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={close}>
            <div className="bg-surface rounded-2xl border border-border shadow-xl w-full max-w-sm p-6 flex flex-col gap-5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-text-primary">New Chat</h2>
                    <button onClick={close} className="text-text-muted hover:text-text-primary p-1">✕</button>
                </div>
                <div className="flex gap-2">
                    <input value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && search()} placeholder="+919876543210" type="tel" className="flex-1 px-4 py-3 rounded-xl border border-border bg-surface-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                    <Button onClick={search} loading={searching} size="md">Search</Button>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                {found && (
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-elevated border border-border">
                        <Avatar src={found.avatar} name={found.name ?? found.phone} />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-text-primary text-sm truncate">{found.name ?? "Unknown"}</p>
                            <p className="text-xs text-text-muted truncate">{found.phone}</p>
                        </div>
                        <Button size="sm" onClick={startChat} loading={starting}>Message</Button>
                    </div>
                )}
            </div>
        </div>
    );
};