import { useMemo, useState } from 'preact/hooks';
import { TimeService } from '../../../utils/time.js';
import { AggregationService } from '../../../utils/aggregation.js';
import { IconCalendar, IconX } from '../../../icons.jsx';

export function StatsTab({ tracked }) {
    const [rangeMode, setRangeMode] = useState('today');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    const filteredEntries = useMemo(() => {
        if (rangeMode === 'today') return AggregationService.getTodayEntries(tracked);
        if (rangeMode === 'week') return AggregationService.getWeekEntries(tracked);
        if (rangeMode === 'month') return AggregationService.getMonthEntries(tracked);
        if (rangeMode === 'custom' && customStart && customEnd) {
            return AggregationService.filterByDateRange(tracked, customStart, customEnd);
        }
        return tracked;
    }, [tracked, rangeMode, customStart, customEnd]);

    const todaySeconds = useMemo(
        () => AggregationService.getTotalSeconds(AggregationService.getTodayEntries(tracked)),
        [tracked]
    );
    const weekSeconds = useMemo(
        () => AggregationService.getTotalSeconds(AggregationService.getWeekEntries(tracked)),
        [tracked]
    );
    const monthSeconds = useMemo(
        () => AggregationService.getTotalSeconds(AggregationService.getMonthEntries(tracked)),
        [tracked]
    );

    const repoBreakdown = useMemo(
        () => AggregationService.getTimePerRepo(filteredEntries),
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

            {/* Custom date range */}
            <div className="mb-4">
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
                {rangeMode === 'custom' && (
                    <div className="flex items-center gap-2 mt-2">
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
            </div>

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
                        const barColors = ['bg-indigo-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-cyan-500'];
                        return (
                            <div key={repo} className="mb-3">
                                <div className="flex justify-between mb-1">
                                    <span className="text-[13px] text-secondary truncate flex-1 font-medium">{repo}</span>
                                    <span className="text-[11px] text-muted shrink-0 ml-2 font-mono tabular-nums">
                                        {formatted} ({percentage}%)
                                    </span>
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
