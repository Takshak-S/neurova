export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-primary mb-1">Neurova</h1>
                    <p className="text-text-muted text-sm">AI-powered encrypted messaging</p>
                </div>
                <div className="bg-surface rounded-2xl border border-border shadow-sm p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}