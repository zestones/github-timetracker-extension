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

    // User cache
    static async getCachedUser() {
        return this.get('user');
    }

    static async setCachedUser(user) {
        await this.set('user', user, USER_CACHE_TTL);
    }

    // Repo issues cache
    static async getCachedIssues(fullName) {
        return this.get(`issues:${fullName}`);
    }

    static async setCachedIssues(fullName, issues) {
        await this.set(`issues:${fullName}`, issues);
    }
}
