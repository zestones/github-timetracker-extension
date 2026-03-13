// content/injectTimerButton.js
import { TimerService } from '../utils/timer.js';
import { TimeService } from '../utils/time.js';
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