import { useEffect, useState, useRef } from 'preact/hooks';
import { TimerService } from '../../utils/timer.js';
import { TimeService } from '../../utils/time.js';
import { STORAGE_KEYS, TIME_UPDATE_INTERVAL } from '../../utils/constants.js';
import { useActiveTimer } from '../../hooks/useActiveTimer.js';
import { IconPlay, IconStop, IconExternalLink } from '../../icons.jsx';

export function TrackedList({ entries, showTimerControls = false }) {
    const { activeIssue, startTime, isActive: isTimerActive } = useActiveTimer();
    const [currentTimes, setCurrentTimes] = useState({});

    // Initialize elapsed time on mount
    useEffect(() => {
        if (activeIssue && startTime && !isNaN(new Date(startTime).getTime())) {
            const elapsed = (Date.now() - new Date(startTime).getTime()) / 1000;
            setCurrentTimes((prev) => ({
                ...prev,
                [activeIssue]: TimeService.formatTime(elapsed),
            }));
        }
    }, [activeIssue, startTime]);

    const intervalRef = useRef(null);

    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (!showTimerControls) return;

        if (!activeIssue || !startTime || isNaN(new Date(startTime).getTime())) {
            setCurrentTimes((prev) => {
                const newTimes = { ...prev };
                delete newTimes[activeIssue];
                return newTimes;
            });
            return;
        }

        intervalRef.current = setInterval(() => {
            const elapsed = (Date.now() - new Date(startTime).getTime()) / 1000;
            setCurrentTimes((prev) => ({
                ...prev,
                [activeIssue]: TimeService.formatTime(elapsed),
            }));
        }, TIME_UPDATE_INTERVAL);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [activeIssue, startTime, showTimerControls]);

    const handleTimerClick = async (entry) => {
        if (entry.issueUrl === activeIssue && startTime && !isNaN(new Date(startTime).getTime())) {
            await TimerService.stopTimer(entry.issueUrl);
            setCurrentTimes((prev) => {
                const newTimes = { ...prev };
                delete newTimes[entry.issueUrl];
                return newTimes;
            });
            chrome.runtime.sendMessage({ action: 'timerStopped', issueUrl: entry.issueUrl });
        } else {
            await TimerService.startTimer(entry.issueUrl);
            chrome.runtime.sendMessage({ action: 'timerStarted', issueUrl: entry.issueUrl });
        }
    };

    const isActive = (entry) => isTimerActive(entry.issueUrl);

    return (
        <div className="space-y-1">
            {entries.map((entry, i) => (
                <div
                    key={entry.issueUrl || i}
                    className="flex items-center gap-2 p-2 hover:bg-surface rounded-lg group transition-colors"
                >
                    <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-primary truncate leading-snug">
                            {entry.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted">
                            <span className="font-mono tabular-nums">
                                {isActive(entry) && currentTimes[entry.issueUrl]
                                    ? currentTimes[entry.issueUrl]
                                    : entry.displayTime}
                            </span>
                            {entry.date && (
                                <>
                                    <span className="text-faint">·</span>
                                    <span>{entry.date}</span>
                                </>
                            )}
                            <a
                                href={`https://github.com${entry.issueUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-accent hover:text-accent-hover transition-colors"
                            >
                                <IconExternalLink size={10} />
                                <span>View</span>
                            </a>
                        </div>
                    </div>
                    {showTimerControls && (
                        <button
                            onClick={() => handleTimerClick(entry)}
                            className={`shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md cursor-pointer transition-all ${isActive(entry)
                                ? 'bg-danger-subtle text-danger-text hover:bg-danger-hover'
                                : 'bg-success-subtle text-success-text hover:bg-success-hover opacity-0 group-hover:opacity-100'
                                }`}
                        >
                            {isActive(entry) ? (
                                <><IconStop size={10} /> Stop</>
                            ) : (
                                <><IconPlay size={10} /> Start</>
                            )}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}