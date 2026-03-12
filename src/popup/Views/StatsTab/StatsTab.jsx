import { useMemo } from 'preact/hooks';
import { TimeService } from '../../../utils/time.js';
import { AggregationService } from '../../../utils/aggregation.js';

export function StatsTab({ tracked }) {
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
        () => AggregationService.getTimePerRepo(tracked),
        [tracked]
    );

    const maxSeconds = useMemo(
        () => Math.max(...repoBreakdown.map((r) => r.seconds), 1),
        [repoBreakdown]
    );

    const totalTracked = useMemo(
        () => AggregationService.getTotalSeconds(tracked),
        [tracked]
    );

    return (
        <div>
            {/* Time summary cards */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                    <div className="text-xs text-blue-600 font-medium">Today</div>
                    <div className="text-sm font-bold text-blue-900 mt-0.5">
                        {TimeService.formatTime(todaySeconds)}
                    </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-2.5 text-center">
                    <div className="text-xs text-purple-600 font-medium">This Week</div>
                    <div className="text-sm font-bold text-purple-900 mt-0.5">
                        {TimeService.formatTime(weekSeconds)}
                    </div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                    <div className="text-xs text-amber-600 font-medium">This Month</div>
                    <div className="text-sm font-bold text-amber-900 mt-0.5">
                        {TimeService.formatTime(monthSeconds)}
                    </div>
                </div>
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
                        const percentage = totalTracked > 0 ? Math.round((seconds / totalTracked) * 100) : 0;
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
            {totalTracked > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100 text-center">
                    <span className="text-xs text-gray-500">Total tracked: </span>
                    <span className="text-sm font-semibold text-gray-700">
                        {TimeService.formatTime(totalTracked)}
                    </span>
                </div>
            )}
        </div>
    );
}
