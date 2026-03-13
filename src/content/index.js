// content/index.js
import { injectTimerButton, resetInjectedFlag } from './injectTimerButton.js';
import { isIssuePage } from './helpers.js';
import { STORAGE_KEYS } from '../utils/constants.js';

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

// Recursive container check with retry
function checkContainer(attempts = 10, delay = 500) {
    const container = document.querySelector('[data-testid="issue-metadata-fixed"]');
    const buttonExists = document.querySelector('#track-time-btn');
    if (buttonExists) return;
    if (container || attempts <= 0) {
        debouncedInjectTimerButton();
        return;
    }
    setTimeout(() => checkContainer(attempts - 1, delay), delay);
}

// Initialize on load
if (isIssuePage()) {
    checkContainer();
}

// React to storage changes for timer state (replaces polling)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEYS.ACTIVE_ISSUE] || changes[STORAGE_KEYS.START_TIME]) {
        if (isIssuePage()) {
            const buttonExists = document.querySelector('#track-time-btn');
            if (!buttonExists) {
                checkContainer();
            }
        }
    }
});

// Single observer for SPA navigation + container appearance
let lastPathname = location.pathname;
const observer = new MutationObserver(() => {
    // Handle SPA pathname changes
    if (location.pathname !== lastPathname) {
        resetInjectedFlag();
        lastPathname = location.pathname;
        if (isIssuePage()) {
            checkContainer();
        }
        return;
    }

    // Handle container appearance on current issue page
    if (isIssuePage()) {
        const buttonExists = document.querySelector('#track-time-btn');
        if (!buttonExists) {
            debouncedInjectTimerButton();
        }
    }
});
observer.observe(document.body, { childList: true, subtree: true });

// Listen for popstate (back/forward navigation)
window.addEventListener('popstate', () => {
    if (location.pathname !== lastPathname) {
        resetInjectedFlag();
        lastPathname = location.pathname;
        if (isIssuePage()) {
            checkContainer();
        }
    }
});

// Patch pushState for client-side navigation interception
const originalPushState = history.pushState;
history.pushState = function (...args) {
    originalPushState.apply(this, args);
    if (location.pathname !== lastPathname) {
        resetInjectedFlag();
        lastPathname = location.pathname;
        if (isIssuePage()) {
            checkContainer();
        }
    }
};

// Handle messages from popup/background for timer sync
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'timerStarted' || message.action === 'timerStopped') {
        if (isIssuePage() && message.issueUrl === location.pathname) {
            const buttonExists = document.querySelector('#track-time-btn');
            if (!buttonExists) {
                checkContainer(15, 500);
            }
        }
        sendResponse({ received: true });
    }
});

// Cleanup on unload
window.addEventListener('unload', () => {
    observer.disconnect();
    history.pushState = originalPushState;
});