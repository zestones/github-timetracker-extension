import { useMemo, useState, useCallback, useEffect } from 'preact/hooks';
import { TimeService } from '../../utils/time.js';
import { AggregationService } from '../../utils/aggregation.js';
import { GitHubService } from '../../utils/github.js';
import { PinnedReposService } from '../../utils/pinned-repos.js';
import { IssueStorageService } from '../../utils/issue-storage.js';
import { StorageService } from '../../utils/storage.js';
import { STORAGE_KEYS } from '../../utils/constants.js';
import { RepoDetailView } from './RepoDetailView.jsx';
import { IconCalendar, IconX, IconChevronRight, IconUser, IconUsers, IconRefresh } from '../../icons.jsx';

export function StatsTab({ tracked, user }) {
    const [rangeMode, setRangeMode] = useState('today');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [userMode, setUserMode] = useState('me');
    const [everyoneData, setEveryoneData] = useState(null);
    const [everyoneLoading, setEveryoneLoading] = useState(false);

    // Load cached everyone data on mount
    useEffect(() => {
        StorageService.get(STORAGE_KEYS.EVERYONE_DATA).then(cached => {
            if (cached && cached.length > 0) setEveryoneData(cached);
        });
    }, []);

    const fetchEveryoneData = useCallback(async () => {
        setEveryoneLoading(true);
        try {
            const pinnedRepos = await PinnedReposService.getPinnedRepos();
            if (pinnedRepos.length === 0) {
                setEveryoneData([]);
                return;
            }
            const allUsersData = await GitHubService.fetchAllUsersData(pinnedRepos);
            const username = user?.login;

            // Build title map from issues + local tracked
            const issues = await IssueStorageService.getAll();
            const titleMap = {};
            for (const issue of issues) {
                titleMap[issue.url] = issue.title;
            }
            for (const entry of tracked) {
                if (!titleMap[entry.issueUrl]) titleMap[entry.issueUrl] = entry.title;
            }

            // Fetch issue titles from API for entries not in titleMap
            const missingUrls = new Set();
            for (const item of allUsersData) {
                if (!titleMap[item.issueUrl]) missingUrls.add(item.issueUrl);
            }
            if (missingUrls.size > 0) {
                const repoSet = new Set();
                for (const url of missingUrls) {
                    const { owner, repo } = GitHubService.parseIssueUrl(url);
                    repoSet.add(`${owner}/${repo}`);
                }
                for (const fullRepo of repoSet) {
                    const [owner, repoName] = fullRepo.split('/');
                    try {
                        const repoIssues = await GitHubService.getRepoIssues(owner, repoName);
                        for (const issue of repoIssues) {
                            const key = `/${owner}/${repoName}/issues/${issue.number}`;
                            if (!titleMap[key]) {
                                const title = `(${owner}) ${repoName} | ${issue.title} | #${issue.number}`;
                                titleMap[key] = title;
                            }
                        }
                    } catch (e) {
                        console.error(`Failed to fetch issues for ${fullRepo}:`, e);
                    }
                }
            }

            const flatEntries = allUsersData.flatMap(item =>
                item.entries.map(e => ({
                    issueUrl: item.issueUrl,
                    title: titleMap[item.issueUrl] || `#${item.issueUrl.split('/').pop()}`,
                    seconds: e.seconds,
                    date: e.date,
                    user: item.user,
                }))
            );
            setEveryoneData(flatEntries);
            await StorageService.set(STORAGE_KEYS.EVERYONE_DATA, flatEntries);

            // Merge current user's remote entries into local storage
            if (username) {
                const remoteMe = flatEntries.filter(e => e.user === username);
                const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
                const localKeys = new Set(trackedTimes.map(e => `${e.issueUrl}|${e.date}`));
                const newEntries = remoteMe.filter(e => !localKeys.has(`${e.issueUrl}|${e.date}`));
                if (newEntries.length > 0) {
                    const toAdd = newEntries.map(e => ({
                        issueUrl: e.issueUrl,
                        title: e.title,
                        seconds: e.seconds,
                        date: e.date,
                    }));
                    trackedTimes.push(...toAdd);
                    await StorageService.set(STORAGE_KEYS.TRACKED_TIMES, trackedTimes);
                }
            }
        } catch (e) {
            console.error('Failed to fetch everyone data:', e);
            setEveryoneData([]);
        } finally {
            setEveryoneLoading(false);
        }
    }, [tracked, user]);

    const handleUserModeChange = useCallback((mode) => {
        setUserMode(mode);
    }, []);

    const activeEntries = useMemo(() => {
        if (userMode === 'everyone') return everyoneData || [];
        return tracked;
    }, [userMode, everyoneData, tracked]);

    const filteredEntries = useMemo(() => {
        if (rangeMode === 'today') return AggregationService.getTodayEntries(activeEntries);
        if (rangeMode === 'week') return AggregationService.getWeekEntries(activeEntries);
        if (rangeMode === 'month') return AggregationService.getMonthEntries(activeEntries);
        if (rangeMode === 'custom' && customStart && customEnd) {
            return AggregationService.filterByDateRange(activeEntries, customStart, customEnd);
        }
        return activeEntries;
    }, [activeEntries, rangeMode, customStart, customEnd]);

    const todaySeconds = useMemo(
        () => AggregationService.getTotalSeconds(AggregationService.getTodayEntries(activeEntries)),
        [activeEntries]
    );
    const weekSeconds = useMemo(
        () => AggregationService.getTotalSeconds(AggregationService.getWeekEntries(activeEntries)),
        [activeEntries]
    );
    const monthSeconds = useMemo(
        () => AggregationService.getTotalSeconds(AggregationService.getMonthEntries(activeEntries)),
        [activeEntries]
    );

    const repoBreakdown = useMemo(
        () => AggregationService.getTimePerRepo(filteredEntries),
        [filteredEntries]
    );

    const repoDetails = useMemo(
        () => AggregationService.getRepoBreakdownDetailed(filteredEntries),
        [filteredEntries]
    );

    const maxSeconds = useMemo(
        () => Math.max(...repoBreakdown.map((r) => r.seconds), 1),
        [repoBreakdown]
    );

    const totalFiltered = useMemo(
        () => AggregationService.getTotalSeconds(filteredEntries),
        [filteredEntries]
    );

    const colors = [
        { bg: 'bg-accent', light: 'bg-accent-subtle', ring: 'ring-accent-ring', text: 'text-accent-text', value: 'text-accent' },
        { bg: 'bg-violet-text', light: 'bg-violet-subtle', ring: 'ring-violet-ring', text: 'text-violet-text', value: 'text-violet-value' },
        { bg: 'bg-amber-text', light: 'bg-amber-subtle', ring: 'ring-amber-ring', text: 'text-amber-text', value: 'text-amber-value' },
    ];

    const cards = [
        { id: 'today', label: 'Today', seconds: todaySeconds },
        { id: 'week', label: 'This Week', seconds: weekSeconds },
        { id: 'month', label: 'This Month', seconds: monthSeconds },
    ];

    const barColors = ['bg-indigo-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-cyan-500'];

    // Detail view for a selected repo
    if (selectedRepo) {
        return (
            <RepoDetailView
                repo={selectedRepo}
                repoDetails={repoDetails[selectedRepo]}
                userMode={userMode}
                onBack={() => setSelectedRepo(null)}
            />
        );
    }

    return (
        <div className="p-4">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                {cards.map((card, i) => (
                    <div
                        key={card.id}
                        className={`rounded-xl p-3 text-center cursor-pointer transition-all ${rangeMode === card.id
                            ? `${colors[i].light} ring-1 ${colors[i].ring}`
                            : 'bg-surface hover:bg-raised'
                            }`}
                        onClick={() => setRangeMode(card.id)}
                    >
                        <div className={`text-[11px] font-medium ${rangeMode === card.id ? colors[i].text : 'text-tertiary'}`}>
                            {card.label}
                        </div>
                        <div className={`text-[14px] font-bold mt-0.5 font-mono tabular-nums ${rangeMode === card.id ? colors[i].value : 'text-secondary'}`}>
                            {TimeService.formatTime(card.seconds)}
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters row */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
                {/* User filter */}
                <div className="flex items-center rounded-lg border border-border-default overflow-hidden">
                    <button
                        onClick={() => handleUserModeChange('me')}
                        className={`flex items-center gap-1 text-[11px] cursor-pointer font-medium px-2.5 py-1.5 transition-all ${userMode === 'me'
                            ? 'bg-accent-subtle text-accent'
                            : 'bg-surface text-tertiary hover:bg-raised hover:text-secondary'
                            }`}
                    >
                        <IconUser size={11} /> Me
                    </button>
                    <div className="w-px h-4 bg-border-default" />
                    <button
                        onClick={() => handleUserModeChange('everyone')}
                        className={`flex items-center gap-1 text-[11px] cursor-pointer font-medium px-2.5 py-1.5 transition-all ${userMode === 'everyone'
                            ? 'bg-accent-subtle text-accent'
                            : 'bg-surface text-tertiary hover:bg-raised hover:text-secondary'
                            }`}
                    >
                        <IconUsers size={11} /> Everyone
                    </button>
                </div>

                {userMode === 'everyone' && (
                    <button
                        onClick={fetchEveryoneData}
                        disabled={everyoneLoading}
                        className="flex items-center gap-1 text-[11px] cursor-pointer font-medium px-2 py-1.5 rounded-lg border border-border-default bg-surface text-tertiary hover:bg-raised hover:text-secondary transition-all disabled:opacity-50"
                        title="Refresh everyone's data from GitHub"
                    >
                        <IconRefresh size={11} className={everyoneLoading ? 'animate-spin' : ''} />
                    </button>
                )}

                {/* Custom date range */}
                <button
                    onClick={() => setRangeMode(rangeMode === 'custom' ? 'today' : 'custom')}
                    className={`flex items-center gap-1.5 text-[11px] cursor-pointer transition-all font-medium px-3 py-1.5 rounded-lg border ${rangeMode === 'custom'
                        ? 'bg-accent-subtle text-accent border-accent-ring'
                        : 'bg-surface text-tertiary border-border-default hover:bg-raised hover:text-secondary'
                        }`}
                >
                    {rangeMode === 'custom' ? (
                        <><IconX size={12} /> Close</>
                    ) : (
                        <><IconCalendar size={12} /> Custom range</>
                    )}
                </button>
            </div>

            {rangeMode === 'custom' && (
                <div className="flex items-center gap-2 mb-4">
                    <input
                        type="date"
                        value={customStart}
                        onInput={(e) => setCustomStart(e.target.value)}
                        className="text-[12px] border border-border-default rounded-lg px-2.5 py-1.5 flex-1 bg-surface focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary"
                    />
                    <span className="text-faint text-[11px]">to</span>
                    <input
                        type="date"
                        value={customEnd}
                        onInput={(e) => setCustomEnd(e.target.value)}
                        className="text-[12px] border border-border-default rounded-lg px-2.5 py-1.5 flex-1 bg-surface focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary"
                    />
                </div>
            )}

            {/* Loading state for everyone */}
            {userMode === 'everyone' && everyoneLoading && (
                <div className="text-[12px] text-muted text-center py-6">
                    Fetching data from GitHub...
                </div>
            )}

            {/* Per-repo breakdown */}
            <div>
                <div className="text-[11px] font-medium text-muted uppercase tracking-wider mb-3">
                    Per-Repo Breakdown
                </div>
                {repoBreakdown.length === 0 ? (
                    <div className="text-[13px] text-muted text-center py-8">
                        No tracked time in this period
                    </div>
                ) : (
                    repoBreakdown.map(({ repo, seconds, formatted }, i) => {
                        const percentage = totalFiltered > 0 ? Math.round((seconds / totalFiltered) * 100) : 0;

                        return (
                            <div
                                key={repo}
                                className="mb-3 cursor-pointer group"
                                onClick={() => setSelectedRepo(repo)}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1 flex-1 min-w-0">
                                        <span className="text-[13px] text-secondary truncate font-medium group-hover:text-primary transition-colors">
                                            {repo}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <span className="text-[11px] text-muted font-mono tabular-nums">
                                            {formatted} ({percentage}%)
                                        </span>
                                        <span className="text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                                            <IconChevronRight size={12} />
                                        </span>
                                    </div>
                                </div>
                                <div className="w-full bg-raised rounded-full h-1.5">
                                    <div
                                        className={`${barColors[i % barColors.length]} h-1.5 rounded-full transition-all duration-500`}
                                        style={{ width: `${(seconds / maxSeconds) * 100}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Total */}
            {totalFiltered > 0 && (
                <div className="mt-4 pt-3 border-t border-border-subtle text-center">
                    <span className="text-[11px] text-muted">Total tracked: </span>
                    <span className="text-[13px] font-semibold text-secondary font-mono tabular-nums">
                        {TimeService.formatTime(totalFiltered)}
                    </span>
                </div>
            )}
        </div>
    );
}
