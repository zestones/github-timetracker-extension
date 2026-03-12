import { GITHUB_API_URL, COMMENT_TEMPLATE } from './constants.js';
import { GitHubStorageService } from "./github-storage.js";

export class GitHubService {
    static parseIssueUrl(url) {
        const match = url.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
        if (!match) throw new Error('Invalid GitHub issue URL');

        return {
            owner: match[1],
            repo: match[2],
            issueNumber: parseInt(match[3], 10),
            fullRepo: `${match[1]}/${match[2]}`
        };
    }

    static async apiRequest(endpoint, options = {}) {
        const token = await GitHubStorageService.getGitHubToken();
        if (!token) throw new Error('GitHub token not found');

        const response = await fetch(`${GITHUB_API_URL}${endpoint}`, {
            ...options,
            headers: {
                Authorization: `token ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'GitHub API request failed');
        }

        return response.json();
    }

    static async getUser() {
        return this.apiRequest('/user');
    }

    static async postComment({ owner, repo, issueNumber, seconds }) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        const timeString = minutes > 0
            ? `${minutes} min${remainingSeconds > 0 ? ` ${remainingSeconds} sec` : ''}`
            : `${remainingSeconds} sec`;

        return this.apiRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
            method: 'POST',
            body: JSON.stringify({ body: COMMENT_TEMPLATE(timeString) })
        });
    }

    static async searchRepositories(query) {
        const results = await this.apiRequest(
            `/search/repositories?q=${encodeURIComponent(query)}&per_page=20&sort=updated`
        );
        return results.items || [];
    }

    static async getRepoIssues(owner, repo) {
        const issues = await this.apiRequest(
            `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=open&per_page=100&sort=updated`
        );
        // Filter out pull requests (GitHub API returns PRs in /issues endpoint)
        return issues.filter((issue) => !issue.pull_request);
    }

    static async getAssignedIssues() {
        const issues = await this.apiRequest(
            '/issues?filter=assigned&state=open&per_page=100&sort=updated'
        );
        return issues.filter((issue) => !issue.pull_request);
    }

    static async getCreatedIssues() {
        const issues = await this.apiRequest(
            '/issues?filter=created&state=open&per_page=100&sort=updated'
        );
        return issues.filter((issue) => !issue.pull_request);
    }
}