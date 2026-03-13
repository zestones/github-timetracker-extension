import { TimeService } from './time.js';
import { GitHubService } from './github.js';
import { StorageService } from './storage.js';
import { GitHubStorageService } from './github-storage.js';
import { STORAGE_KEYS } from './constants.js';
import { IssueStorageService } from "./issue-storage.js";

export class TimerService {
    /** @param {string} issueUrl @returns {Promise<number>} Total seconds */
    static async getTotalTimeForIssue(issueUrl) {
        /** @type {import('./schema.js').TrackedTimeEntry[]} */
        const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) ?? [];
        return trackedTimes
            .filter(entry => entry.issueUrl === issueUrl)
            .reduce((total, entry) => total + (entry.seconds || 0), 0);
    }

    /** @param {string} issueUrl @param {string|null} [issueTitle] @returns {Promise<import('./schema.js').TimerResult>} */
    static async startTimer(issueUrl, issueTitle = null) {
        try {
            const [activeIssueUrl, startTime, issue] = await Promise.all([
                StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE),
                StorageService.get(STORAGE_KEYS.START_TIME),
                IssueStorageService.getByUrl(issueUrl),
            ]);

            if (activeIssueUrl && startTime && activeIssueUrl !== issueUrl) {
                await this.stopTimer(activeIssueUrl);
            }

            const issueInfo = GitHubService.parseIssueUrl(issueUrl);
            const { owner, repo, issueNumber } = issueInfo;
            const title = issueTitle || 'Untitled';
            const fullIssueTitle = `(${owner}) ${repo} | ${title} | #${issueNumber}`;

            await Promise.all([
                StorageService.set(STORAGE_KEYS.ACTIVE_ISSUE, issueUrl),
                StorageService.set(STORAGE_KEYS.START_TIME, new Date().toISOString()),
            ]);

            if (!issue) {
                await IssueStorageService.add({ url: issueUrl, title: fullIssueTitle });
            }

            const totalTime = await this.getTotalTimeForIssue(issueUrl);
            chrome.runtime.sendMessage({ action: 'timerStarted', issueUrl });
            return { issueUrl, totalTime, isRunning: true };
        } catch (error) {
            console.error('Failed to start timer:', error);
            await StorageService.removeMultiple([
                STORAGE_KEYS.ACTIVE_ISSUE,
                STORAGE_KEYS.START_TIME,
            ]);
            return { issueUrl, totalTime: 0, isRunning: false };
        }
    }

    /** @param {string} issueUrl @returns {Promise<import('./schema.js').TimerResult>} */
    static async stopTimer(issueUrl) {
        try {
            const [startTime, githubToken, trackedTimes, existingIssue] = await Promise.all([
                StorageService.get(STORAGE_KEYS.START_TIME),
                GitHubStorageService.getGitHubToken(),
                StorageService.get(STORAGE_KEYS.TRACKED_TIMES),
                IssueStorageService.getByUrl(issueUrl),
            ]);

            if (!startTime || isNaN(new Date(startTime).getTime())) {
                console.error('Invalid startTime:', startTime);
                await StorageService.removeMultiple([
                    STORAGE_KEYS.ACTIVE_ISSUE,
                    STORAGE_KEYS.START_TIME,
                ]);
                return { issueUrl, totalTime: 0, isRunning: false };
            }

            const taskTitle = existingIssue?.title || 'Untitled';
            const timeSpentSeconds = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);

            const issueInfo = GitHubService.parseIssueUrl(issueUrl);
            const { owner, repo, issueNumber } = issueInfo;

            const updatedTrackedTimes = [...(trackedTimes ?? []), {
                issueUrl,
                title: taskTitle,
                seconds: timeSpentSeconds,
                date: TimeService.getLocalDateString(),
            }];

            await Promise.all([
                StorageService.set(STORAGE_KEYS.TRACKED_TIMES, updatedTrackedTimes),
                StorageService.removeMultiple([
                    STORAGE_KEYS.ACTIVE_ISSUE,
                    STORAGE_KEYS.START_TIME,
                ]),
            ]);

            const totalTime = await this.getTotalTimeForIssue(issueUrl);

            // Sync to GitHub in the background (non-blocking)
            if (githubToken) {
                this.syncCommentInBackground(issueUrl, owner, repo, issueNumber, updatedTrackedTimes);
            }

            chrome.runtime.sendMessage({ action: 'timerStopped', issueUrl });
            return { issueUrl, totalTime, isRunning: false };
        } catch (error) {
            console.error('Failed to stop timer:', error);
            return { issueUrl, totalTime: 0, isRunning: false };
        }
    }

    static syncCommentInBackground(issueUrl, owner, repo, issueNumber, trackedTimes) {
        (async () => {
            try {
                const issueEntries = trackedTimes
                    .filter(e => e.issueUrl === issueUrl)
                    .map(e => ({ date: e.date, seconds: e.seconds }));

                const commentIds = (await StorageService.get(STORAGE_KEYS.COMMENT_IDS)) ?? {};
                const username = await GitHubService.getCurrentUsername();
                const commentKey = `${username}:${issueUrl}`;
                const result = await GitHubService.createOrUpdateTrackerComment({
                    owner, repo, issueNumber,
                    entries: issueEntries,
                    cachedCommentId: commentIds[commentKey],
                });

                commentIds[commentKey] = result.commentId;
                await StorageService.set(STORAGE_KEYS.COMMENT_IDS, commentIds);
            } catch (error) {
                console.error('Background sync failed:', error);
            }
        })();
    }
}