import { TimeService } from './time.js';
import { GitHubService } from './github.js';
import { StorageService } from './storage.js';
import { GitHubStorageService } from './github-storage.js';
import { STORAGE_KEYS, TIME_UPDATE_INTERVAL } from './constants.js';
import { IssueStorageService } from "./issue-storage.js";

export class TimerService {
    /**
     * Вычисляет общее затраченное время для указанного URL задачи
     * @param {string} issueUrl - URL задачи
     * @returns {Promise<number>} Общее время в секундах
     */
    static async getTotalTimeForIssue(issueUrl) {
        const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) || [];
        return trackedTimes
            .filter(entry => entry.issueUrl === issueUrl)
            .reduce((total, entry) => total + (entry.seconds || 0), 0);
    }

    /**
     * Запускает таймер для указанного URL задачи
     * @param {string} issueUrl - URL задачи
     * @param {HTMLButtonElement | null} buttonElement - Кнопка, связанная с таймером (необязательно)
     * @returns {Promise<{ issueUrl: string; totalTime: number; intervalId: number | null; isRunning: boolean; }>} Объект с информацией о задаче и статусе таймера
     */
    static async startTimer(issueUrl, buttonElement = null) {
        try {
            const [activeIssueUrl, startTime, issue] = await Promise.all([
                StorageService.get(STORAGE_KEYS.ACTIVE_ISSUE),
                StorageService.get(STORAGE_KEYS.START_TIME),
                IssueStorageService.getByUrl(issueUrl),
            ]);

            if (activeIssueUrl && startTime && activeIssueUrl !== issueUrl) {
                console.log(`Останавливаем таймер для предыдущей задачи: ${activeIssueUrl}`);
                await this.stopTimer(activeIssueUrl, buttonElement);
            }

            const issueInfo = GitHubService.parseIssueUrl(issueUrl);
            const { owner, repo, issueNumber } = issueInfo;
            const issueTitle = this.getIssueTitle() || 'Untitled';
            const fullIssueTitle = `(${owner}) ${repo} | ${issueTitle} | #${issueNumber}`;

            await Promise.all([
                StorageService.set(STORAGE_KEYS.ACTIVE_ISSUE, issueUrl),
                StorageService.set(STORAGE_KEYS.START_TIME, new Date().toISOString()),
            ]);

            if (!issue) {
                await IssueStorageService.add({ url: issueUrl, title: fullIssueTitle });
            }

            const totalTime = await this.getTotalTimeForIssue(issueUrl);
            let intervalId = null;

            if (buttonElement) {
                buttonElement.textContent = `${TimeService.formatTime(0, totalTime)} ⏸ Stop`;
                intervalId = window.setInterval(async () => {
                    const startTime = await StorageService.get(STORAGE_KEYS.START_TIME);
                    if (!startTime || isNaN(new Date(startTime).getTime())) {
                        clearInterval(intervalId);
                        buttonElement.textContent = `${TimeService.formatTime(0, totalTime)} Start Timer`;
                        return;
                    }
                    buttonElement.textContent = `${TimeService.timeStringSince(startTime, totalTime)} ⏸ Stop`;
                }, TIME_UPDATE_INTERVAL);
                buttonElement.dataset.intervalId = intervalId.toString();
            }

            return { issueUrl, totalTime, intervalId, isRunning: true };
        } catch (error) {
            console.error('Не удалось запустить таймер:', error);
            if (buttonElement?.dataset.intervalId) {
                clearInterval(parseInt(buttonElement.dataset.intervalId, 10));
                buttonElement.textContent = 'Start Timer';
            }
            await StorageService.removeMultiple([
                STORAGE_KEYS.ACTIVE_ISSUE,
                STORAGE_KEYS.START_TIME,
            ]);
            return { issueUrl, totalTime: 0, intervalId: null, isRunning: false };
        }
    }

    /**
     * Форматирует текущую локальную дату в формате YYYY-MM-DD
     * @returns {string} Дата в формате YYYY-MM-DD
     */
    static getLocalDateString() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Останавливает таймер для указанного URL задачи
     * @param {string} issueUrl - URL задачи
     * @param {HTMLButtonElement | null} buttonElement - Кнопка, связанная с таймером (необязательно)
     * @returns {Promise<{ issueUrl: string; totalTime: number; isRunning: boolean }>} Объект с информацией о задаче и статусе таймера
     */
    static async stopTimer(issueUrl, buttonElement = null) {
        try {
            const [startTime, githubToken, trackedTimes, existingIssue] = await Promise.all([
                StorageService.get(STORAGE_KEYS.START_TIME),
                GitHubStorageService.getGitHubToken(),
                StorageService.get(STORAGE_KEYS.TRACKED_TIMES),
                IssueStorageService.getByUrl(issueUrl),
            ]);

            if (!startTime || isNaN(new Date(startTime).getTime())) {
                console.error('Некорректное startTime:', startTime);
                this.resetButtonState(buttonElement);
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

            const updatedTrackedTimes = [...(trackedTimes || []), {
                issueUrl,
                title: taskTitle,
                seconds: timeSpentSeconds,
                date: this.getLocalDateString(),
            }];

            if (githubToken) {
                try {
                    const issueEntries = updatedTrackedTimes
                        .filter(e => e.issueUrl === issueUrl)
                        .map(e => ({ date: e.date, seconds: e.seconds }));

                    const commentIds = (await StorageService.get(STORAGE_KEYS.COMMENT_IDS)) || {};
                    const username = (await GitHubService.getCurrentUsername());
                    const commentKey = `${username}:${issueUrl}`;
                    const result = await GitHubService.createOrUpdateTrackerComment({
                        owner, repo, issueNumber,
                        entries: issueEntries,
                        cachedCommentId: commentIds[commentKey],
                    });

                    commentIds[commentKey] = result.commentId;
                    await StorageService.set(STORAGE_KEYS.COMMENT_IDS, commentIds);
                } catch (error) {
                    console.error('Failed to sync tracker comment:', error);
                }
            }

            await Promise.all([
                StorageService.set(STORAGE_KEYS.TRACKED_TIMES, updatedTrackedTimes),
                StorageService.removeMultiple([
                    STORAGE_KEYS.ACTIVE_ISSUE,
                    STORAGE_KEYS.START_TIME,
                ]),
            ]);

            const totalTime = await this.getTotalTimeForIssue(issueUrl);
            this.resetButtonState(buttonElement, totalTime);

            return { issueUrl, totalTime, isRunning: false };
        } catch (error) {
            console.error('Не удалось остановить таймер:', error);
            this.resetButtonState(buttonElement);
            return { issueUrl, totalTime: 0, isRunning: false };
        }
    }

    /**
     * Получает заголовок задачи с текущей страницы
     * @returns {string | null} Заголовок задачи или null, если не найден
     */
    static getIssueTitle() {
        return (
            document.querySelector('span.js-issue-title')?.textContent?.trim() ||
            document.querySelector("[data-testid='issue-title']")?.textContent?.trim()
        ) || null;
    }

    /**
     * Сбрасывает состояние кнопки таймера
     * @param {HTMLButtonElement | null} buttonElement - Кнопка, состояние которой нужно сбросить
     * @param {number} totalTime - Общее время, которое нужно отобразить на кнопке
     */
    static resetButtonState(buttonElement, totalTime = 0) {
        if (buttonElement?.dataset.intervalId) {
            clearInterval(parseInt(buttonElement.dataset.intervalId, 10));
            delete buttonElement.dataset.intervalId;
        }
        if (buttonElement) {
            buttonElement.textContent = `${TimeService.formatTime(0, totalTime)} Start Timer`;
        }
    }
}