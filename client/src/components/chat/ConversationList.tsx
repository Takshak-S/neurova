"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { useConversations } from "@/hooks/useConversations";
import { ConversationItem } from "./ConversationItem";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { setNewChatModalOpen } from "@/store/slices/ui.slice";
import { setTheme } from "@/store/slices/ui.slice";
import { NewChatModal } from "./NewChatModal";
import { Spinner } from "@/components/ui/Spinner";

export const ConversationList = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [search, setSearch] = useState("");
  const { conversations, loading, activeConversationId, setActive } = useConversations();
  const currentUser = useAppSelector(s => s.auth.user);
  const theme = useAppSelector(s => s.ui.theme);
  const newChatOpen = useAppSelector(s => s.ui.newChatModalOpen);

  const filtered = conversations.filter(c => {
    if (!search) return c.status !== "rejected";
    const other = c.members.find(m => m.id !== currentUser?.id);
    const name = other?.name ?? other?.phone ?? "";
    return name.toLowerCase().includes(search.toLowerCase()) && c.status !== "rejected";
  });

  const handleSelect = (id: string) => {
    setActive(id);
    router.push(`/conversations/${id}`);
  };

  const cycleTheme = () => {
    const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    dispatch(setTheme(next));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border h-[60px]">
        <div className="flex items-center gap-2">
          <Avatar src={currentUser?.avatar} name={currentUser?.name ?? currentUser?.phone} size="sm" />
          <span className="font-bold text-text-primary">Neurova</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={cycleTheme} className="p-2 rounded-xl hover:bg-surface-elevated transition-colors text-base" title="Toggle theme">
            {theme === "dark" ? "☀️" : theme === "light" ? "🌙" : "💻"}
          </button>
          <Button size="sm" variant="ghost" onClick={() => dispatch(setNewChatModalOpen(true))}>
            ✏️
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="w-full px-3 py-2 rounded-xl bg-surface-elevated text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary border border-transparent"
        />
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading && filtered.length === 0 ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm px-4">
            <p className="text-2xl mb-2">💬</p>
            {search ? "No conversations match your search" : "No conversations yet. Start one!"}
          </div>
        ) : (
          filtered.map(conv => (
            <ConversationItem
              key={conv._id}
              conversation={conv}
              isActive={conv._id === activeConversationId}
              currentUserId={currentUser?.id ?? ""}
              onClick={() => handleSelect(conv._id)}
            />
          ))
        )}
      </div>

      {newChatOpen && <NewChatModal />}
    </div>
  );
};
