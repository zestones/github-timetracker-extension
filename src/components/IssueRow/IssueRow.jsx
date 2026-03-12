import { TimeService } from '../../utils/time.js';

export function IssueRow({ issue, isActive, onStart, onStop, trackedSeconds = 0 }) {
    return (
        <div className="flex items-center justify-between py-1.5 px-1 hover:bg-gray-50 rounded group">
            <div className="flex-1 min-w-0 mr-2">
                <div className="text-sm truncate">
                    <span className="text-gray-400">#{issue.number}</span>{' '}
                    <span className="text-gray-800">{issue.title}</span>
                </div>
                {trackedSeconds > 0 && (
                    <div className="text-xs text-gray-400 mt-0.5">
                        {TimeService.formatTime(trackedSeconds)}
                    </div>
                )}
            </div>
            <button
                onClick={() => (isActive ? onStop(issue) : onStart(issue))}
                className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded cursor-pointer transition-colors ${isActive
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200 opacity-0 group-hover:opacity-100'
                    }`}
                style={isActive ? {} : undefined}
            >
                {isActive ? '■ Stop' : '▶ Start'}
            </button>
        </div>
    );
}
