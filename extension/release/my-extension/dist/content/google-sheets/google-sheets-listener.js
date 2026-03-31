import { GoogleSheetsThread } from "./google-sheets-thread";
export class GoogleSheetsListener {
    constructor() {
        this.thread = new Map();
        this.activeThread = null;
        this.pendingRepos = [];
        this.init();
    }
    init() {
        this.listen();
    }
    listen() {
        if (this.isGoogleSheetsPage()) {
            this.ensureActiveThread(window.location.href, document.title);
        }
        chrome.runtime.onMessage.addListener((request) => {
            if (!request || typeof request !== "object")
                return;
            if (request.kind === "GOOGLE_SHEETS_REPOS_UPDATED") {
                const repos = Array.isArray(request.repos)
                    ? request.repos.filter((repo) => typeof repo === "string")
                    : [];
                this.pendingRepos = repos;
                this.activeThread?.setRepos(repos);
                return;
            }
            if (request.kind !== "GOOGLE_SHEETS_START_OBSERVE")
                return;
            const url = typeof request.url === "string"
                ? request.url
                : window.location.href;
            const title = typeof request.title === "string"
                ? request.title
                : document.title;
            this.ensureActiveThread(url, title);
        });
    }
    ensureActiveThread(url, title) {
        if (!this.isGoogleSheetsUrl(url))
            return;
        const key = this.normalizeThreadKey(url);
        const existing = this.thread.get(key);
        if (existing) {
            this.activeThread = existing;
            existing.initPageObserver();
            if (this.pendingRepos.length > 0) {
                existing.setRepos(this.pendingRepos);
            }
            return;
        }
        const newThread = new GoogleSheetsThread(key, title);
        if (this.pendingRepos.length > 0) {
            newThread.setRepos(this.pendingRepos);
        }
        this.thread.set(key, newThread);
        this.activeThread = newThread;
    }
    normalizeThreadKey(rawUrl) {
        try {
            const url = new URL(rawUrl);
            return `${url.origin}${url.pathname}`;
        }
        catch {
            return rawUrl;
        }
    }
    isGoogleSheetsPage() {
        return this.isGoogleSheetsUrl(window.location.href);
    }
    isGoogleSheetsUrl(url) {
        return url.startsWith("https://docs.google.com/spreadsheets/");
    }
}
