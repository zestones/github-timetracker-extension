import { StorageService } from './storage.js';
import { CacheService } from './cache.js';
import { STORAGE_KEYS } from './constants.js';

export class PinnedReposService {
    /** @returns {Promise<import('./schema.js').PinnedRepo[]>} */
    static async getPinnedRepos() {
        return (await StorageService.get(STORAGE_KEYS.PINNED_REPOS)) ?? [];
    }

    /** @param {import('./schema.js').PinnedRepo} repo */
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
        await CacheService.invalidate(`issues:${fullName}`);
    }
}
