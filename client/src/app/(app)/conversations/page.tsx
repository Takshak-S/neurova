export default function ConversationsPage() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 p-8">
            <div className="text-6xl mb-2">💬</div>
            <h2 className="text-xl font-semibold text-text-primary">Your messages</h2>
            <p className="text-text-muted text-sm max-w-xs leading-relaxed">
                Select a conversation from the sidebar or search for someone by phone number to start chatting.
            </p>
            <p className="text-xs text-text-muted">🔒 All messages are end-to-end encrypted</p>
        </div>
    );
}