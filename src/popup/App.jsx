import { useState, useEffect } from 'preact/hooks';
import { ActiveTimer } from '../components/ActiveTimer/ActiveTimer.jsx';
import { IssuesTab } from './Views/IssuesTab/IssuesTab.jsx';
import { StatsTab } from './Views/StatsTab/StatsTab.jsx';
import { HistoryView } from './Views/TrackedList/HistoryView.jsx';
import { CalendarView } from './Views/TrackedList/CalendarView.jsx';
import { Settings } from '../components/Settings/Settings.jsx';
import { Modal } from '../components/Modal/Modal.jsx';
import { GitHubStorageService } from '../utils/github-storage.js';
import { StorageService } from '../utils/storage.js';
import { IssueStorageService } from '../utils/issue-storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';
import { useStorageListener } from '../hooks/useStorageListener.js';
import './App.css';

export function App() {
    const [token, setToken] = useState('');
    const [maskedToken, setMaskedToken] = useState('no token');
    const [activeTab, setActiveTab] = useState('issues');
    const [showSettings, setShowSettings] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [tokenLoaded, setTokenLoaded] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [tokenError, setTokenError] = useState('');

    const tracked = useStorageListener(STORAGE_KEYS.TRACKED_TIMES, []);

    useEffect(() => {
        const loadToken = async () => {
            const savedToken = await GitHubStorageService.getGitHubToken();
            if (savedToken) {
                setToken(savedToken);
                setMaskedToken(savedToken.slice(0, 4) + '••••••••');
            }
            setTokenLoaded(true);
        };
        loadToken();
    }, []);

    const handleTokenChange = (newToken) => {
        setToken(newToken);
        if (newToken) {
            setMaskedToken(newToken.slice(0, 4) + '••••••••');
        } else {
            setMaskedToken('no token');
        }
    };

    const handleSaveToken = async () => {
        const isValid = await GitHubStorageService.validateGitHubToken(tokenInput);
        if (isValid) {
            await GitHubStorageService.setGitHubToken(tokenInput);
            setToken(tokenInput);
            setMaskedToken(tokenInput.slice(0, 4) + '••••••••');
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

    // Token setup screen
    if (!token) {
        return (
            <div className="w-[420px] p-6 font-['Inter',sans-serif]">
                <h1 className="text-lg font-semibold text-center mb-2">⏱️ GitHub Time Tracker</h1>
                <p className="text-sm text-gray-500 text-center mb-4">
                    Enter your GitHub Personal Access Token to get started.
                </p>
                <input
                    type="password"
                    value={tokenInput}
                    onInput={(e) => setTokenInput(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-2"
                />
                {tokenError && <div className="text-xs text-red-500 mb-2">{tokenError}</div>}
                <button
                    onClick={handleSaveToken}
                    className="w-full bg-green-600 text-white text-sm font-medium py-2 rounded-md hover:bg-green-700 cursor-pointer transition-colors"
                >
                    Save Token
                </button>
            </div>
        );
    }

    return (
        <div className="w-[420px] font-['Inter',sans-serif]">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
                <h1 className="text-sm font-semibold text-gray-800">⏱️ GitHub Time Tracker</h1>
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`text-base cursor-pointer transition-colors ${showSettings ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                        }`}
                >
                    ⚙
                </button>
            </div>

            {/* Active Timer */}
            <div className="px-3 pt-3">
                <ActiveTimer />
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 px-3 py-1.5 border-b border-gray-100">
                <button
                    className={`text-sm px-3 py-1 rounded-md cursor-pointer transition-colors ${activeTab === 'issues'
                        ? 'bg-gray-100 font-medium text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('issues')}
                >
                    Issues
                </button>
                <button
                    className={`text-sm px-3 py-1 rounded-md cursor-pointer transition-colors ${activeTab === 'stats'
                        ? 'bg-gray-100 font-medium text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('stats')}
                >
                    Stats
                </button>
                <button
                    className={`text-sm px-3 py-1 rounded-md cursor-pointer transition-colors ${activeTab === 'history'
                        ? 'bg-gray-100 font-medium text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('history')}
                >
                    History
                </button>
                <button
                    className={`text-sm px-3 py-1 rounded-md cursor-pointer transition-colors ${activeTab === 'calendar'
                        ? 'bg-gray-100 font-medium text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                    onClick={() => setActiveTab('calendar')}
                >
                    Calendar
                </button>
            </div>

            {/* Content */}
            <div className="p-3 max-h-[380px] overflow-y-auto">
                {activeTab === 'issues' && <IssuesTab />}
                {activeTab === 'stats' && <StatsTab tracked={tracked} />}
                {activeTab === 'history' && <HistoryView tracked={tracked} />}
                {activeTab === 'calendar' && <CalendarView tracked={tracked} />}
            </div>

            {/* Settings panel */}
            {showSettings && (
                <Settings
                    token={token}
                    maskedToken={maskedToken}
                    onTokenChange={handleTokenChange}
                    onClearData={() => setShowClearConfirm(true)}
                />
            )}

            {/* Clear confirmation modal */}
            {showClearConfirm && (
                <Modal
                    title="Confirm Clear"
                    message="Are you sure you want to clear all tracked times? This action cannot be undone."
                    onConfirm={confirmClear}
                    onCancel={() => setShowClearConfirm(false)}
                />
            )}
        </div>
    );
}