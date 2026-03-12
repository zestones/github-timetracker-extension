import { useState, useEffect, useRef } from 'preact/hooks';
import { GitHubService } from '../../utils/github.js';

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
        }, 400);
    };

    const isPinned = (fullName) => pinnedRepos.some((r) => r.fullName === fullName);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg w-[380px] max-h-[420px] shadow-xl flex flex-col">
                <div className="p-3 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-gray-800">Pin a Repository</h3>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 cursor-pointer text-lg leading-none"
                        >
                            ✕
                        </button>
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search repositories..."
                        value={query}
                        onInput={(e) => handleSearch(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <div className="overflow-y-auto flex-1 p-2">
                    {searching && (
                        <div className="text-sm text-gray-500 text-center py-6">Searching...</div>
                    )}
                    {!searching && query && results.length === 0 && (
                        <div className="text-sm text-gray-500 text-center py-6">No repositories found</div>
                    )}
                    {!searching &&
                        results.map((repo) => (
                            <div
                                key={repo.fullName}
                                className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                            >
                                <div className="flex-1 min-w-0 mr-2">
                                    <div className="text-sm font-medium text-gray-800 truncate">
                                        {repo.fullName}
                                    </div>
                                    {repo.description && (
                                        <div className="text-xs text-gray-500 truncate">
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
                                    className={`shrink-0 text-xs px-2.5 py-1 rounded cursor-pointer transition-colors ${isPinned(repo.fullName)
                                            ? 'bg-gray-100 text-gray-400 cursor-default'
                                            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                        }`}
                                >
                                    {isPinned(repo.fullName) ? '✓ Pinned' : '📌 Pin'}
                                </button>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
}
