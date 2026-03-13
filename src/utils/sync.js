import { GitHubService } from './github.js';
import { StorageService } from './storage.js';
import { IssueStorageService } from './issue-storage.js';
import { PinnedReposService } from './pinned-repos.js';
import { STORAGE_KEYS } from './constants.js';

/**
 * Recovers tracked times from GitHub comments for all pinned repos.
 * Merges remote data into local storage (imports if no local data or remote has more).
 * Returns { importedCount } or null if nothing to recover.
 */
export async function syncFromGitHub() {
    const pinnedRepos = await PinnedReposService.getPinnedRepos();
    if (pinnedRepos.length === 0) return null;

    const recovered = await GitHubService.recoverAllTimes(pinnedRepos);
    if (recovered.length === 0) return null;

    // Fetch issue titles from GitHub API for proper display
    const issueTitleMap = {};
    const repoSet = new Set(recovered.map(item => {
        const { owner, repo } = GitHubService.parseIssueUrl(item.issueUrl);
        return `${owner}/${repo}`;
    }));
    for (const fullRepo of repoSet) {
        const [owner, repoName] = fullRepo.split('/');
        try {
            const issues = await GitHubService.getRepoIssues(owner, repoName);
            for (const issue of issues) {
                issueTitleMap[`/${owner}/${repoName}/issues/${issue.number}`] = issue.title;
            }
        } catch (e) {
            console.error(`Failed to fetch issue titles for ${fullRepo}:`, e);
        }
    }

    const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) || [];
    const commentIds = (await StorageService.get(STORAGE_KEYS.COMMENT_IDS)) || {};
    const username = await GitHubService.getCurrentUsername();
    let importedCount = 0;

    for (const item of recovered) {
        const commentKey = `${username}:${item.issueUrl}`;
        commentIds[commentKey] = item.commentId;

        const localEntries = trackedTimes.filter(t => t.issueUrl === item.issueUrl);
        const localTotal = localEntries.reduce((sum, e) => sum + (e.seconds || 0), 0);
        const remoteTotal = item.entries.reduce((sum, e) => sum + (e.seconds || 0), 0);

        if (localEntries.length === 0 || remoteTotal > localTotal) {
            const filtered = trackedTimes.filter(t => t.issueUrl !== item.issueUrl);
            trackedTimes.length = 0;
            trackedTimes.push(...filtered);

            const { owner, repo, issueNumber } = GitHubService.parseIssueUrl(item.issueUrl);
            const apiTitle = issueTitleMap[item.issueUrl];
            const title = apiTitle
                ? `(${owner}) ${repo} | ${apiTitle} | #${issueNumber}`
                : `(${owner}) ${repo} | #${issueNumber}`;
            for (const entry of item.entries) {
                trackedTimes.push({
                    issueUrl: item.issueUrl,
                    title,
                    seconds: entry.seconds,
                    date: entry.date,
                });
                importedCount++;
            }
        }

        const issueExists = await IssueStorageService.exists(item.issueUrl);
        if (!issueExists) {
            const { owner, repo, issueNumber } = GitHubService.parseIssueUrl(item.issueUrl);
            const apiTitle = issueTitleMap[item.issueUrl];
            const title = apiTitle
                ? `(${owner}) ${repo} | ${apiTitle} | #${issueNumber}`
                : `(${owner}) ${repo} | #${issueNumber}`;
            await IssueStorageService.add({ url: item.issueUrl, title });
        }
    }

    await StorageService.set(STORAGE_KEYS.TRACKED_TIMES, trackedTimes);
    await StorageService.set(STORAGE_KEYS.COMMENT_IDS, commentIds);

    return { importedCount };
}
