// background/index.js
import { StorageService } from '../utils/storage.js';
import { GitHubService } from '../utils/github.js';
import { GitHubStorageService } from '../utils/github-storage.js';
import { STORAGE_KEYS, CACHE_REFRESH_INTERVAL } from '../utils/constants.js';
import { IssueStorageService } from "../utils/issue-storage.js";
import { CacheService } from '../utils/cache.js';

async function refreshCachedIssues() {
    const token = await GitHubStorageService.getGitHubToken();
    if (!token) return;

    const pinnedRepos = await CacheService.getPinnedRepos();
    for (const repo of pinnedRepos) {
        try {
            const [owner, repoName] = repo.fullName.split('/');
            const issues = await GitHubService.getRepoIssues(owner, repoName);
            const simplified = issues.map((i) => ({
                number: i.number,
                title: i.title,
                issueUrl: `/${repo.fullName}/issues/${i.number}`,
                state: i.state,
                labels: (i.labels || []).map((l) => l.name),
                assignees: (i.assignees || []).map((a) => a.login),
                user: i.user?.login || '',
            }));
            await CacheService.setCachedIssues(repo.fullName, simplified);
        } catch (error) {
            console.error(`Background refresh failed for ${repo.fullName}:`, error);
        }
    }

    // Refresh user cache
    try {
        const user = await GitHubService.getUser();
        await CacheService.setCachedUser({
            login: user.login,
            avatar_url: user.avatar_url,
            name: user.name,
        });
    } catch (error) {
        console.error('Background user refresh failed:', error);
    }
}

// Set up periodic alarm for cache refresh
chrome.alarms.create('refreshCache', { periodInMinutes: CACHE_REFRESH_INTERVAL });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'refreshCache') {
        refreshCachedIssues();
    }
});

async function handleTimerStop(reason) {
    const { activeIssue, startTime, trackedTimes } = await StorageService.getMultiple([
        STORAGE_KEYS.ACTIVE_ISSUE,
        STORAGE_KEYS.START_TIME,
        STORAGE_KEYS.TRACKED_TIMES,
    ]);

    if (activeIssue && startTime) {
        const timeSpent = (Date.now() - new Date(startTime).getTime()) / 1000;
        const issue = await IssueStorageService.getByUrl(activeIssue);
        console.log(`Stopped due to ${reason}. Tracked ${timeSpent} seconds on ${activeIssue}`);

        let issueInfo;
        try {
            issueInfo = GitHubService.parseIssueUrl(activeIssue);
        } catch (error) {
            console.error('Failed to parse issue URL:', error);
            return;
        }

        const { owner, repo, issueNumber } = issueInfo;
        const taskTitle = issue?.title || 'Untitled';

        const tracked = trackedTimes || [];
        tracked.push({
            issueUrl: activeIssue,
            title: taskTitle,
            seconds: timeSpent,
            date: new Date().toISOString().slice(0, 10),
        });
        await StorageService.set(STORAGE_KEYS.TRACKED_TIMES, tracked);

        const token = await GitHubStorageService.getGitHubToken();
        if (token) {
            try {
                await GitHubService.postComment({ owner, repo, issueNumber, seconds: timeSpent });
            } catch (error) {
                console.error('Failed to post comment:', error);
            }
        }

        await StorageService.removeMultiple([
            STORAGE_KEYS.ACTIVE_ISSUE,
            STORAGE_KEYS.START_TIME,
        ]);
    }
}

chrome.runtime.onStartup.addListener(async () => {
    await handleTimerStop('browser restart');
});

chrome.runtime.onSuspend.addListener(async () => {
    await handleTimerStop('browser closing');
});

// Пересылка сообщений timerStarted/timerStopped ко всем вкладкам GitHub
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    if (message.action === 'timerStarted' || message.action === 'timerStopped') {
        // Рассылаем сообщение всем вкладкам GitHub
        chrome.tabs.query({ url: '*://github.com/*' }, (tabs) => {
            tabs.forEach((tab) => {
                chrome.tabs.sendMessage(tab.id, message, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log(`Failed to send message to tab ${tab.id}:`, chrome.runtime.lastError.message);
                    } else {
                        console.log(`Message sent to tab ${tab.id}, response:`, response);
                    }
                });
            });
        });
        sendResponse({ received: true });
    }
});