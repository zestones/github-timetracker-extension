import { useState } from 'preact/hooks';
import { GitHubStorageService } from '../../utils/github-storage.js';
import { StorageService } from '../../utils/storage.js';
import { STORAGE_KEYS } from '../../utils/constants.js';

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

export function Settings({ token, maskedToken, onTokenChange, onClearData }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tokenInput, setTokenInput] = useState('');
    const [tokenStatus, setTokenStatus] = useState(null);
    const [exporting, setExporting] = useState(false);

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
        <div className="border-t border-gray-200 p-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Settings
            </div>

            {!isEditing ? (
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                        {token ? '✅' : '❌'} Token: {maskedToken}
                    </span>
                    <div className="flex gap-3 text-xs">
                        {token && (
                            <button
                                onClick={handleRemove}
                                className="text-gray-500 hover:text-red-500 cursor-pointer"
                            >
                                Disconnect
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setIsEditing(true);
                                setTokenInput('');
                            }}
                            className="text-blue-600 hover:text-blue-800 cursor-pointer"
                        >
                            {token ? 'Change' : 'Set Token'}
                        </button>
                    </div>
                </div>
            ) : (
                <div>
                    <input
                        type="password"
                        value={tokenInput}
                        onInput={(e) => setTokenInput(e.target.value)}
                        placeholder="GitHub Token (ghp_...)"
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 mb-2"
                    />
                    {tokenStatus && (
                        <div className="text-xs text-red-500 mb-2">{tokenStatus}</div>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            className="text-xs bg-green-600 text-white px-3 py-1 rounded-md hover:bg-green-700 cursor-pointer"
                        >
                            Save
                        </button>
                        <button
                            onClick={() => {
                                setIsEditing(false);
                                setTokenStatus(null);
                            }}
                            className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-300 cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                <button
                    onClick={onClearData}
                    className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
                >
                    🗑 Clear All Tracked Data
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={async () => {
                            setExporting(true);
                            const tracked = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) || [];
                            exportCSV(tracked);
                            setExporting(false);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                        📤 CSV
                    </button>
                    <button
                        onClick={async () => {
                            setExporting(true);
                            const tracked = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) || [];
                            exportJSON(tracked);
                            setExporting(false);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                        📤 JSON
                    </button>
                </div>
            </div>
        </div>
    );
}
