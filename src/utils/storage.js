export class StorageService {
    static async get(key) {
        return new Promise((resolve) => {
            chrome.storage.local.get(key, (data) => resolve(data[key] ?? null));
        });
    }

    static async set(key, value) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, resolve);
        });
    }

    static async remove(key) {
        return new Promise((resolve) => {
            chrome.storage.local.remove(key, resolve);
        });
    }

    static async getMultiple(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, (data) => {
                const result = {};
                for (const key of keys) {
                    result[key] = data[key] ?? null;
                }
                resolve(result);
            });
        });
    }

    static async removeMultiple(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.remove(keys, resolve);
        });
    }
}