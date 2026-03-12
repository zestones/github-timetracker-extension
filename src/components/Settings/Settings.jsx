import { useState } from 'preact/hooks';
import { GitHubStorageService } from '../../utils/github-storage.js';
import { StorageService } from '../../utils/storage.js';
import { STORAGE_KEYS } from '../../utils/constants.js';
import { IconDownload, IconTrash } from '../../icons.jsx';

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

export function Settings({ token, maskedToken, user, onTokenChange, onClearData }) {
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
        <div className="p-4 space-y-5">
            {/* Account */}
            <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">Account</div>
                <div className="bg-slate-50 rounded-xl p-3.5">
                    <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-200/60">
                        {user?.avatar_url ? (
                            <img src={user.avatar_url} className="w-9 h-9 rounded-full ring-1 ring-slate-200" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-200" />
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-slate-900">{user?.login || 'Unknown'}</div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">{maskedToken}</div>
                        </div>
                    </div>

                    {!isEditing ? (
                        <div className="flex gap-2">
                            {token && (
                                <button
                                    onClick={handleRemove}
                                    className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-white border border-slate-200 text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                                >
                                    Disconnect
                                </button>
                            )}
                            <button
                                onClick={() => { setIsEditing(true); setTokenInput(''); }}
                                className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors"
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
                                className="w-full px-3 py-2 text-[13px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 placeholder:text-slate-400 mb-2"
                            />
                            {tokenStatus && (
                                <div className="text-[11px] text-red-600 mb-2">{tokenStatus}</div>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSave}
                                    className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer transition-colors"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => { setIsEditing(false); setTokenStatus(null); }}
                                    className="flex-1 text-[12px] font-medium py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Export */}
            <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">Export Data</div>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            const tracked = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) || [];
                            exportCSV(tracked);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[13px] font-medium py-2.5 rounded-xl cursor-pointer transition-colors border border-slate-200/60"
                    >
                        <IconDownload size={14} />
                        CSV
                    </button>
                    <button
                        onClick={async () => {
                            const tracked = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) || [];
                            exportJSON(tracked);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[13px] font-medium py-2.5 rounded-xl cursor-pointer transition-colors border border-slate-200/60"
                    >
                        <IconDownload size={14} />
                        JSON
                    </button>
                </div>
            </div>

            {/* Danger Zone */}
            <div>
                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">Danger Zone</div>
                <button
                    onClick={onClearData}
                    className="w-full flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-[13px] font-medium py-2.5 rounded-xl cursor-pointer transition-colors border border-red-100"
                >
                    <IconTrash size={14} />
                    Clear All Tracked Data
                </button>
            </div>

            {/* Version */}
            <div className="text-center pt-2">
                <span className="text-[11px] text-slate-300">GitHub Time Tracker v1.0.2</span>
            </div>
        </div>
    );
}
