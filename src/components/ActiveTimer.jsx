import { useState, useEffect } from 'preact/hooks';
import { TimeService } from '../utils/time.js';
import { TimerService } from '../utils/timer.js';
import { IssueStorageService } from '../utils/issue-storage.js';
import { GitHubService } from '../utils/github.js';
import { AggregationService } from '../utils/aggregation.js';
import { STORAGE_KEYS, TIME_UPDATE_INTERVAL } from '../utils/constants.js';
import { useActiveTimer } from '../hooks/useActiveTimer.js';
import { IconStop } from '../icons.jsx';

export function ActiveTimer() {
    const { activeIssue, startTime, stop } = useActiveTimer();
    const [issueInfo, setIssueInfo] = useState(null);
    const [elapsed, setElapsed] = useState('00:00:00');
    const [totalTime, setTotalTime] = useState(0);

    useEffect(() => {
        if (!activeIssue) {
            setIssueInfo(null);
            setTotalTime(0);
            return;
        }

        const loadInfo = async () => {
            const issue = await IssueStorageService.getByUrl(activeIssue);
            try {
                const parsed = GitHubService.parseIssueUrl(activeIssue);
                setIssueInfo({
                    ...parsed,
                    title: AggregationService.extractCleanTitle(issue?.title),
                });
            } catch (e) {
                setIssueInfo({ fullRepo: 'unknown', issueNumber: 0, title: issue?.title || 'Untitled' });
            }
            const total = await TimerService.getTotalTimeForIssue(activeIssue);
            setTotalTime(total);
        };
        loadInfo();
    }, [activeIssue]);

    useEffect(() => {
        if (!activeIssue || !startTime) {
            setElapsed('00:00:00');
            return;
        }

        const update = () => {
            setElapsed(TimeService.timeStringSince(startTime, totalTime));
        };
        update();

        const id = setInterval(update, TIME_UPDATE_INTERVAL);
        return () => clearInterval(id);
    }, [activeIssue, startTime, totalTime]);

    const handleStop = async () => {
        if (!activeIssue) return;
        await stop();
    };

    if (!activeIssue || !startTime) return null;

    return (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-success-subtle border-b border-success-border shrink-0">
            <div className="w-2 h-2 rounded-full bg-success-dot animate-pulse-dot shrink-0" />
            <div className="flex-1 min-w-0">
                <div className="text-[11px] text-success-muted truncate">
                    {issueInfo?.fullRepo} #{issueInfo?.issueNumber}
                </div>
                <div className="text-[13px] font-medium text-success-text truncate">
                    {issueInfo?.title || 'Untitled'}
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-mono font-semibold text-success-text tabular-nums">{elapsed}</span>
                <button
                    onClick={handleStop}
                    className="flex items-center gap-1 bg-danger-muted hover:bg-danger-hover text-white text-[11px] font-medium pl-1.5 pr-2 py-1 rounded-md cursor-pointer transition-colors"
                >
                    <IconStop size={10} />
                    Stop
                </button>
            </div>
        </div>
    );
}
