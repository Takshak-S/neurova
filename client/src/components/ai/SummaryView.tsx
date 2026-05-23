interface SummaryViewProps { summary: string; }

export const SummaryView = ({ summary }: SummaryViewProps) => (
    <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
            <span>📝</span>
            <h3 className="font-semibold text-text-primary text-sm">Summary</h3>
        </div>
        <div className="p-4 rounded-xl bg-surface-elevated border border-border">
            <p className="text-sm text-text-primary leading-relaxed">{summary}</p>
        </div>
    </div>
);
