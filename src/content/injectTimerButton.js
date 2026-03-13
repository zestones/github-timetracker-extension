// content/injectTimerButton.js
import { TimerService } from '../utils/timer.js';
import { TimeService } from '../utils/time.js';
import { GitHubService } from '../utils/github.js';
import { StorageService } from '../utils/storage.js';
import { IssueStorageService } from '../utils/issue-storage.js';
import { addStorageListener } from '../utils/storage-listener.js';
import { STORAGE_KEYS, TIME_UPDATE_INTERVAL } from '../utils/constants.js';

console.log('injectTimerButton module loaded, timestamp:', Date.now());

// Флаг для предотвращения повторных инъекций на одной странице
let isInjected = false;

// Функция для сброса флага isInjected
export function resetInjectedFlag() {
    console.log('resetInjectedFlag: resetting isInjected');
    isInjected = false;
}

export async function injectTimerButton() {
    if (!isIssuePage()) {
        console.log('injectTimerButton: skipped (not an issue page)');
        return;
    }

    const container = document.querySelector('[data-testid="issue-metadata-fixed"]');
    const buttonExists = document.querySelector('#track-time-btn');
    if (!container || buttonExists || isInjected) {
        console.log(`injectTimerButton: skipped (container: ${!!container}, buttonExists: ${!!buttonExists}, isInjected: ${isInjected})`);
        return;
    }

    // Удаляем существующие кнопки
    const existingButtons = document.querySelectorAll('#track-time-btn');
    existingButtons.forEach((btn) => {
        if (btn.dataset.intervalId) {
            clearInterval(btn.dataset.intervalId);
        }
        btn.remove();
    });
    console.log(`injectTimerButton: removed ${existingButtons.length} existing buttons`);

    const btn = createTimerButton();
    isInjected = true;

    const updateButton = async () => {
        if (!document.querySelector('#track-time-btn')) {
            console.log('updateButton: button not found, skipping update');
            return;
        }
        console.log('updateButton: fetching storage data');
        const { activeIssue, startTime } = await getStorageData();
        const totalTime = await TimerService.getTotalTimeForIssue(location.pathname) || 0;
        if (activeIssue === location.pathname && startTime && !isNaN(new Date(startTime).getTime())) {
            updateButtonText(btn, startTime, totalTime);
            if (!btn.dataset.intervalId) {
                startButtonUpdateInterval(btn, totalTime);
            }
        } else {
            btn.textContent = `${TimeService.formatTime(0, totalTime)} Start Timer`;
            if (btn.dataset.intervalId) {
                clearInterval(btn.dataset.intervalId);
                delete btn.dataset.intervalId;
            }
        }
    };

    // Добавляем кнопку в DOM перед обновлением
    container.append(btn);
    console.log('injectTimerButton: button appended');

    // Инициализация кнопки
    await updateButton();

    // Lazy auto-recovery from GitHub if enabled and no local data
    lazyRecover(location.pathname, updateButton);

    // Слушатель кликов
    btn.addEventListener('click', async () => {
        console.log('track-time-btn clicked');
        const { activeIssue, startTime } = await getStorageData();
        if (activeIssue === location.pathname && startTime && !isNaN(new Date(startTime).getTime())) {
            await TimerService.stopTimer(location.pathname, btn);
        } else {
            await TimerService.startTimer(location.pathname, btn);
        }
        await updateButton(); // Обновляем кнопку после клика
    });

    // Слушатель изменений trackedTimes
    const removeListener = addStorageListener(STORAGE_KEYS.TRACKED_TIMES, () => {
        console.log('storageListener: trackedTimes changed');
        updateButton();
    });

    // Очистка при выходе
    window.addEventListener('unload', () => {
        console.log('injectTimerButton: cleaning up');
        if (btn.dataset.intervalId) {
            clearInterval(btn.dataset.intervalId);
            delete btn.dataset.intervalId;
        }
        removeListener();
        isInjected = false;
    });
}

function isIssuePage() {
    return location.pathname.match(/^\/[^/]+\/[^/]+\/issues\/\d+$/);
}

function createTimerButton() {
    const btn = document.createElement('button');
    btn.id = 'track-time-btn';
    btn.style.marginTop = '10px';
    btn.className = 'btn btn-sm';
    btn.textContent = 'Start Timer';
    return btn;
}

async function getStorageData() {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME], (data) => {
            resolve({
                activeIssue: data[STORAGE_KEYS.ACTIVE_ISSUE] || null,
                startTime: data[STORAGE_KEYS.START_TIME] || null,
            });
        });
    });
}

function updateButtonText(btn, startTime, totalTime) {
    btn.textContent = `${TimeService.timeStringSince(startTime, totalTime)} ⏸ Stop`;
}

function startButtonUpdateInterval(btn, totalTime) {
    const intervalId = setInterval(async () => {
        if (!document.querySelector('#track-time-btn')) {
            clearInterval(intervalId);
            delete btn.dataset.intervalId;
            return;
        }
        const { startTime } = await getStorageData();
        if (startTime && !isNaN(new Date(startTime).getTime())) {
            updateButtonText(btn, startTime, totalTime);
        } else {
            btn.textContent = `${TimeService.formatTime(0, totalTime)} Start Timer`;
            clearInterval(intervalId);
            delete btn.dataset.intervalId;
        }
    }, TIME_UPDATE_INTERVAL);
    btn.dataset.intervalId = intervalId;
}

async function lazyRecover(issueUrl, updateButton) {
    try {
        const autoSync = await StorageService.get(STORAGE_KEYS.AUTO_SYNC);
        if (!autoSync) return;

        const totalTime = await TimerService.getTotalTimeForIssue(issueUrl);
        if (totalTime > 0) return; // already have local data

        const { owner, repo, issueNumber } = GitHubService.parseIssueUrl(issueUrl);
        const result = await GitHubService.recoverSingleIssue(owner, repo, issueNumber);
        if (!result) return;

        const trackedTimes = (await StorageService.get(STORAGE_KEYS.TRACKED_TIMES)) || [];
        const commentIds = (await StorageService.get(STORAGE_KEYS.COMMENT_IDS)) || {};
        const username = await GitHubService.getCurrentUsername();
        const commentKey = `${username}:${issueUrl}`;

        commentIds[commentKey] = result.commentId;
        for (const entry of result.entries) {
            trackedTimes.push({
                issueUrl,
                title: `(${owner}) ${repo} | #${issueNumber}`,
                seconds: entry.seconds,
                date: entry.date,
            });
        }

        await StorageService.set(STORAGE_KEYS.TRACKED_TIMES, trackedTimes);
        await StorageService.set(STORAGE_KEYS.COMMENT_IDS, commentIds);

        const issueExists = await IssueStorageService.exists(issueUrl);
        if (!issueExists) {
            await IssueStorageService.add({
                url: issueUrl,
                title: `(${owner}) ${repo} | #${issueNumber}`,
            });
        }

        console.log(`lazyRecover: recovered ${result.entries.length} entries for ${issueUrl}`);
        await updateButton();
    } catch (e) {
        console.log('lazyRecover: skipped -', e.message);
    }
}