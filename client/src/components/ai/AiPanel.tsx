"use client";
import { useAppSelector } from "@/store/hooks";
import { useAI } from "@/hooks/useAI";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { SummaryView } from "./SummaryView";
import { SmartReplies } from "./SmartReplies";
import { TaskList } from "./TaskList";
import { AIFeature } from "@/types/api.types";

interface AIPanelProps {
    conversationId: string;
    onReplySelect?: (text: string) => void;
}

const FEATURES: { id: AIFeature; label: string; icon: string; description: string }[] = [
    { id: "summarize", label: "Summarize", icon: "📝", description: "Get a quick summary of this conversation" },
    { id: "reply", label: "Smart Reply", icon: "💬", description: "Get 3 context-aware reply suggestions" },
    { id: "tasks", label: "Extract Tasks", icon: "✅", description: "Pull out action items from the chat" },
];

export const AIPanel = ({ conversationId, onReplySelect }: AIPanelProps) => {
    const { process, result, loading, error, dismiss } = useAI(conversationId);
    const activeFeature = useAppSelector(s => s.ui.aiFeature);

    return (
        <div className="flex flex-col h-full bg-surface border-l border-border w-80 shrink-0 animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🤖</span>
                    <span className="font-semibold text-text-primary text-sm">AI Assistant</span>
                </div>
                <button
                    onClick={dismiss}
                    className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-lg hover:bg-surface-elevated"
                >
                    ✕
                </button>
            </div>

            {/* Feature buttons */}
            {!result && (
                <div className="p-4 flex flex-col gap-2">
                    <p className="text-xs text-text-muted mb-2 font-medium uppercase tracking-wide">Choose a feature</p>
                    {FEATURES.map(f => (
                        <button
                            key={f.id}
                            onClick={() => process(f.id)}
                            disabled={loading}
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left hover:bg-surface-elevated disabled:opacity-50 ${activeFeature === f.id ? "border-primary bg-primary/5" : "border-border"}`}
                        >
                            <span className="text-2xl">{f.icon}</span>
                            <div>
                                <p className="text-sm font-medium text-text-primary">{f.label}</p>
                                <p className="text-xs text-text-muted">{f.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Loading state */}
            {loading && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-text-muted">
                    <Spinner size="lg" />
                    <p className="text-sm">Processing with AI...</p>
                    <p className="text-xs">Messages are decrypted only for this request</p>
                </div>
            )}

            {/* Error state */}
            {error && !loading && (
                <div className="p-4 flex flex-col gap-3">
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <p className="text-sm text-red-500">{error}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => activeFeature && process(activeFeature)}>
                        Try again
                    </Button>
                    <Button variant="ghost" size="sm" onClick={dismiss}>Back</Button>
                </div>
            )}

            {/* Results */}
            {result && !loading && (
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                    {result.feature === "summarize" && <SummaryView summary={result.result} />}
                    {result.feature === "reply" && (
                        <SmartReplies
                            replies={result.result}
                            onSelect={text => { onReplySelect?.(text); dismiss(); }}
                        />
                    )}
                    {result.feature === "tasks" && <TaskList tasks={result.result} />}

                    {/* Privacy note */}
                    <p className="text-[10px] text-text-muted text-center leading-relaxed">
                        🔒 Messages were decrypted locally and sent to the AI. Results are not stored.
                    </p>

                    <Button variant="ghost" size="sm" onClick={() => { /* reset result */ dismiss(); }}>
                        ← Back
                    </Button>
                </div>
            )}
        </div>
    );
};