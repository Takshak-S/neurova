"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector } from "@/store/hooks";
import { useSocket } from "@/hooks/useSocket";
import { ConversationList } from "@/components/chat/ConversationList";

// useSocket must be called here — at the top of the authenticated layout —
// so the connection is established once and shared across all child pages.
function SocketInitializer() {
    useSocket();
    return null;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { isAuthenticated } = useAppSelector(s => s.auth);

    useEffect(() => {
        if (!isAuthenticated) router.replace("/login");
    }, [isAuthenticated, router]);

    if (!isAuthenticated) return null;

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <SocketInitializer />
            {/* Sidebar */}
            <aside className="w-[360px] shrink-0 flex flex-col border-r border-border bg-surface">
                <ConversationList />
            </aside>
            {/* Main content area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {children}
            </main>
        </div>
    );
}