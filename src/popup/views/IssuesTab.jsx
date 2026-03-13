import { useState, useEffect, useMemo } from 'preact/hooks';
import { IssueRow } from '../../components/IssueRow.jsx';
import { PinRepoModal } from '../../components/PinRepoModal.jsx';
import { TimerService } from '../../utils/timer.js';
import { IssueStorageService } from '../../utils/issue-storage.js';
import { STORAGE_KEYS } from '../../utils/constants.js';
import { useStorageListener } from '../../hooks/useStorageListener.js';
import { useActiveTimer } from '../../hooks/useActiveTimer.js';
import { useIssuesData } from '../../hooks/useIssuesData.js';
import { SearchInput } from '../../components/SearchInput.jsx';
import { IconPlus, IconChevronDown, IconChevronRight, IconRefresh, IconX, IconPin } from '../../icons.jsx';

export function IssuesTab() {
    const [expandedRepos, setExpandedRepos] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [showPinModal, setShowPinModal] = useState(false);
    const [filter, setFilter] = useState('open');

    const tracked = useStorageListener(STORAGE_KEYS.TRACKED_TIMES, []);
    const { activeIssue } = useActiveTimer();
    const { pinnedRepos, repoIssues, loading, currentUser, refreshRepoIssues, pinRepo, unpinRepo } = useIssuesData();

    // Expand all repos when pinnedRepos first loads
    useEffect(() => {
        if (pinnedRepos.length > 0) {
            setExpandedRepos((prev) => {
                const next = { ...prev };
                for (const r of pinnedRepos) {
                    if (!(r.fullName in next)) next[r.fullName] = true;
                }
                return next;
            });
        }
    }, [pinnedRepos]);

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
    };

    const handleStop = async (issue) => {
        await TimerService.stopTimer(issue.issueUrl);
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
            <SearchInput
                placeholder="Search issues..."
                value={searchTerm}
                onInput={setSearchTerm}
            />

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
                                            await unpinRepo(repo.fullName);
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
                        await pinRepo(repo);
                        setExpandedRepos((prev) => ({ ...prev, [repo.fullName]: true }));
                    }}
                    pinnedRepos={pinnedRepos}
                />
            )}
        </div>
    );
}
