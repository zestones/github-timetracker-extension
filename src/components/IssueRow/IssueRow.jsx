import { TimeService } from '../../utils/time.js';
import { IconPlay, IconStop, IconExternalLink } from '../../icons.jsx';

export function IssueRow({ issue, isActive, onStart, onStop, trackedSeconds = 0 }) {
    return (
        <div className="flex items-center gap-2 py-2 px-2 hover:bg-slate-50 rounded-lg group transition-colors">
            <div className="flex-1 min-w-0">
                <div className="text-[13px] text-slate-900 truncate">
                    <span className="text-slate-400 font-mono text-[11px]">#{issue.number}</span>
                    <span className="ml-1.5">{issue.title}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    {trackedSeconds > 0 && (
                        <span className="font-mono">{TimeService.formatTime(trackedSeconds)}</span>
                    )}
                    <a
                        href={`https://github.com${issue.issueUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-indigo-600 hover:text-indigo-700 transition-all opacity-0 group-hover:opacity-100"
                    >
                        <IconExternalLink size={10} />
                        <span>View</span>
                    </a>
                </div>
            </div>
            <button
                onClick={() => (isActive ? onStop(issue) : onStart(issue))}
                className={`shrink-0 flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md cursor-pointer transition-all ${isActive
                    ? 'bg-red-50 text-red-700 hover:bg-red-100'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 opacity-0 group-hover:opacity-100'
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
