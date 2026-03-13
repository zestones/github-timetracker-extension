# GitHub Time Tracker — Privacy Policy

*Last updated: March 13, 2026*

GitHub Time Tracker is committed to protecting your privacy. This browser extension is designed to function primarily on your device, without collecting or transmitting any personal information to external servers beyond the GitHub API.

## Data Collected

- The extension stores time tracking logs, active timer state, pinned repository preferences, cached issue metadata, theme settings, and user preferences using Chrome's `storage.local` API.
- If the user chooses to enter a GitHub Classic Personal Access Token, it is stored locally and used solely to interact with the GitHub API on the user's behalf (fetching issues, posting comments, syncing data). This token is never transmitted to any third-party server.
- Cached GitHub user profile information (username, avatar) is stored locally for display purposes.

## Data Usage

- All stored data is used strictly for providing time tracking, analytics, and synchronization functionality.
- No analytics, telemetry, advertising, or tracking mechanisms are included.
- The extension does not share, sell, or transmit data to any third party.
- Data export (CSV/JSON) is performed locally in the browser — exported files are saved to the user's device and are not uploaded anywhere.

## Permissions

- **storage**: To persist user settings, time tracking logs, cached data, and preferences locally in the browser.
- **tabs**: To detect navigation to GitHub issue pages and synchronize timer state across open tabs.
- **alarms**: To schedule periodic background cache refresh (every 15 minutes) for pinned repository issues.
- **GitHub API host access (`https://api.github.com/*`)**: To fetch repository issues, post time tracking comments, retrieve user profile information, and sync tracked times — all authorized by the user's personal access token.

## GitHub API Communication

- The extension communicates only with the GitHub API (`https://api.github.com`), and only when the user has provided a valid personal access token.
- API requests include: fetching issues for pinned repositories, posting/updating time tracking comments on issues, retrieving user profile and rate limit information, and searching repositories.
- No data is sent to any server other than the official GitHub API.

## Security

- All user data remains within the user's local browser storage.
- The GitHub token is validated for format before storage and is displayed in masked form (first 4 characters only) in the UI.
- CSV exports sanitize values to prevent spreadsheet formula injection.
- No external communication occurs beyond user-authorized GitHub API interactions.

## Contact

If you have questions about this privacy policy or the extension, please open an issue on the [GitHub repository](https://github.com/zestones/github-timetracker-extension).

By using the GitHub Time Tracker extension, you consent to this privacy policy.
