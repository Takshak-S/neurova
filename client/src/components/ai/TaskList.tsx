import { useState } from "react";

interface TaskListProps { tasks: string[]; }

export const TaskList = ({ tasks }: TaskListProps) => {
    const [done, setDone] = useState<Set<number>>(new Set());
    const toggle = (i: number) => setDone(prev => {
        const next = new Set(prev);
        next.has(i) ? next.delete(i) : next.add(i);
        return next;
    });

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <span>✅</span>
                <h3 className="font-semibold text-text-primary text-sm">Action Items</h3>
                <span className="ml-auto text-xs text-text-muted">{tasks.length} found</span>
            </div>
            {tasks.length === 0 ? (
                <div className="p-4 rounded-xl bg-surface-elevated border border-border text-center">
                    <p className="text-sm text-text-muted">No action items found in this conversation</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {tasks.map((task, i) => (
                        <button
                            key={i}
                            onClick={() => toggle(i)}
                            className="flex items-start gap-3 p-3 rounded-xl border border-border bg-surface-elevated text-left transition-all hover:border-primary/50"
                        >
                            <span className={`mt-0.5 text-base shrink-0 ${done.has(i) ? "text-green-500" : "text-text-muted"}`}>
                                {done.has(i) ? "✓" : "○"}
                            </span>
                            <span className={`text-sm text-text-primary leading-relaxed ${done.has(i) ? "line-through opacity-50" : ""}`}>
                                {task}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};