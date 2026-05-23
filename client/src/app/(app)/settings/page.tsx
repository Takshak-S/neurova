"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout, updateUser } from "@/store/slices/auth.slice";
import { setTheme } from "@/store/slices/ui.slice";
import { userAPI } from "@/lib/api/user.api";
import { keyManager } from "@/lib/crypto/keyManager";
import { socketClient } from "@/lib/socket/socket.client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

export default function SettingsPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const user = useAppSelector(s => s.auth.user);
    const theme = useAppSelector(s => s.ui.theme);
    const [name, setName] = useState(user?.name ?? "");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const saveProfile = async () => {
        setSaving(true);
        await userAPI.updateProfile({ name });
        dispatch(updateUser({ name }));
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleLogout = () => {
        socketClient.disconnect();
        dispatch(logout());
        router.replace("/login");
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto w-full">
            <h1 className="text-2xl font-bold text-text-primary mb-8">Settings</h1>

            {/* Profile */}
            <section className="bg-surface rounded-2xl border border-border p-5 mb-4">
                <h2 className="font-semibold text-text-primary mb-4">Profile</h2>
                <div className="flex items-center gap-4 mb-5">
                    <Avatar src={user?.avatar} name={user?.name ?? user?.phone} size="lg" />
                    <div>
                        <p className="font-medium text-text-primary">{user?.name ?? "No name set"}</p>
                        <p className="text-sm text-text-muted">{user?.phone}</p>
                    </div>
                </div>
                <Input label="Display name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                <Button onClick={saveProfile} loading={saving} className="mt-3 w-full">
                    {saved ? "✓ Saved" : "Save changes"}
                </Button>
            </section>

            {/* Theme */}
            <section className="bg-surface rounded-2xl border border-border p-5 mb-4">
                <h2 className="font-semibold text-text-primary mb-4">Appearance</h2>
                <div className="flex gap-2">
                    {(["light", "dark", "system"] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => dispatch(setTheme(t))}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all capitalize ${theme === t ? "border-primary bg-primary/5 text-primary" : "border-border text-text-secondary hover:bg-surface-elevated"}`}
                        >
                            {t === "light" ? "☀️" : t === "dark" ? "🌙" : "💻"} {t}
                        </button>
                    ))}
                </div>
            </section>

            {/* Encryption */}
            <section className="bg-surface rounded-2xl border border-border p-5 mb-4">
                <h2 className="font-semibold text-text-primary mb-2">Encryption</h2>
                <p className="text-sm text-text-muted mb-4">
                    Your private key is stored locally on this device. It never leaves your browser.
                </p>
                <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 mb-4">
                    <span className="text-green-500">🔐</span>
                    <span className="text-sm text-green-500 font-medium">
                        {user?.publicKey ? "Encryption keys are set up" : "No encryption keys found"}
                    </span>
                </div>
                <p className="text-xs text-text-muted">
                    ⚠️ Clearing browser data will delete your private key. Old messages will become permanently unreadable.
                </p>
            </section>

            {/* Danger zone */}
            <section className="bg-surface rounded-2xl border border-red-500/20 p-5">
                <h2 className="font-semibold text-red-500 mb-4">Account</h2>
                <Button variant="danger" onClick={handleLogout} className="w-full">
                    Sign out
                </Button>
            </section>
        </div>
    );
}