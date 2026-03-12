import { useState, useEffect, useMemo } from 'preact/hooks';
import { IssueRow } from '../../../components/IssueRow/IssueRow.jsx';
import { PinRepoModal } from '../../../components/PinRepoModal/PinRepoModal.jsx';
import { CacheService } from '../../../utils/cache.js';
import { GitHubService } from '../../../utils/github.js';
import { TimerService } from '../../../utils/timer.js';
import { IssueStorageService } from '../../../utils/issue-storage.js';
import { StorageService } from '../../../utils/storage.js';
import { STORAGE_KEYS } from '../../../utils/constants.js';
import { useStorageListener } from '../../../hooks/useStorageListener.js';

export function IssuesTab() {
    const [pinnedRepos, setPinnedRepos] = useState([]);
    const [repoIssues, setRepoIssues] = useState({});
    const [expandedRepos, setExpandedRepos] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState({});
    const [showPinModal, setShowPinModal] = useState(false);
    const [activeIssue, setActiveIssue] = useState(null);
    const [filter, setFilter] = useState('all'); // 'all' | 'assigned' | 'created'
    const [currentUser, setCurrentUser] = useState(null);

    const tracked = useStorageListener(STORAGE_KEYS.TRACKED_TIMES, []);

    // Load pinned repos and their issues
    useEffect(() => {
        const load = async () => {
            const repos = await CacheService.getPinnedRepos();
            setPinnedRepos(repos);

            // Load cached user
            const cachedUser = await CacheService.getCachedUser();
            if (cachedUser) {
                setCurrentUser(cachedUser.login);
            } else {
                try {
                    const user = await GitHubService.getUser();
                    await CacheService.setCachedUser({ login: user.login, avatar_url: user.avatar_url, name: user.name });
                    setCurrentUser(user.login);
                } catch (e) {
                    console.error('Failed to fetch user:', e);
                }
            }

            const expanded = {};
            repos.forEach((r) => (expanded[r.fullName] = true));
            setExpandedRepos(expanded);

            for (const repo of repos) {
                const cached = await CacheService.getCachedIssues(repo.fullName);
                if (cached) {
                    setRepoIssues((prev) => ({ ...prev, [repo.fullName]: cached }));
                } else {
                    refreshRepoIssues(repo);
                }
            }
        };
        load();
    }, []);

    // Listen for active issue changes
    useEffect(() => {
        const load = async () => {
            const active = await StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE);
            setActiveIssue(active);
        };
        load();

        const listener = (changes, area) => {
            if (area === 'local' && changes[STORAGE_KEYS.ACTIVE_ISSUE]) {
                setActiveIssue(changes[STORAGE_KEYS.ACTIVE_ISSUE].newValue || null);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    const refreshRepoIssues = async (repo) => {
        setLoading((prev) => ({ ...prev, [repo.fullName]: true }));
        try {
            const [owner, repoName] = repo.fullName.split('/');
            const issues = await GitHubService.getRepoIssues(owner, repoName);
            const simplified = issues.map((i) => ({
                number: i.number,
                title: i.title,
                issueUrl: `/${repo.fullName}/issues/${i.number}`,
                state: i.state,
                labels: (i.labels || []).map((l) => l.name),
                assignees: (i.assignees || []).map((a) => a.login),
                user: i.user?.login || '',
            }));
            await CacheService.setCachedIssues(repo.fullName, simplified);
            setRepoIssues((prev) => ({ ...prev, [repo.fullName]: simplified }));
        } catch (error) {
            console.error(`Failed to fetch issues for ${repo.fullName}:`, error);
        }
        setLoading((prev) => ({ ...prev, [repo.fullName]: false }));
    };

    // Calculate tracked time per issue
    const trackedTimeByIssue = useMemo(() => {
        const map = {};
        for (const entry of tracked) {
            map[entry.issueUrl] = (map[entry.issueUrl] || 0) + entry.seconds;
        }
        return map;
    }, [tracked]);

    // Handle start/stop
    const handleStart = async (issue) => {
        const [owner, repo] = issue.issueUrl.split('/').slice(1, 3);
        const fullTitle = `(${owner}) ${repo} | ${issue.title} | #${issue.number}`;
        await IssueStorageService.add({ url: issue.issueUrl, title: fullTitle });
        await TimerService.startTimer(issue.issueUrl);
        chrome.runtime.sendMessage({ action: 'timerStarted', issueUrl: issue.issueUrl });
    };

    const handleStop = async (issue) => {
        await TimerService.stopTimer(issue.issueUrl);
        chrome.runtime.sendMessage({ action: 'timerStopped', issueUrl: issue.issueUrl });
    };

    // Filter issues by assignee/creator
    const filterIssue = (issue) => {
        if (!currentUser || filter === 'all') return true;
        if (filter === 'assigned') return (issue.assignees || []).includes(currentUser);
        if (filter === 'created') return issue.user === currentUser;
        return true;
    };

    // Search across all repos
    const allFilteredIssues = useMemo(() => {
        if (!searchTerm) return null;
        const term = searchTerm.toLowerCase();
        const all = [];
        for (const [fullName, issues] of Object.entries(repoIssues)) {
            for (const issue of issues || []) {
                if (!filterIssue(issue)) continue;
                if (
                    issue.title.toLowerCase().includes(term) ||
                    `#${issue.number}`.includes(term) ||
                    fullName.toLowerCase().includes(term)
                ) {
                    all.push({ ...issue, repoName: fullName });
                }
            }
        }
        return all;
    }, [searchTerm, repoIssues, filter, currentUser]);

    return (
        <div>
            {/* Search */}
            <div className="mb-2">
                <input
                    type="text"
                    placeholder="Search issues across pinned repos..."
                    value={searchTerm}
                    onInput={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
            </div>

            {/* Filter bar */}
            <div className="flex gap-1 mb-3">
                {[
                    { id: 'all', label: 'All' },
                    { id: 'assigned', label: 'Assigned to me' },
                    { id: 'created', label: 'Created by me' },
                ].map((f) => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`text-xs px-2 py-0.5 rounded-full cursor-pointer transition-colors ${filter === f.id
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Search results */}
            {searchTerm && allFilteredIssues && (
                <div>
                    {allFilteredIssues.length === 0 ? (
                        <div className="text-sm text-gray-500 text-center py-4">No issues found</div>
                    ) : (
                        allFilteredIssues.map((issue) => (
                            <div key={issue.issueUrl}>
                                <div className="text-xs text-gray-400 px-1 mt-1">{issue.repoName}</div>
                                <IssueRow
                                    issue={issue}
                                    isActive={activeIssue === issue.issueUrl}
                                    onStart={handleStart}
                                    onStop={handleStop}
                                    trackedSeconds={trackedTimeByIssue[issue.issueUrl] || 0}
                                />
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Pinned repos */}
            {!searchTerm && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            Pinned Repos
                        </span>
                        <button
                            onClick={() => setShowPinModal(true)}
                            className="text-xs text-blue-600 hover:text-blue-800 cursor-pointer font-medium"
                        >
                            + Add
                        </button>
                    </div>

                    {pinnedRepos.length === 0 && (
                        <div className="text-sm text-gray-500 text-center py-8">
                            <div className="text-2xl mb-2">📌</div>
                            <div>No pinned repos yet</div>
                            <button
                                onClick={() => setShowPinModal(true)}
                                className="text-blue-600 hover:underline mt-1 cursor-pointer text-sm"
                            >
                                Pin your first repository
                            </button>
                        </div>
                    )}

                    {pinnedRepos.map((repo) => (
                        <div key={repo.fullName} className="mb-1">
                            {/* Repo header */}
                            <div
                                className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-gray-50 rounded px-1"
                                onClick={() =>
                                    setExpandedRepos((prev) => ({
                                        ...prev,
                                        [repo.fullName]: !prev[repo.fullName],
                                    }))
                                }
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-400">
                                        {expandedRepos[repo.fullName] ? '▼' : '▶'}
                                    </span>
                                    <span className="text-sm font-medium text-gray-800">
                                        {repo.fullName}
                                    </span>
                                    {loading[repo.fullName] && (
                                        <span className="text-xs text-gray-400">loading...</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            refreshRepoIssues(repo);
                                        }}
                                        className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                                        title="Refresh issues"
                                    >
                                        ↻
                                    </button>
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await CacheService.removePinnedRepo(repo.fullName);
                                            setPinnedRepos((prev) =>
                                                prev.filter((r) => r.fullName !== repo.fullName)
                                            );
                                            setRepoIssues((prev) => {
                                                const next = { ...prev };
                                                delete next[repo.fullName];
                                                return next;
                                            });
                                        }}
                                        className="text-xs text-gray-400 hover:text-red-500 cursor-pointer"
                                        title="Unpin repo"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Issues list */}
                            {expandedRepos[repo.fullName] && (
                                <div className="ml-5 border-l border-gray-200 pl-2">
                                    {loading[repo.fullName] && !repoIssues[repo.fullName] ? (
                                        <div className="text-xs text-gray-400 py-2 pl-1">
                                            Fetching issues...
                                        </div>
                                    ) : (repoIssues[repo.fullName] || []).filter(filterIssue).length === 0 ? (
                                        <div className="text-xs text-gray-400 py-2 pl-1">
                                            {filter === 'all' ? 'No open issues' : 'No matching issues'}
                                        </div>
                                    ) : (
                                        (repoIssues[repo.fullName] || []).filter(filterIssue).map((issue) => (
                                            <IssueRow
                                                key={issue.issueUrl}
                                                issue={issue}
                                                isActive={activeIssue === issue.issueUrl}
                                                onStart={handleStart}
                                                onStop={handleStop}
                                                trackedSeconds={
                                                    trackedTimeByIssue[issue.issueUrl] || 0
                                                }
                                            />
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showPinModal && (
                <PinRepoModal
                    onClose={() => setShowPinModal(false)}
                    onPin={async (repo) => {
                        await CacheService.addPinnedRepo(repo);
                        const updated = await CacheService.getPinnedRepos();
                        setPinnedRepos(updated);
                        setExpandedRepos((prev) => ({ ...prev, [repo.fullName]: true }));
                        refreshRepoIssues(repo);
                    }}
                    pinnedRepos={pinnedRepos}
                />
            )}
        </div>
    );
}
