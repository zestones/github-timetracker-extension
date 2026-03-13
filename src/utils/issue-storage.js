import { StorageService } from './storage.js';
import { STORAGE_KEYS } from "./constants.js";

const STORAGE_KEY = STORAGE_KEYS.ISSUES;

export class IssueStorageService {
    static async getAll() {
        return (await StorageService.get(STORAGE_KEY)) ?? [];
    }

    static async add(issue) {
        const issues = await this.getAll();
        const exists = issues.some(i => i.url === issue.url);
        if (!exists) {
            issues.push(issue);
            await StorageService.set(STORAGE_KEY, issues);
        }
    }

    static async update(url, updates) {
        const issues = await this.getAll();
        const updated = issues.map(issue =>
            issue.url === url ? { ...issue, ...updates } : issue
        );
        await StorageService.set(STORAGE_KEY, updated);
    }

    static async remove(url) {
        const issues = await this.getAll();
        const filtered = issues.filter(issue => issue.url !== url);
        await StorageService.set(STORAGE_KEY, filtered);
    }

    static async removeAll() {
        await StorageService.remove(STORAGE_KEYS.ISSUES);
    }

    static async getByUrl(url) {
        const issues = await this.getAll();
        return issues.find(issue => issue.url === url) || null;
    }

    static async exists(url) {
        const issues = await this.getAll();
        return issues.some(issue => issue.url === url);
    }
}
