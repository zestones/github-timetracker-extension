import { useState, useEffect } from 'preact/hooks';
import { ActiveTimer } from '../components/ActiveTimer.jsx';
import { IssuesTab } from './views/IssuesTab.jsx';
import { StatsTab } from './views/StatsTab.jsx';
import { CalendarView } from './views/CalendarView.jsx';
import { Settings } from '../components/Settings.jsx';
import { Modal } from '../components/Modal.jsx';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { StorageService } from '../utils/storage.js';
import { IssueStorageService } from '../utils/issue-storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import { useStorageListener } from '../hooks/useStorageListener.js';
import { useTheme } from '../hooks/useTheme.js';
import { useAuth } from '../hooks/useAuth.js';
import { syncFromGitHub } from '../utils/sync.js';
import { IconIssues, IconChart, IconCalendar, IconSettings, IconGitHub } from '../icons.jsx';
import './App.css';

export function App() {
    const [page, setPage] = useState('issues');
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const tracked = useStorageListener(STORAGE_KEYS.TRACKED_TIMES, []);
    const { theme, isDark, setTheme } = useTheme();
    const { token, maskedToken, user, tokenLoaded, tokenInput, tokenError, setTokenInput, saveToken, handleTokenChange } = useAuth();

    // Auto-sync on popup open when enabled
    useEffect(() => {
        if (!token) return;
        StorageService.get(STORAGE_KEYS.AUTO_SYNC).then(autoSync => {
            if (autoSync) {
                syncFromGitHub().catch(e => console.error('Auto-sync failed:', e));
            }
        });
    }, [token]);

    const confirmClear = async () => {
        await StorageService.remove(STORAGE_KEYS.TRACKED_TIMES);
        await StorageService.remove(STORAGE_KEYS.EVERYONE_DATA);
        await IssueStorageService.removeAll();
        setShowClearConfirm(false);
    };

    if (!tokenLoaded) return (
        <div className={`w-100 h-140 flex items-center justify-center font-['Inter',system-ui,sans-serif] bg-base ${isDark ? 'dark' : ''}`}>
            <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-[12px] text-muted">Loading…</span>
            </div>
        </div>
    );

    if (!token) {
        return (
            <div className={`w-100 h-140 flex flex-col items-center justify-center px-10 font-['Inter',system-ui,sans-serif] bg-base ${isDark ? 'dark' : ''}`}>
                <div className="text-primary mb-5">
                    <IconGitHub size={48} />
                </div>
                <h1 className="text-xl font-semibold text-primary mb-1">Time Tracker</h1>
                <p className="text-[13px] text-tertiary text-center mb-8 leading-relaxed">
                    Track time spent on GitHub issues<br />directly from your browser.
                </p>
                <div className="w-full">
                    <input
                        type="password"
                        value={tokenInput}
                        onInput={(e) => setTokenInput(e.currentTarget.value)}
                        placeholder="GitHub Personal Access Token"
                        className="w-full px-3.5 py-2.5 text-[13px] bg-surface border border-border-default rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary placeholder:text-muted mb-2"
                    />
                    {tokenError && <p className="text-[11px] text-danger-text mb-2">{tokenError}</p>}
                    <button
                        onClick={saveToken}
                        className="w-full bg-accent hover:bg-accent-hover text-white text-[13px] font-medium py-2.5 rounded-lg cursor-pointer transition-colors"
                    >
                        Connect
                    </button>
                </div>
                <p className="text-[11px] text-muted mt-6 text-center">
                    Requires a token with <span className="font-medium text-tertiary">repo</span> scope.
                </p>
            </div>
        );
    }

    const navItems = [
        { id: 'issues', icon: IconIssues, label: 'Issues' },
        { id: 'stats', icon: IconChart, label: 'Stats' },
        { id: 'calendar', icon: IconCalendar, label: 'Calendar' },
        { id: 'settings', icon: IconSettings, label: 'Settings' },
    ];

    return (
        <div className={`w-100 h-140 flex flex-col font-['Inter',system-ui,sans-serif] bg-base overflow-hidden ${isDark ? 'dark' : ''}`}>
            {/* Header */}
            <header className="flex items-center justify-between px-4 h-11 border-b border-border-subtle shrink-0">
                <h1 className="text-[13px] font-semibold text-primary tracking-tight">Time Tracker</h1>
                {user?.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt={user.login}
                        title={user.login}
                        className="w-6 h-6 rounded-full ring-1 ring-ring-default"
                    />
                ) : (
                    <div className="w-6 h-6 rounded-full bg-surface" />
                )}
            </header>

            {/* Active Timer Banner */}
            <ActiveTimer />

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto popup-scroll">
                <ErrorBoundary>
                    {page === 'issues' && <IssuesTab />}
                    {page === 'stats' && <StatsTab tracked={tracked} user={user} />}
                    {page === 'calendar' && <CalendarView tracked={tracked} />}
                    {page === 'settings' && (
                        <Settings
                            token={token}
                            maskedToken={maskedToken}
                            user={user}
                            onTokenChange={handleTokenChange}
                            onClearData={() => setShowClearConfirm(true)}
                            theme={theme}
                            onThemeChange={setTheme}
                        />
                    )}
                </ErrorBoundary>
            </main>

            {/* Bottom Navigation */}
            <nav className="flex items-center border-t border-border-subtle shrink-0">
                {navItems.map(({ id, icon: Icon, label }) => (
                    <button
                        key={id}
                        onClick={() => setPage(id)}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 cursor-pointer transition-colors ${page === id ? 'text-accent' : 'text-muted hover:text-secondary'
                            }`}
                    >
                        <Icon size={18} />
                        <span className="text-[10px] font-medium">{label}</span>
                    </button>
                ))}
            </nav>

            {showClearConfirm && (
                <Modal
                    title="Clear all data"
                    message="This will permanently delete all tracked times and issue data. This action cannot be undone."
                    confirmLabel="Clear Data"
                    confirmVariant="danger"
                    onConfirm={confirmClear}
                    onCancel={() => setShowClearConfirm(false)}
                />
            )}
        </div>
    );
}