import { useState, useEffect } from 'preact/hooks';
import { TimeService } from '../../utils/time.js';
import { TimerService } from '../../utils/timer.js';
import { StorageService } from '../../utils/storage.js';
import { IssueStorageService } from '../../utils/issue-storage.js';
import { GitHubService } from '../../utils/github.js';
import { STORAGE_KEYS, TIME_UPDATE_INTERVAL } from '../../utils/constants.js';
import { IconStop } from '../../icons.jsx';

function extractCleanTitle(storedTitle) {
    if (!storedTitle) return 'Untitled';
    const parts = storedTitle.split(' | ');
    if (parts.length >= 3) return parts.slice(1, -1).join(' | ');
    if (parts.length === 2) return parts[1];
    return storedTitle;
}

export function ActiveTimer() {
    const [activeIssue, setActiveIssue] = useState(null);
    const [startTime, setStartTime] = useState(null);
    const [issueInfo, setIssueInfo] = useState(null);
    const [elapsed, setElapsed] = useState('00:00:00');
    const [totalTime, setTotalTime] = useState(0);

    useEffect(() => {
        const load = async () => {
            const [active, start] = await Promise.all([
                StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE),
                StorageService.get(STORAGE_KEYS.START_TIME),
            ]);
            setActiveIssue(active);
            setStartTime(start);

            if (active) {
                const issue = await IssueStorageService.getByUrl(active);
                try {
                    const parsed = GitHubService.parseIssueUrl(active);
                    setIssueInfo({
                        ...parsed,
                        title: extractCleanTitle(issue?.title),
                    });
                } catch (e) {
                    setIssueInfo({ fullRepo: 'unknown', issueNumber: 0, title: issue?.title || 'Untitled' });
                }
                const total = await TimerService.getTotalTimeForIssue(active);
                setTotalTime(total);
            }
        };
        load();

        const listener = (changes, area) => {
            if (area !== 'local') return;
            if (changes[STORAGE_KEYS.ACTIVE_ISSUE]) {
                const newActive = changes[STORAGE_KEYS.ACTIVE_ISSUE].newValue;
                setActiveIssue(newActive || null);
                if (newActive) {
                    IssueStorageService.getByUrl(newActive).then((issue) => {
                        try {
                            const parsed = GitHubService.parseIssueUrl(newActive);
                            setIssueInfo({
                                ...parsed,
                                title: extractCleanTitle(issue?.title),
                            });
                        } catch (e) {
                            setIssueInfo({ fullRepo: 'unknown', issueNumber: 0, title: issue?.title || 'Untitled' });
                        }
                    });
                    TimerService.getTotalTimeForIssue(newActive).then(setTotalTime);
                } else {
                    setIssueInfo(null);
                    setTotalTime(0);
                }
            }
            if (changes[STORAGE_KEYS.START_TIME]) {
                setStartTime(changes[STORAGE_KEYS.START_TIME].newValue || null);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

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
        await TimerService.stopTimer(activeIssue);
        chrome.runtime.sendMessage({ action: 'timerStopped', issueUrl: activeIssue });
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
