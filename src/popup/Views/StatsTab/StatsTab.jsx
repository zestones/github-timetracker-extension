import { useMemo, useState } from 'preact/hooks';
import { TimeService } from '../../../utils/time.js';
import { AggregationService } from '../../../utils/aggregation.js';

export function StatsTab({ tracked }) {
    const [rangeMode, setRangeMode] = useState('today'); // 'today' | 'week' | 'month' | 'custom'
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

    return (
        <div>
            {/* Time summary cards */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div
                    className={`rounded-lg p-2.5 text-center cursor-pointer transition-colors ${rangeMode === 'today' ? 'bg-blue-100 ring-1 ring-blue-300' : 'bg-blue-50'
                        }`}
                    onClick={() => setRangeMode('today')}
                >
                    <div className="text-xs text-blue-600 font-medium">Today</div>
                    <div className="text-sm font-bold text-blue-900 mt-0.5">
                        {TimeService.formatTime(todaySeconds)}
                    </div>
                </div>
                <div
                    className={`rounded-lg p-2.5 text-center cursor-pointer transition-colors ${rangeMode === 'week' ? 'bg-purple-100 ring-1 ring-purple-300' : 'bg-purple-50'
                        }`}
                    onClick={() => setRangeMode('week')}
                >
                    <div className="text-xs text-purple-600 font-medium">This Week</div>
                    <div className="text-sm font-bold text-purple-900 mt-0.5">
                        {TimeService.formatTime(weekSeconds)}
                    </div>
                </div>
                <div
                    className={`rounded-lg p-2.5 text-center cursor-pointer transition-colors ${rangeMode === 'month' ? 'bg-amber-100 ring-1 ring-amber-300' : 'bg-amber-50'
                        }`}
                    onClick={() => setRangeMode('month')}
                >
                    <div className="text-xs text-amber-600 font-medium">This Month</div>
                    <div className="text-sm font-bold text-amber-900 mt-0.5">
                        {TimeService.formatTime(monthSeconds)}
                    </div>
                </div>
            </div>

            {/* Custom date range */}
            <div className="mb-3">
                <button
                    onClick={() => setRangeMode(rangeMode === 'custom' ? 'today' : 'custom')}
                    className={`text-xs cursor-pointer transition-colors ${rangeMode === 'custom'
                            ? 'text-blue-700 font-medium'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    {rangeMode === 'custom' ? '✕ Close' : '📅 Custom range'}
                </button>
                {rangeMode === 'custom' && (
                    <div className="flex gap-2 mt-1.5">
                        <input
                            type="date"
                            value={customStart}
                            onInput={(e) => setCustomStart(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 flex-1"
                        />
                        <span className="text-gray-400 text-xs self-center">to</span>
                        <input
                            type="date"
                            value={customEnd}
                            onInput={(e) => setCustomEnd(e.target.value)}
                            className="text-xs border border-gray-300 rounded px-2 py-1 flex-1"
                        />
                    </div>
                )}
            </div>

            {/* Per-repo breakdown */}
            <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Per-Repo Breakdown
                </div>
                {repoBreakdown.length === 0 ? (
                    <div className="text-sm text-gray-500 text-center py-6">
                        No tracked time yet. Start a timer on an issue!
                    </div>
                ) : (
                    repoBreakdown.map(({ repo, seconds, formatted }) => {
                        const percentage = totalFiltered > 0 ? Math.round((seconds / totalFiltered) * 100) : 0;
                        return (
                            <div key={repo} className="mb-3">
                                <div className="flex justify-between text-sm mb-0.5">
                                    <span className="text-gray-700 truncate flex-1">{repo}</span>
                                    <span className="text-gray-500 shrink-0 ml-2 text-xs">
                                        {formatted} ({percentage}%)
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div
                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(seconds / maxSeconds) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Total */}
            {totalFiltered > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100 text-center">
                    <span className="text-xs text-gray-500">Total tracked: </span>
                    <span className="text-sm font-semibold text-gray-700">
                        {TimeService.formatTime(totalFiltered)}
                    </span>
                </div>
            )}
        </div>
    );
}
