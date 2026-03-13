import { useState, useEffect, useMemo } from 'preact/hooks';
import { IssueRow } from '../../components/IssueRow.jsx';
import { PinRepoModal } from '../../components/PinRepoModal.jsx';
import { CacheService } from '../../utils/cache.js';
import { PinnedReposService } from '../../utils/pinned-repos.js';
import { GitHubService } from '../../utils/github.js';
import { TimerService } from '../../utils/timer.js';
import { IssueStorageService } from '../../utils/issue-storage.js';
import { STORAGE_KEYS } from '../../utils/constants.js';
import { useStorageListener } from '../../hooks/useStorageListener.js';
import { useActiveTimer } from '../../hooks/useActiveTimer.js';
import { IconSearch, IconPlus, IconChevronDown, IconChevronRight, IconRefresh, IconX, IconPin } from '../../icons.jsx';

export function IssuesTab() {
    const [pinnedRepos, setPinnedRepos] = useState([]);
    const [repoIssues, setRepoIssues] = useState({});
    const [expandedRepos, setExpandedRepos] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState({});
    const [showPinModal, setShowPinModal] = useState(false);
    const [filter, setFilter] = useState('open');
    const [currentUser, setCurrentUser] = useState(null);

    const tracked = useStorageListener(STORAGE_KEYS.TRACKED_TIMES, []);
    const { activeIssue } = useActiveTimer();

    useEffect(() => {
        const load = async () => {
            const repos = await PinnedReposService.getPinnedRepos();
            setPinnedRepos(repos);

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

    const refreshRepoIssues = async (repo) => {
        setLoading((prev) => ({ ...prev, [repo.fullName]: true }));
        try {
            const [owner, repoName] = repo.fullName.split('/');
            const issues = await GitHubService.getRepoIssues(owner, repoName);
            const simplified = issues.map((i) => GitHubService.simplifyIssue(i, repo.fullName));
            await CacheService.setCachedIssues(repo.fullName, simplified);
            setRepoIssues((prev) => ({ ...prev, [repo.fullName]: simplified }));
        } catch (error) {
            console.error(`Failed to fetch issues for ${repo.fullName}:`, error);
        }
        setLoading((prev) => ({ ...prev, [repo.fullName]: false }));
    };

    const trackedTimeByIssue = useMemo(() => {
        const map = {};
        for (const entry of tracked) {
            map[entry.issueUrl] = (map[entry.issueUrl] || 0) + entry.seconds;
        }
        return map;
    }, [tracked]);

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

    const filterIssue = (issue) => {
        if (filter === 'closed') return issue.state === 'closed';
        if (filter === 'open') return issue.state !== 'closed';
        if (filter === 'assigned') return issue.state !== 'closed' && (issue.assignees || []).includes(currentUser);
        if (filter === 'created') return issue.state !== 'closed' && issue.user === currentUser;
        return true;
    };

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
        <div className="p-4">
            {/* Search */}
            <div className="relative mb-3">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                    <IconSearch size={14} />
                </div>
                <input
                    type="text"
                    placeholder="Search issues..."
                    value={searchTerm}
                    onInput={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-[13px] bg-surface border border-border-default rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary placeholder:text-muted"
                />
            </div>

            {/* Filter pills */}
            <div className="flex gap-1.5 mb-4 flex-wrap">
                {[
                    { id: 'open', label: 'Open' },
                    { id: 'assigned', label: 'Assigned to me' },
                    { id: 'created', label: 'Created by me' },
                    { id: 'closed', label: 'Closed' },
                ].map((f) => (
                    <button
                        key={f.id}
                        onClick={() => setFilter(f.id)}
                        className={`text-[11px] px-2.5 py-1 rounded-full cursor-pointer transition-colors font-medium ${filter === f.id
                            ? 'bg-accent-subtle text-accent-text'
                            : 'bg-surface text-tertiary hover:bg-raised'
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
                        <div className="text-[13px] text-muted text-center py-8">No issues found</div>
                    ) : (
                        allFilteredIssues.map((issue) => (
                            <div key={issue.issueUrl}>
                                <div className="text-[11px] text-muted px-2 mt-2 mb-0.5 font-medium">{issue.repoName}</div>
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
                        <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
                            Pinned Repos
                        </span>
                        <button
                            onClick={() => setShowPinModal(true)}
                            className="flex items-center gap-0.5 text-[11px] text-accent hover:text-accent-hover cursor-pointer font-medium"
                        >
                            <IconPlus size={12} />
                            Add
                        </button>
                    </div>

                    {pinnedRepos.length === 0 && (
                        <div className="text-center py-10">
                            <div className="text-faint mb-3">
                                <IconPin size={32} className="mx-auto" />
                            </div>
                            <div className="text-[13px] text-tertiary mb-1">No pinned repos yet</div>
                            <button
                                onClick={() => setShowPinModal(true)}
                                className="text-[13px] text-accent hover:text-accent-hover cursor-pointer font-medium"
                            >
                                Pin your first repository
                            </button>
                        </div>
                    )}

                    {pinnedRepos.map((repo) => (
                        <div key={repo.fullName} className="mb-1">
                            <div
                                className="flex items-center justify-between py-2 cursor-pointer hover:bg-surface rounded-lg px-2 transition-colors"
                                onClick={() =>
                                    setExpandedRepos((prev) => ({
                                        ...prev,
                                        [repo.fullName]: !prev[repo.fullName],
                                    }))
                                }
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="text-muted">
                                        {expandedRepos[repo.fullName] ? (
                                            <IconChevronDown size={14} />
                                        ) : (
                                            <IconChevronRight size={14} />
                                        )}
                                    </span>
                                    <span className="text-[13px] font-medium text-primary">
                                        {repo.fullName}
                                    </span>
                                    {loading[repo.fullName] && (
                                        <span className="text-[11px] text-muted">loading...</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            refreshRepoIssues(repo);
                                        }}
                                        className="text-muted hover:text-secondary cursor-pointer p-0.5 rounded hover:bg-raised transition-colors"
                                        title="Refresh issues"
                                    >
                                        <IconRefresh size={13} />
                                    </button>
                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            await PinnedReposService.removePinnedRepo(repo.fullName);
                                            setPinnedRepos((prev) =>
                                                prev.filter((r) => r.fullName !== repo.fullName)
                                            );
                                            setRepoIssues((prev) => {
                                                const next = { ...prev };
                                                delete next[repo.fullName];
                                                return next;
                                            });
                                        }}
                                        className="text-muted hover:text-danger-text cursor-pointer p-0.5 rounded hover:bg-raised transition-colors"
                                        title="Unpin repo"
                                    >
                                        <IconX size={13} />
                                    </button>
                                </div>
                            </div>

                            {expandedRepos[repo.fullName] && (
                                <div className="ml-4 pl-3 border-l-2 border-border-subtle">
                                    {loading[repo.fullName] && !repoIssues[repo.fullName] ? (
                                        <div className="text-[11px] text-muted py-3 pl-2">
                                            Fetching issues...
                                        </div>
                                    ) : (repoIssues[repo.fullName] || []).filter(filterIssue).length === 0 ? (
                                        <div className="text-[11px] text-muted py-3 pl-2">
                                            {filter === 'closed' ? 'No closed issues' : filter === 'open' ? 'No open issues' : 'No matching issues'}
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
                        await PinnedReposService.addPinnedRepo(repo);
                        const updated = await PinnedReposService.getPinnedRepos();
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
