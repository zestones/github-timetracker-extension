import { StorageService } from './storage.js';
import { CACHE_PREFIX, CACHE_TTL, USER_CACHE_TTL } from './constants.js';

export class CacheService {
    static async get(key) {
        const cached = await StorageService.get(`${CACHE_PREFIX}${key}`);
        if (!cached) return null;
        if (Date.now() - cached.fetchedAt > (cached.ttl || CACHE_TTL)) return null;
        return cached.data;
    }

    static async set(key, data, ttl = CACHE_TTL) {
        await StorageService.set(`${CACHE_PREFIX}${key}`, {
            data,
            fetchedAt: Date.now(),
            ttl,
        });
    }

    static async invalidate(key) {
        await StorageService.remove(`${CACHE_PREFIX}${key}`);
    }

    /** @returns {Promise<import('./schema.js').CachedUser|null>} */
    static async getCachedUser() {
        return this.get('user');
    }

    /** @param {import('./schema.js').CachedUser} user */
    static async setCachedUser(user) {
        await this.set('user', user, USER_CACHE_TTL);
    }

    /** @param {string} fullName @returns {Promise<import('./schema.js').SimplifiedIssue[]|null>} */
    static async getCachedIssues(fullName) {
        return this.get(`issues:${fullName}`);
    }

    /** @param {string} fullName @param {import('./schema.js').SimplifiedIssue[]} issues */
    static async setCachedIssues(fullName, issues) {
        await this.set(`issues:${fullName}`, issues);
    }
}
