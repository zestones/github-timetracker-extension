import { useState } from 'preact/hooks';
import { GitHubStorageService } from '../../utils/github-storage.js';
import { StorageService } from '../../utils/storage.js';
import { STORAGE_KEYS } from '../../utils/constants.js';
import { IconDownload, IconTrash, IconSun, IconMoon, IconMonitor } from '../../icons.jsx';

function exportCSV(tracked) {
    const header = 'Issue URL,Title,Seconds,Date\n';
    const rows = tracked.map((e) => {
        const url = `https://github.com${e.issueUrl}`;
        const title = (e.title || '').replace(/"/g, '""');
        return `"${url}","${title}",${e.seconds},"${e.date}"`;
    }).join('\n');
    const csv = header + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetracker-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportJSON(tracked) {
    const json = JSON.stringify(tracked, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetracker-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function Settings({ token, maskedToken, user, onTokenChange, onClearData, theme, onThemeChange }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [tokenStatus, setTokenStatus] = useState(null);

    const handleSave = async () => {
        const isValid = await GitHubStorageService.validateGitHubToken(tokenInput);
        if (isValid) {
            await GitHubStorageService.setGitHubToken(tokenInput);
            onTokenChange(tokenInput);
            setIsEditing(false);
            setTokenInput('');
            setTokenStatus(null);
        } else {
            setTokenStatus('Invalid token');
        }
    };

    const handleRemove = async () => {
        await GitHubStorageService.removeGitHubToken();
        onTokenChange('');
    };

    return (
        <div className="p-4 space-y-4">
            {/* Account */}
            <div>
                <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">Account</div>
                <div className="bg-surface rounded-xl p-3.5">
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border-default">
                        {user?.avatar_url ? (
                            <img src={user.avatar_url} className="w-9 h-9 rounded-full ring-1 ring-ring-default" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-raised" />
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-primary">{user?.login || 'Unknown'}</div>
                            <div className="text-[11px] text-muted font-mono truncate">{maskedToken}</div>
                        </div>
                    </div>

                    {!isEditing ? (
                        <div className="flex gap-2">
                            {token && (
                                <button
                                    onClick={handleRemove}
                                    className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-base border border-border-default text-danger-text hover:bg-danger-subtle cursor-pointer transition-colors"
                                >
                                    Disconnect
                                </button>
                            )}
                            <button
                                onClick={() => { setIsEditing(true); setTokenInput(''); }}
                                className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-base border border-border-default text-accent hover:bg-accent-subtle cursor-pointer transition-colors"
                            >
                                {token ? 'Change Token' : 'Set Token'}
                            </button>
                        </div>
                    ) : (
                        <div>
                            <input
                                type="password"
                                value={tokenInput}
                                onInput={(e) => setTokenInput(e.target.value)}
                                placeholder="GitHub Token (ghp_...)"
                                className="w-full px-3 py-2 text-[13px] bg-base border border-border-default rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary placeholder:text-muted mb-2"
                            />
                            {tokenStatus && (
                                <div className="text-[11px] text-danger-text mb-2">{tokenStatus}</div>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSave}
                                    className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-accent text-white hover:bg-accent-hover cursor-pointer transition-colors"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => { setIsEditing(false); setTokenStatus(null); }}
                                    className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-raised text-secondary hover:bg-overlay cursor-pointer transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Theme */}
            <div>
                <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">Theme</div>
                <div className="flex gap-2">
                    {[
                        { id: 'system', label: 'System', icon: IconMonitor },
                        { id: 'light', label: 'Light', icon: IconSun },
                        { id: 'dark', label: 'Dark', icon: IconMoon },
                    ].map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => onThemeChange(id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 text-[12px] font-medium py-2 rounded-xl cursor-pointer transition-colors border ${theme === id
                                ? 'bg-accent-subtle text-accent border-accent-ring'
                                : 'bg-surface text-tertiary border-border-default hover:bg-raised'
                                }`}
                        >
                            <Icon size={14} />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Export */}
            <div>
                <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">Export Data</div>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            const tracked = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) || [];
                            exportCSV(tracked);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-surface hover:bg-raised text-secondary text-[13px] font-medium py-2.5 rounded-xl cursor-pointer transition-colors border border-border-default"
                    >
                        <IconDownload size={14} />
                        CSV
                    </button>
                    <button
                        onClick={async () => {
                            const tracked = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) || [];
                            exportJSON(tracked);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-surface hover:bg-raised text-secondary text-[13px] font-medium py-2.5 rounded-xl cursor-pointer transition-colors border border-border-default"
                    >
                        <IconDownload size={14} />
                        JSON
                    </button>
                </div>
            </div>

            {/* Danger Zone */}
            <div>
                <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-2">Danger Zone</div>
                <button
                    onClick={onClearData}
                    className="w-full flex items-center justify-center gap-1.5 bg-danger-subtle hover:bg-danger-hover text-danger-text text-[13px] font-medium py-2.5 rounded-xl cursor-pointer transition-colors border border-danger-border"
                >
                    <IconTrash size={14} />
                    Clear All Tracked Data
                </button>
            </div>

            {/* Version */}
            <div className="text-center">
                <span className="text-[11px] text-faint">GitHub Time Tracker v1.0.2</span>
            </div>
        </div>
    );
}
