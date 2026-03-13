// content/index.js
import { injectTimerButton, resetInjectedFlag } from './injectTimerButton.js';
import { isIssuePage } from './helpers.js';
import { StorageService } from '../utils/storage.js';
import { STORAGE_KEYS } from '../utils/constants.js';

console.log('content script loaded, timestamp:', Date.now());

// Debounce to prevent multiple calls
function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

// Debounced injectTimerButton
const debouncedInjectTimerButton = debounce(injectTimerButton, 500);

// Рекурсивная проверка контейнера
function checkContainer(attempts = 10, delay = 500) {
    console.log(`checkContainer: attempts left ${attempts}, pathname: ${location.pathname}`);
    const container = document.querySelector('[data-testid="issue-metadata-fixed"]');
    const buttonExists = document.querySelector('#track-time-btn');
    if (buttonExists) {
        console.log('checkContainer: button already exists, skipping');
        return;
    }
    if (container || attempts <= 0) {
        console.log('checkContainer: injecting button, container found:', !!container);
        debouncedInjectTimerButton();
        return;
    }
    setTimeout(() => checkContainer(attempts - 1, delay), delay);
}

// Периодическая проверка состояния таймера
function checkTimerState() {
    StorageService.getMultiple([STORAGE_KEYS.ACTIVE_ISSUE, STORAGE_KEYS.START_TIME]).then(
        ({ activeIssue, startTime }) => {
            if (isIssuePage() && activeIssue === location.pathname && startTime && !isNaN(new Date(startTime).getTime())) {
                const buttonExists = document.querySelector('#track-time-btn');
                if (!buttonExists) {
                    console.log('Timer is active for current page, injecting button');
                    checkContainer();
                }
            }
        }
    );
}

// Инициализация при загрузке
if (isIssuePage()) {
    checkContainer();
    // Запускаем периодическую проверку состояния таймера
    setInterval(checkTimerState, 2000);
}

// Отслеживание изменений DOM и URL для SPA-навигации
let lastPathname = location.pathname;
const observer = new MutationObserver(() => {
    if (location.pathname !== lastPathname) {
        console.log(`MutationObserver: pathname changed from ${lastPathname} to ${location.pathname}`);
        resetInjectedFlag(); // Сбрасываем isInjected при смене пути
        lastPathname = location.pathname;
        if (isIssuePage()) {
            checkContainer();
        }
    }
});
observer.observe(document.body, { childList: true, subtree: true });

// Отслеживание контейнера
const containerObserver = new MutationObserver(() => {
    const buttonExists = document.querySelector('#track-time-btn');
    if (buttonExists) {
        return; // Пропускаем, если кнопка уже создана
    }
    console.log('containerObserver: container changed');
    debouncedInjectTimerButton();
});
const container = document.querySelector('[data-testid="issue-metadata-fixed"]');
if (container) {
    console.log('containerObserver: initial container found');
    containerObserver.observe(container, { childList: true });
}

// Динамическое отслеживание появления контейнера
const bodyObserver = new MutationObserver(() => {
    const newContainer = document.querySelector('[data-testid="issue-metadata-fixed"]');
    const buttonExists = document.querySelector('#track-time-btn');
    if (newContainer && !buttonExists) {
        console.log('bodyObserver: new container found');
        containerObserver.observe(newContainer, { childList: true });
        debouncedInjectTimerButton();
    }
});
bodyObserver.observe(document.body, { childList: true, subtree: true });

// Слушатель popstate для навигации назад/вперёд
window.addEventListener('popstate', () => {
    if (location.pathname !== lastPathname) {
        console.log(`popstate: pathname changed to ${location.pathname}`);
        resetInjectedFlag();
        lastPathname = location.pathname;
        if (isIssuePage()) {
            checkContainer();
        }
    }
});

// Патч pushState для перехвата клиентской навигации
const originalPushState = history.pushState;
history.pushState = function (...args) {
    originalPushState.apply(this, args);
    if (location.pathname !== lastPathname) {
        console.log(`pushState: pathname changed to ${location.pathname}`);
        resetInjectedFlag();
        lastPathname = location.pathname;
        if (isIssuePage()) {
            checkContainer();
        }
    }
};

// Обработчик сообщений от popup/background для синхронизации таймера
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    if (message.action === 'timerStarted' || message.action === 'timerStopped') {
        console.log(`Processing ${message.action} for issueUrl: ${message.issueUrl}, current pathname: ${location.pathname}`);
        if (isIssuePage() && message.issueUrl === location.pathname) {
            const buttonExists = document.querySelector('#track-time-btn');
            if (!buttonExists) {
                console.log('Updating timer button on current issue page');
                const container = document.querySelector('[data-testid="issue-metadata-fixed"]');
                if (container) {
                    console.log('Container found, injecting button');
                    debouncedInjectTimerButton();
                } else {
                    console.log('Container not found, retrying with checkContainer');
                    checkContainer(15, 500);
                }
            }
        } else {
            console.log('Message ignored: not on matching issue page or not an issue page');
        }
        sendResponse({ received: true });
    }
});

// Очистка при выходе
window.addEventListener('unload', () => {
    console.log('unload: cleaning up observers and pushState');
    observer.disconnect();
    containerObserver.disconnect();
    bodyObserver.disconnect();
    history.pushState = originalPushState;
});