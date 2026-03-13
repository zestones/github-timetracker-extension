// content/injectTimerButton.js
import { TimerService } from '../utils/timer.js';
import { TimeService } from '../utils/time.js';
import { StorageService } from '../utils/storage.js';
import { addStorageListener } from '../utils/storage-listener.js';
import { STORAGE_KEYS, TIME_UPDATE_INTERVAL } from '../utils/constants.js';
import { isIssuePage, getIssueTitle } from './helpers.js';

// Flag to prevent duplicate injections on same page
let isInjected = false;

// Reset injection flag on navigation
export function resetInjectedFlag() {
    isInjected = false;
}

export async function injectTimerButton() {
    if (!isIssuePage()) {
        return;
    }

    const container = document.querySelector('[data-testid="issue-metadata-fixed"]');
    const buttonExists = document.querySelector('#track-time-btn');
    if (!container || buttonExists || isInjected) {
        return;
    }

    // Remove any existing buttons
    const existingButtons = document.querySelectorAll('#track-time-btn');
    existingButtons.forEach((btn) => {
        if (btn.dataset.intervalId) {
            clearInterval(btn.dataset.intervalId);
        }
        btn.remove();
    });

    const btn = createTimerButton();
    isInjected = true;

    const updateButton = async () => {
        if (!document.querySelector('#track-time-btn')) {
            return;
        }
        const { activeIssue, startTime } = await StorageService.getMultiple([STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME]);
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

    container.append(btn);

    await updateButton();

    // Click listener
    btn.addEventListener('click', async () => {
        const { activeIssue, startTime } = await StorageService.getMultiple([STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME]);
        if (activeIssue === location.pathname && startTime && !isNaN(new Date(startTime).getTime())) {
            await TimerService.stopTimer(location.pathname, btn);
        } else {
            const title = getIssueTitle();
            await TimerService.startTimer(location.pathname, btn, title);
        }
        await updateButton();
    });

    // Listen for trackedTimes changes
    const removeListener = addStorageListener(STORAGE_KEYS.TRACKED_TIMES, () => {
        updateButton();
    });

    // Cleanup on unload
    window.addEventListener('unload', () => {
        if (btn.dataset.intervalId) {
            clearInterval(btn.dataset.intervalId);
            delete btn.dataset.intervalId;
        }
        removeListener();
        isInjected = false;
    });
}

function createTimerButton() {
    const btn = document.createElement('button');
    btn.id = 'track-time-btn';
    btn.style.marginTop = '10px';
    btn.className = 'btn btn-sm';
    btn.textContent = 'Start Timer';
    return btn;
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
        const { startTime } = await StorageService.getMultiple([STORAGE_KEYS.START_TIME]);
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