export const GITHUB_API_URL = 'https://api.github.com';
export const STORAGE_KEYS = {
    GITHUB_TOKEN: 'githubToken',
    ACTIVE_ISSUE: 'activeIssue',
    START_TIME: 'startTime',
    TRACKED_TIMES: 'trackedTimes',
    ISSUES: 'issues',
    PINNED_REPOS: 'pinnedRepos',
    CACHED_USER: 'cachedUser',
};
export const CACHE_PREFIX = 'cache:';
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const CACHE_REFRESH_INTERVAL = 15; // minutes, for chrome.alarms
export const TIME_UPDATE_INTERVAL = 1000;
export const COMMENT_TEMPLATE = (timeString) => `⏱️ Tracked time: **${timeString}**`;