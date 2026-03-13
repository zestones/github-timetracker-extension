import { useState, useEffect, useRef } from 'preact/hooks';
import { GitHubService } from '../utils/github.js';
import { DEBOUNCE_SEARCH_MS } from '../utils/constants.js';
import { IconX, IconSearch, IconCheck, IconPin } from '../icons.jsx';

export function PinRepoModal({ onClose, onPin, pinnedRepos }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const timerRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        inputRef.current?.focus();
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const handleSearch = (value) => {
        setQuery(value);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (!value.trim()) {
            setResults([]);
            return;
        }

        timerRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const repos = await GitHubService.searchRepositories(value);
                setResults(
                    repos.map((r) => ({
                        fullName: r.full_name,
                        owner: r.owner.login,
                        repo: r.name,
                        description: r.description,
                    }))
                );
            } catch (error) {
                console.error('Search failed:', error);
            }
            setSearching(false);
        }, DEBOUNCE_SEARCH_MS);
    };

    const isPinned = (fullName) => pinnedRepos.some((r) => r.fullName === fullName);

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-surface rounded-xl w-90 max-h-100 shadow-2xl shadow-black/20 flex flex-col overflow-hidden">
                <div className="px-4 pt-4 pb-3">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[14px] font-semibold text-primary">Pin a Repository</h3>
                        <button
                            onClick={onClose}
                            className="text-muted hover:text-secondary cursor-pointer p-0.5 rounded-md hover:bg-raised transition-colors"
                        >
                            <IconX size={16} />
                        </button>
                    </div>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                            <IconSearch size={14} />
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Search repositories..."
                            value={query}
                            onInput={(e) => handleSearch(e.currentTarget.value)}
                            className="w-full pl-8 pr-3 py-2 text-[13px] bg-raised border border-border-default rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 text-primary placeholder:text-muted"
                        />
                    </div>
                </div>
                <div className="overflow-y-auto flex-1 px-2 pb-3 popup-scroll">
                    {searching && (
                        <div className="text-[13px] text-muted text-center py-8">Searching...</div>
                    )}
                    {!searching && query && results.length === 0 && (
                        <div className="text-[13px] text-muted text-center py-8">No repositories found</div>
                    )}
                    {!searching &&
                        results.map((repo) => (
                            <div
                                key={repo.fullName}
                                className="flex items-center gap-2 p-2.5 hover:bg-raised rounded-lg transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-medium text-primary truncate">
                                        {repo.fullName}
                                    </div>
                                    {repo.description && (
                                        <div className="text-[11px] text-muted truncate mt-0.5">
                                            {repo.description}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        if (!isPinned(repo.fullName)) {
                                            onPin(repo);
                                        }
                                    }}
                                    disabled={isPinned(repo.fullName)}
                                    className={`shrink-0 flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md cursor-pointer transition-colors ${isPinned(repo.fullName)
                                        ? 'bg-raised text-muted cursor-default'
                                        : 'bg-accent-subtle text-accent-text hover:bg-accent-ring'
                                        }`}
                                >
                                    {isPinned(repo.fullName) ? (
                                        <><IconCheck size={12} /> Pinned</>
                                    ) : (
                                        <><IconPin size={12} /> Pin</>
                                    )}
                                </button>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}
