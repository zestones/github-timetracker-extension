import { useState, useEffect } from 'preact/hooks';
import { ActiveTimer } from '../components/ActiveTimer/ActiveTimer.jsx';
import { IssuesTab } from './Views/IssuesTab/IssuesTab.jsx';
import { StatsTab } from './Views/StatsTab/StatsTab.jsx';
import { CalendarView } from './Views/TrackedList/CalendarView.jsx';
import { Settings } from '../components/Settings/Settings.jsx';
import { Modal } from '../components/Modal/Modal.jsx';
import { GitHubStorageService } from '../utils/github-storage.js';
import { StorageService } from '../utils/storage.js';
import { IssueStorageService } from '../utils/issue-storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import { useStorageListener } from '../hooks/useStorageListener.js';
import { CacheService } from '../utils/cache.js';
import { GitHubService } from '../utils/github.js';
import { IconIssues, IconChart, IconCalendar, IconSettings, IconGitHub } from '../icons.jsx';
import './App.css';

export function App() {
    const [token, setToken] = useState('');
    const [maskedToken, setMaskedToken] = useState('no token');
    const [page, setPage] = useState('issues');
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [tokenLoaded, setTokenLoaded] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [tokenError, setTokenError] = useState('');
    const [user, setUser] = useState(null);

    const tracked = useStorageListener(STORAGE_KEYS.TRACKED_TIMES, []);

    useEffect(() => {
        const loadToken = async () => {
            const savedToken = await GitHubStorageService.getGitHubToken();
            if (savedToken) {
                setToken(savedToken);
                setMaskedToken(savedToken.slice(0, 4) + '••••••••');

                const cachedUser = await CacheService.getCachedUser();
                if (cachedUser) {
                    setUser(cachedUser);
                } else {
                    try {
                        const userData = await GitHubService.getUser();
                        const userInfo = { login: userData.login, avatar_url: userData.avatar_url, name: userData.name };
                        await CacheService.setCachedUser(userInfo);
                        setUser(userInfo);
                    } catch (e) {
                        console.error('Failed to fetch user:', e);
                    }
                }
            }
            setTokenLoaded(true);
        };
        loadToken();
    }, []);

    const handleTokenChange = (newToken) => {
        setToken(newToken);
        if (newToken) {
            setMaskedToken(newToken.slice(0, 4) + '••••••••');
            GitHubService.getUser().then(async (userData) => {
                const userInfo = { login: userData.login, avatar_url: userData.avatar_url, name: userData.name };
                await CacheService.setCachedUser(userInfo);
                setUser(userInfo);
            }).catch(() => setUser(null));
        } else {
            setMaskedToken('no token');
            setUser(null);
        }
    };

    const handleSaveToken = async () => {
        const isValid = await GitHubStorageService.validateGitHubToken(tokenInput);
        if (isValid) {
            await GitHubStorageService.setGitHubToken(tokenInput);
            handleTokenChange(tokenInput);
            setTokenInput('');
            setTokenError('');
        } else {
            setTokenError('Invalid token. Please check and try again.');
        }
    };

    const confirmClear = async () => {
        await StorageService.remove(STORAGE_KEYS.TRACKED_TIMES);
        await IssueStorageService.removeAll();
        setShowClearConfirm(false);
    };

    if (!tokenLoaded) return null;

    if (!token) {
        return (
            <div className="w-[400px] h-[560px] flex flex-col items-center justify-center px-10 font-['Inter',system-ui,sans-serif] bg-white">
                <div className="text-slate-900 mb-5">
                    <IconGitHub size={48} />
                </div>
                <h1 className="text-xl font-semibold text-slate-900 mb-1">Time Tracker</h1>
                <p className="text-[13px] text-slate-500 text-center mb-8 leading-relaxed">
                    Track time spent on GitHub issues<br />directly from your browser.
                </p>
                <div className="w-full">
                    <input
                        type="password"
                        value={tokenInput}
                        onInput={(e) => setTokenInput(e.target.value)}
                        placeholder="GitHub Personal Access Token"
                        className="w-full px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 placeholder:text-slate-400 mb-2"
                    />
                    {tokenError && <p className="text-[11px] text-red-600 mb-2">{tokenError}</p>}
                    <button
                        onClick={handleSaveToken}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-medium py-2.5 rounded-lg cursor-pointer transition-colors"
                    >
                        Connect
                    </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-6 text-center">
                    Requires a token with <span className="font-medium text-slate-500">repo</span> scope.
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
        <div className="w-[400px] h-[560px] flex flex-col font-['Inter',system-ui,sans-serif] bg-white overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-4 h-11 border-b border-slate-100 shrink-0">
                <h1 className="text-[13px] font-semibold text-slate-900 tracking-tight">Time Tracker</h1>
                {user?.avatar_url ? (
                    <img
                        src={user.avatar_url}
                        alt={user.login}
                        title={user.login}
                        className="w-6 h-6 rounded-full ring-1 ring-slate-200"
                    />
                ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-100" />
                )}
            </header>

            {/* Active Timer Banner */}
            <ActiveTimer />

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto popup-scroll">
                {page === 'issues' && <IssuesTab />}
                {page === 'stats' && <StatsTab tracked={tracked} />}
                {page === 'calendar' && <CalendarView tracked={tracked} />}
                {page === 'settings' && (
                    <Settings
                        token={token}
                        maskedToken={maskedToken}
                        user={user}
                        onTokenChange={handleTokenChange}
                        onClearData={() => setShowClearConfirm(true)}
                    />
                )}
            </main>

            {/* Bottom Navigation */}
            <nav className="flex items-center border-t border-slate-100 shrink-0">
                {navItems.map(({ id, icon: Icon, label }) => (
                    <button
                        key={id}
                        onClick={() => setPage(id)}
                        className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 cursor-pointer transition-colors ${page === id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
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