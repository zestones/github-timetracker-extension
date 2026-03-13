import { TimeService } from './time.js';

export class AggregationService {
    static parseRepo(issueUrl) {
        const parts = issueUrl.split('/');
        return `${parts[1]}/${parts[2]}`;
    }

    static getTimePerRepo(trackedTimes) {
        const repoMap = {};
        for (const entry of trackedTimes) {
            const repo = this.parseRepo(entry.issueUrl);
            repoMap[repo] = (repoMap[repo] || 0) + entry.seconds;
        }
        return Object.entries(repoMap)
            .map(([repo, seconds]) => ({
                repo,
                seconds,
                formatted: TimeService.formatTime(seconds),
            }))
            .sort((a, b) => b.seconds - a.seconds);
    }

    static parseEntryTitle(title) {
        const parts = title.split(' | ');
        if (parts.length >= 3) {
            return { issueTitle: parts.slice(1, -1).join(' | '), issueNumber: parts[parts.length - 1] };
        }
        // Handle 2-part format from older syncs: "(owner) repo | #number"
        if (parts.length === 2) {
            const numPart = parts[1].trim();
            if (numPart.startsWith('#')) {
                return { issueTitle: '', issueNumber: numPart };
            }
        }
        return { issueTitle: title, issueNumber: '' };
    }

    static getRepoBreakdownDetailed(entries) {
        const repoMap = {};
        for (const entry of entries) {
            const repo = this.parseRepo(entry.issueUrl);
            if (!repoMap[repo]) repoMap[repo] = {};
            const issueKey = entry.issueUrl;
            if (!repoMap[repo][issueKey]) {
                const { issueTitle, issueNumber } = this.parseEntryTitle(entry.title || '');
                repoMap[repo][issueKey] = {
                    title: issueTitle || issueNumber || issueKey,
                    issueNumber,
                    sessions: [],
                    totalSeconds: 0,
                };
            }
            repoMap[repo][issueKey].totalSeconds += entry.seconds;
            repoMap[repo][issueKey].sessions.push({
                date: entry.date,
                seconds: entry.seconds,
                user: entry.user,
            });
        }
        return repoMap;
    }

    static getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    static filterByDateRange(trackedTimes, startDate, endDate) {
        return trackedTimes.filter((e) => e.date >= startDate && e.date <= endDate);
    }

    static getTotalSeconds(entries) {
        return entries.reduce((sum, e) => sum + (e.seconds || 0), 0);
    }

    static getTodayEntries(trackedTimes) {
        const today = this.getLocalDateString();
        return trackedTimes.filter((e) => e.date === today);
    }

    static getWeekEntries(trackedTimes) {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek);
        const start = this.getLocalDateString(startOfWeek);
        const end = this.getLocalDateString(now);
        return this.filterByDateRange(trackedTimes, start, end);
    }

    static getMonthEntries(trackedTimes) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const start = this.getLocalDateString(startOfMonth);
        const end = this.getLocalDateString(now);
        return this.filterByDateRange(trackedTimes, start, end);
    }
}
