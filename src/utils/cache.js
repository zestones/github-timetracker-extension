import { StorageService } from './storage.js';
import { STORAGE_KEYS, CACHE_PREFIX, CACHE_TTL } from './constants.js';

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

    // Pinned repos
    static async getPinnedRepos() {
        return (await StorageService.get(STORAGE_KEYS.PINNED_REPOS)) || [];
    }

    static async addPinnedRepo(repo) {
        const repos = await this.getPinnedRepos();
        if (repos.some((r) => r.fullName === repo.fullName)) return;
        repos.push(repo);
        await StorageService.set(STORAGE_KEYS.PINNED_REPOS, repos);
    }

    static async removePinnedRepo(fullName) {
        const repos = await this.getPinnedRepos();
        const filtered = repos.filter((r) => r.fullName !== fullName);
        await StorageService.set(STORAGE_KEYS.PINNED_REPOS, filtered);
        await this.invalidate(`issues:${fullName}`);
    }

    // User cache
    static async getCachedUser() {
        return this.get('user');
    }

    static async setCachedUser(user) {
        await this.set('user', user, 30 * 60 * 1000); // 30 min TTL
    }

    // Repo issues cache
    static async getCachedIssues(fullName) {
        return this.get(`issues:${fullName}`);
    }

    static async setCachedIssues(fullName, issues) {
        await this.set(`issues:${fullName}`, issues);
    }
}
