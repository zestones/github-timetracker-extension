import { TimeService } from '../utils/time.utils.js';
import { IconPlay, IconStop, IconExternalLink } from '../icons.jsx';

export function IssueRow({ issue, isActive, onStart, onStop, trackedSeconds = 0 }) {
    const isClosed = issue.state === 'closed';
    return (
        <div className={`flex items-center gap-2 py-2 px-2 hover:bg-surface rounded-lg group transition-colors ${isClosed ? 'opacity-70' : ''}`}>
            <div className="flex-1 min-w-0">
                <div className="text-[13px] text-primary truncate">
                    <span className="text-muted font-mono text-[11px]">#{issue.number}</span>
                    {isClosed && (
                        <span className="ml-1 text-[10px] text-muted bg-raised px-1.5 py-0.5 rounded-full">closed</span>
                    )}
                    <span className={`ml-1.5 ${isClosed ? 'line-through text-secondary' : ''}`}>{issue.title}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted mt-0.5">
                    {trackedSeconds > 0 && (
                        <span className="font-mono">{TimeService.formatTime(trackedSeconds)}</span>
                    )}
                    <a
                        href={`https://github.com${issue.issueUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-accent hover:text-accent-hover transition-all opacity-0 group-hover:opacity-100"
                    >
                        <IconExternalLink size={10} />
                        <span>View</span>
                    </a>
                </div>
            </div>
            <button
                onClick={() => (isActive ? onStop(issue) : onStart(issue))}
                className={`shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md cursor-pointer transition-all ${isActive
                    ? 'bg-danger-subtle text-danger-text hover:bg-danger-hover'
                    : 'bg-success-subtle text-success-text hover:bg-success-hover opacity-0 group-hover:opacity-100'
                    }`}
            >
                {isActive ? (
                    <><IconStop size={10} /> Stop</>
                ) : (
                    <><IconPlay size={10} /> Start</>
                )}
            </button>
        </div>
    );
}
