import { useState, useEffect, useCallback } from 'preact/hooks';
import { CacheService } from '../utils/cache.js';
import { PinnedReposService } from '../utils/pinned-repos.js';
import { GitHubService } from '../utils/github.js';

export function useIssuesData() {
    const [pinnedRepos, setPinnedRepos] = useState([]);
    const [repoIssues, setRepoIssues] = useState({});
    const [loading, setLoading] = useState({});
    const [currentUser, setCurrentUser] = useState(null);

    const refreshRepoIssues = useCallback(async (repo) => {
        setLoading((prev) => ({ ...prev, [repo.fullName]: true }));
        try {
            const [owner, repoName] = repo.fullName.split('/');
            const issues = await GitHubService.getRepoIssues(owner, repoName);
            const simplified = issues.map((i) => GitHubService.simplifyIssue(i, repo.fullName));
            await CacheService.setCachedIssues(repo.fullName, simplified);
            setRepoIssues((prev) => ({ ...prev, [repo.fullName]: simplified }));
        } catch (error) {
            console.error(`Failed to fetch issues for ${repo.fullName}:`, error);
        }
        setLoading((prev) => ({ ...prev, [repo.fullName]: false }));
    }, []);

    useEffect(() => {
        const load = async () => {
            const repos = await PinnedReposService.getPinnedRepos();
            setPinnedRepos(repos);

            const cachedUser = await CacheService.getCachedUser();
            if (cachedUser) {
                setCurrentUser(cachedUser.login);
            } else {
                try {
                    const user = await GitHubService.getUser();
                    await CacheService.setCachedUser({ login: user.login, avatar_url: user.avatar_url, name: user.name });
                    setCurrentUser(user.login);
                } catch (e) {
                    console.error('Failed to fetch user:', e);
                }
            }

            for (const repo of repos) {
                const cached = await CacheService.getCachedIssues(repo.fullName);
                if (cached) {
                    setRepoIssues((prev) => ({ ...prev, [repo.fullName]: cached }));
                } else {
                    refreshRepoIssues(repo);
                }
            }
        };
        load();
    }, [refreshRepoIssues]);

    const pinRepo = useCallback(async (repo) => {
        await PinnedReposService.addPinnedRepo(repo);
        const updated = await PinnedReposService.getPinnedRepos();
        setPinnedRepos(updated);
        refreshRepoIssues(repo);
    }, [refreshRepoIssues]);

    const unpinRepo = useCallback(async (fullName) => {
        await PinnedReposService.removePinnedRepo(fullName);
        setPinnedRepos((prev) => prev.filter((r) => r.fullName !== fullName));
        setRepoIssues((prev) => {
            const next = { ...prev };
            delete next[fullName];
            return next;
        });
    }, []);

    return { pinnedRepos, repoIssues, loading, currentUser, refreshRepoIssues, pinRepo, unpinRepo };
}
