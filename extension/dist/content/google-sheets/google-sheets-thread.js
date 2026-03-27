import { RESPONSE_TYPE } from "../../type";
export const defaultSelectors = {
    container: "",
};
export class GoogleSheetsThread {
    constructor(id, title, selectors = defaultSelectors) {
        this.id = id;
        this.title = title;
        this.selectors = selectors;
        this.observer = null;
        this.menuEl = null;
        this.latestPosition = null;
        this.latestStartA1 = null;
        this.latestSheetName = null;
        this.repos = [];
        this.selectedRepo = null;
        this.selectedClipboard = null; // cellの内容
        this.selectedCells = null; // 選択されたcell
        this.allCellsClipboard = null; // 全範囲コピー
        this.allCells = null; // 全範囲のcell
        this.isBound = false;
        // mouse右クリックで呼ばれる
        this.handleContextMenu = (event) => {
            const isSpreadSheetsPage = this.isGoogleSheetsPage();
            console.log("is google spread sheets: ", isSpreadSheetsPage);
            if (!isSpreadSheetsPage)
                return;
            const anchor = this.findMenuAnchor();
            if (!anchor) {
                console.log("failed to find active selection");
                this.hideMenu();
                return;
            }
            this.latestStartA1 = this.findActiveCellA1();
            this.latestSheetName = this.findActiveSheetName();
            console.log("success: find active selection: ", anchor);
            console.log("active cell A1 on context menu: ", this.latestStartA1);
            console.log("active sheet name on context menu: ", this.latestSheetName);
            this.latestPosition = {
                x: event.clientX,
                y: event.clientY,
            };
            window.setTimeout(() => {
                this.showMenu(anchor, this.latestPosition);
            }, 0);
        };
        this.handleDismiss = (event) => {
            if (!this.menuEl) {
                return;
            }
            const target = event?.target;
            if (target instanceof Node && this.menuEl.contains(target)) {
                return;
            }
            this.hideMenu();
        };
        this.handleKeydown = (event) => {
            if (event.key === "Escape") {
                this.hideMenu();
            }
        };
        this.menuId = `trace-pilot-sheets-menu-${this.safeId(id)}`;
        this.init();
    }
    init() {
        this.initPageObserver();
        this.initListener();
    }
    setRepos(repos) {
        this.repos = repos.filter((repo) => !repo.endsWith(".trace-worktree"));
        console.log("trace-pilot google sheets repos:", repos);
        this.renderRepoList();
        this.updateSelectedRepoLabel();
    }
    getThreadContainer() {
        if (this.selectors.container) {
            return document.querySelector(this.selectors.container);
        }
        return document.body;
    }
    initListener() {
        if (this.isBound)
            return;
        this.isBound = true;
        document.addEventListener("contextmenu", this.handleContextMenu, true);
        document.addEventListener("click", this.handleDismiss, true);
        document.addEventListener("keydown", this.handleKeydown, true);
        window.addEventListener("scroll", this.handleDismiss, true);
    }
    initPageObserver() {
        const targetNode = this.getThreadContainer();
        if (!targetNode) {
            setTimeout(() => this.initPageObserver(), 5000);
            return;
        }
        this.observer?.disconnect();
        this.observer = new MutationObserver(() => {
            if (this.menuEl && !document.body.contains(this.menuEl)) {
                this.menuEl = null;
            }
        });
        this.observer.observe(targetNode, { childList: true, subtree: true });
    }
    findMenuAnchor() {
        const activeRect = this.findActiveCellRect();
        if (activeRect) {
            return {
                rect: activeRect,
                label: this.describeSelection(activeRect, "Active cell"),
            };
        }
        const selectionRect = this.findSelectionRect();
        if (selectionRect) {
            return {
                rect: selectionRect,
                label: this.describeSelection(selectionRect, "Selection"),
            };
        }
        return null;
    }
    findActiveCellRect() {
        const borders = Array.from(document.querySelectorAll(".range-border.active-cell-border"));
        const rects = borders
            .filter((el) => this.isVisible(el))
            .map((el) => el.getBoundingClientRect())
            .filter((rect) => rect.width > 0 || rect.height > 0);
        return this.mergeRects(rects);
    }
    findSelectionRect() {
        const selections = Array.from(document.querySelectorAll(".selection"));
        const rects = selections
            .filter((el) => this.isVisible(el))
            .map((el) => el.getBoundingClientRect())
            .filter((rect) => rect.width > 0 && rect.height > 0);
        if (rects.length === 0)
            return null;
        return rects.reduce((best, rect) => {
            const bestArea = best.width * best.height;
            const rectArea = rect.width * rect.height;
            return rectArea > bestArea ? rect : best;
        });
    }
    isVisible(el) {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return (style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.bottom >= 0 &&
            rect.right >= 0 &&
            rect.left <= window.innerWidth &&
            rect.top <= window.innerHeight);
    }
    mergeRects(rects) {
        if (rects.length === 0)
            return null;
        let left = Infinity;
        let top = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (const rect of rects) {
            left = Math.min(left, rect.left);
            top = Math.min(top, rect.top);
            right = Math.max(right, rect.right);
            bottom = Math.max(bottom, rect.bottom);
        }
        return new DOMRect(left, top, right - left, bottom - top);
    }
    showMenu(anchor, position) {
        if (!position)
            return;
        const menu = this.ensureMenu();
        const hintEl = menu.querySelector('[data-role="cell-label"]');
        if (hintEl) {
            hintEl.textContent = anchor.label;
        }
        this.updateSelectedRepoLabel();
        this.showPrimaryActions();
        const baseX = position.x || anchor.rect.right;
        const baseY = position.y || anchor.rect.bottom;
        menu.style.left = `${Math.max(8, Math.min(baseX - 200, window.innerWidth - 220))}px`;
        menu.style.top = `${Math.max(8, Math.min(baseY - 100, window.innerHeight - 80))}px`;
        menu.style.display = "block";
    }
    ensureMenu() {
        if (this.menuEl && document.body.contains(this.menuEl)) {
            return this.menuEl;
        }
        const wrapper = document.createElement("div");
        wrapper.id = this.menuId;
        wrapper.setAttribute("data-trace-pilot-menu", "google-sheets");
        wrapper.style.position = "fixed";
        wrapper.style.display = "none";
        wrapper.style.minWidth = "200px";
        wrapper.style.padding = "8px";
        wrapper.style.border = "1px solid rgba(0,0,0,0.12)";
        wrapper.style.borderRadius = "10px";
        wrapper.style.background = "#fffdf7";
        wrapper.style.boxShadow = "0 12px 30px rgba(0,0,0,0.18)";
        wrapper.style.zIndex = "2147483647";
        wrapper.style.fontFamily = "\"Segoe UI\", sans-serif";
        wrapper.style.color = "#202124";
        const label = document.createElement("div");
        label.setAttribute("data-role", "cell-label");
        label.style.fontSize = "12px";
        label.style.color = "#5f6368";
        label.style.marginBottom = "6px";
        label.textContent = "Google Sheets cell";
        const selectedRepoLabel = document.createElement("div");
        selectedRepoLabel.setAttribute("data-role", "selected-repo");
        selectedRepoLabel.style.fontSize = "12px";
        selectedRepoLabel.style.color = "#1f1f1f";
        selectedRepoLabel.style.marginBottom = "8px";
        selectedRepoLabel.textContent = "Repo: not selected";
        const actions = document.createElement("div");
        actions.setAttribute("data-role", "primary-actions");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "trace-pilot";
        button.style.width = "100%";
        button.style.padding = "10px 12px";
        button.style.border = "0";
        button.style.borderRadius = "8px";
        button.style.background = "#0f9d58";
        button.style.color = "#fff";
        button.style.fontSize = "14px";
        button.style.fontWeight = "600";
        button.style.cursor = "pointer";
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.showRepoList();
        });
        const repoList = document.createElement("div");
        repoList.setAttribute("data-role", "repo-list");
        repoList.style.display = "none";
        repoList.style.maxHeight = "240px";
        repoList.style.overflowY = "auto";
        repoList.style.marginTop = "8px";
        actions.appendChild(button);
        wrapper.appendChild(label);
        wrapper.appendChild(selectedRepoLabel);
        wrapper.appendChild(actions);
        wrapper.appendChild(repoList);
        document.body.appendChild(wrapper);
        this.menuEl = wrapper;
        this.renderRepoList();
        this.updateSelectedRepoLabel();
        return wrapper;
    }
    hideMenu() {
        if (this.menuEl) {
            this.menuEl.style.display = "none";
        }
    }
    showPrimaryActions() {
        const actions = this.menuEl?.querySelector('[data-role="primary-actions"]');
        const repoList = this.menuEl?.querySelector('[data-role="repo-list"]');
        if (actions)
            actions.style.display = "block";
        if (repoList)
            repoList.style.display = "none";
    }
    showRepoList() {
        this.renderRepoList();
        const actions = this.menuEl?.querySelector('[data-role="primary-actions"]');
        const repoList = this.menuEl?.querySelector('[data-role="repo-list"]');
        if (actions)
            actions.style.display = "none";
        if (repoList)
            repoList.style.display = "block";
    }
    renderRepoList() {
        const repoList = this.menuEl?.querySelector('[data-role="repo-list"]');
        if (!repoList)
            return;
        repoList.replaceChildren();
        const title = document.createElement("div");
        title.textContent = "Select repo";
        title.style.fontSize = "12px";
        title.style.fontWeight = "600";
        title.style.color = "#5f6368";
        title.style.marginBottom = "8px";
        repoList.appendChild(title);
        if (this.repos.length === 0) {
            const empty = document.createElement("div");
            empty.textContent = "No repositories available";
            empty.style.fontSize = "12px";
            empty.style.color = "#5f6368";
            repoList.appendChild(empty);
            return;
        }
        for (const repo of this.repos) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = repo;
            button.style.display = "block";
            button.style.width = "100%";
            button.style.marginBottom = "6px";
            button.style.padding = "8px 10px";
            button.style.border = repo === this.selectedRepo ? "1px solid #0f9d58" : "1px solid rgba(0,0,0,0.12)";
            button.style.borderRadius = "8px";
            button.style.background = repo === this.selectedRepo ? "#e6f4ea" : "#ffffff";
            button.style.color = "#202124";
            button.style.textAlign = "left";
            button.style.cursor = "pointer";
            button.style.fontSize = "12px";
            button.addEventListener("click", async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await this.onMenuClick(repo);
                this.updateSelectedRepoLabel();
                this.showPrimaryActions();
            });
            repoList.appendChild(button);
        }
    }
    async onMenuClick(repo) {
        this.selectedRepo = repo;
        this.selectedClipboard = await this.captureSelectionClipboard();
        this.selectedCells = this.resolveSelectedCells(this.selectedClipboard);
        this.allCellsClipboard = null;
        this.allCells = null;
        const selectedWholeSheet = await this.selectWholeSheet();
        if (selectedWholeSheet) {
            this.allCellsClipboard = await this.captureSelectionClipboard();
            this.allCells = this.resolveSelectedCells(this.allCellsClipboard);
        }
        console.log("trace-pilot google sheets selected repo:", this.selectedRepo);
        console.log("trace-pilot google sheets clipboard capture:", this.selectedClipboard);
        console.log("trace-pilot google sheets selected cells:", this.selectedCells);
        console.log("trace-pilot google sheets all cells clipboard:", this.allCellsClipboard);
        console.log("trace-pilot google sheets all cells:", this.allCells);
        if (!this.selectedCells?.ok) {
            console.warn("trace-pilot google sheets: selected cells are not available", this.selectedCells);
            return;
        }
        if (!this.allCells?.ok) {
            console.warn("trace-pilot google sheets: whole-sheet cells are not available", this.allCells);
            return;
        }
        const selectedCells = this.selectedCells;
        const allCells = this.allCells;
        // backgroundに送信
        const selectedArea = {
            startA1: selectedCells.startA1,
            rowCount: selectedCells.rowCount,
            colCount: selectedCells.colCount,
        };
        const cellSnapshot = {
            name: this.latestSheetName ?? "",
            rows: allCells.rows,
            rowCount: allCells.rowCount,
            colCount: allCells.colCount,
        };
        const payload = {
            kind: "GOOGLE_SHEETS_CELLDATAS",
            type: RESPONSE_TYPE.GOOGLE_SHEETS,
            url: window.location.href,
            repoPath: repo,
            plainText: this.selectedClipboard?.textPlain ?? "",
            selectedArea,
            cellSnapshot,
        };
        let result;
        try {
            result = await chrome.runtime.sendMessage(payload);
        }
        catch (e) {
            console.warn("GOOGLE_SHEETS_CELLDATAS send failed:", e);
            return;
        }
        console.log("trace-pilot google sheets background response:", result);
    }
    async selectWholeSheet() {
        const beforeA1 = this.findActiveCellA1();
        const triedShortcut = await this.selectWholeSheetByShortcut();
        if (triedShortcut) {
            const verified = await this.verifyWholeSheetSelection();
            if (verified.ok) {
                this.latestStartA1 = "A1";
                console.log("trace-pilot google sheets: whole-sheet shortcut selection verified", verified);
                return true;
            }
            console.warn("trace-pilot google sheets: whole-sheet shortcut selection was not verified", verified);
        }
        else {
            console.warn("trace-pilot google sheets: failed to trigger whole-sheet shortcut selection");
        }
        const triedCorner = await this.selectWholeSheetByCornerClick();
        if (triedCorner) {
            const verified = await this.verifyWholeSheetSelection();
            if (verified.ok) {
                this.latestStartA1 = "A1";
                console.log("trace-pilot google sheets: whole-sheet corner selection verified", verified);
                return true;
            }
            console.warn("trace-pilot google sheets: whole-sheet corner selection was not verified", verified);
        }
        else {
            console.warn("trace-pilot google sheets: failed to trigger whole-sheet corner selection");
        }
        this.latestStartA1 = beforeA1 ?? null;
        return false;
    }
    async verifyWholeSheetSelection() {
        // まず name box / active range が A1 始まりか確認
        const a1 = this.findActiveCellA1();
        if (a1 && a1 !== "A1") {
            return {
                ok: false,
                reason: "active range does not start at A1",
                details: { a1 },
            };
        }
        // 実際に copy して内容を確認
        const probe = await this.captureSelectionClipboard();
        if (!probe.ok || !probe.textPlain) {
            return {
                ok: false,
                reason: "clipboard probe failed",
                details: probe,
            };
        }
        const grid = this.parseClipboardGrid(probe.textPlain);
        // whole-sheet として扱うには、少なくとも複数行かつ複数列が必要。
        if (grid.rowCount <= 1 || grid.colCount <= 1) {
            return {
                ok: false,
                reason: "clipboard probe looks too small for whole-sheet selection",
                details: {
                    rowCount: grid.rowCount,
                    colCount: grid.colCount,
                    textPlain: probe.textPlain,
                },
            };
        }
        // HTML に table があるかも軽く確認
        if (probe.textHtml && !/<table[\s>]/i.test(probe.textHtml)) {
            return {
                ok: false,
                reason: "clipboard html does not look like a table",
                details: {
                    textHtml: probe.textHtml.slice(0, 200),
                },
            };
        }
        return {
            ok: true,
            reason: "clipboard probe produced table-like multi-cell data",
        };
    }
    async selectWholeSheetByShortcut() {
        const focused = this.focusGoogleSheetSurface();
        if (!focused) {
            console.warn("trace-pilot google sheets: could not focus sheet surface");
            return false;
        }
        await this.sendSelectAllShortcut();
        await this.sleep(200);
        await this.sendSelectAllShortcut();
        await this.sleep(350);
        return true;
    }
    async selectWholeSheetByCornerClick() {
        const target = this.findWholeSheetSelectTarget();
        if (!target) {
            return false;
        }
        const rect = target.getBoundingClientRect();
        const clientX = rect.left + Math.max(1, Math.min(8, rect.width / 2));
        const clientY = rect.top + Math.max(1, Math.min(8, rect.height / 2));
        for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
            target.dispatchEvent(new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                clientX,
                clientY,
                button: 0,
            }));
        }
        await this.sleep(120);
        return true;
    }
    async sendSelectAllShortcut() {
        // OS依存解消
        const useMeta = this.isApplePlatform();
        const eventInit = {
            key: "a",
            code: "KeyA",
            keyCode: 65,
            which: 65,
            ctrlKey: !useMeta,
            metaKey: useMeta,
            bubbles: true,
            cancelable: true,
        };
        const target = document.activeElement ?? document.body;
        target.dispatchEvent(new KeyboardEvent("keydown", eventInit));
        target.dispatchEvent(new KeyboardEvent("keypress", eventInit));
        target.dispatchEvent(new KeyboardEvent("keyup", eventInit));
    }
    isApplePlatform() {
        return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    }
    focusGoogleSheetSurface() {
        const candidates = [
            document.querySelector(".grid-container"),
            document.querySelector("[role='grid']"),
            document.querySelector(".waffle-grid-container"),
        ].filter((el) => !!el);
        const target = candidates.find((el) => this.isVisible(el));
        if (!target)
            return false;
        target.focus?.();
        const rect = target.getBoundingClientRect();
        const clientX = rect.left + Math.min(20, Math.max(5, rect.width / 4));
        const clientY = rect.top + Math.min(20, Math.max(5, rect.height / 4));
        for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
            target.dispatchEvent(new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                clientX,
                clientY,
                button: 0,
            }));
        }
        return true;
    }
    findWholeSheetSelectTarget() {
        const rowHeaders = document.querySelector(".row-headers-background");
        const columnHeaders = document.querySelector(".column-headers-background");
        if (!rowHeaders || !columnHeaders) {
            return null;
        }
        const rowRect = rowHeaders.getBoundingClientRect();
        const columnRect = columnHeaders.getBoundingClientRect();
        const x = Math.max(1, rowRect.right - 4);
        const y = Math.max(1, columnRect.bottom - 4);
        const target = document.elementFromPoint(x, y);
        return target instanceof HTMLElement ? target : null;
    }
    sleep(ms) {
        return new Promise((resolve) => window.setTimeout(resolve, ms));
    }
    updateSelectedRepoLabel() {
        const label = this.menuEl?.querySelector('[data-role="selected-repo"]');
        if (!label)
            return;
        label.textContent = this.selectedRepo
            ? `Repo: ${this.selectedRepo}`
            : "Repo: not selected";
    }
    async captureSelectionClipboard() {
        // copyイベント
        const execResult = await this.captureClipboardByCopyEvent();
        if (this.hasClipboardPayload(execResult)) {
            return execResult;
        }
        // apiによるコピー
        const navigatorResult = await this.captureClipboardByNavigator();
        if (this.hasClipboardPayload(navigatorResult)) {
            return navigatorResult;
        }
        return {
            ok: false,
            types: [],
            error: navigatorResult.error ??
                execResult.error ??
                "clipboard capture failed",
        };
    }
    captureClipboardByCopyEvent() {
        return new Promise((resolve) => {
            let settled = false;
            const finalize = (result) => {
                if (settled)
                    return;
                settled = true;
                resolve(result);
            };
            const onCopy = (event) => {
                const clipboardData = event.clipboardData;
                if (!clipboardData) {
                    finalize({
                        ok: false,
                        types: [],
                        error: "copy event did not expose clipboardData",
                    });
                    return;
                }
                const result = {
                    ok: true,
                    types: Array.from(clipboardData.types),
                    textPlain: clipboardData.getData("text/plain"),
                    textHtml: clipboardData.getData("text/html"),
                };
                if (!this.hasClipboardPayload(result)) {
                    finalize({
                        ok: false,
                        types: result.types,
                        textPlain: result.textPlain,
                        textHtml: result.textHtml,
                        error: "copy event returned empty clipboard payload",
                    });
                    return;
                }
                finalize(result);
            };
            document.addEventListener("copy", onCopy, { capture: true, once: true });
            window.setTimeout(() => {
                finalize({
                    ok: false,
                    types: [],
                    error: "copy event timeout",
                });
            }, 300);
            try {
                const success = document.execCommand("copy");
                if (!success) {
                    finalize({
                        ok: false,
                        types: [],
                        error: "document.execCommand(copy) returned false",
                    });
                }
            }
            catch (error) {
                finalize({
                    ok: false,
                    types: [],
                    error: String(error),
                });
            }
        });
    }
    async captureClipboardByNavigator() {
        if (!navigator.clipboard?.read) {
            return {
                ok: false,
                types: [],
                error: "navigator.clipboard.read is not available",
            };
        }
        try {
            const items = await navigator.clipboard.read();
            const types = new Set();
            let textPlain = "";
            let textHtml = "";
            for (const item of items) {
                for (const type of item.types) {
                    types.add(type);
                }
                if (item.types.includes("text/plain") && !textPlain) {
                    const blob = await item.getType("text/plain");
                    textPlain = await blob.text();
                }
                if (item.types.includes("text/html") && !textHtml) {
                    const blob = await item.getType("text/html");
                    textHtml = await blob.text();
                }
            }
            return {
                ok: true,
                types: Array.from(types),
                textPlain,
                textHtml,
            };
        }
        catch (error) {
            return {
                ok: false,
                types: [],
                error: String(error),
            };
        }
    }
    hasClipboardPayload(result) {
        return (result.types.length > 0 ||
            !!result.textPlain ||
            !!result.textHtml);
    }
    resolveSelectedCells(result) {
        if (!result.textPlain) {
            return {
                ok: false,
                error: "text/plain is empty",
            };
        }
        const startA1 = this.latestStartA1 ?? this.findActiveCellA1();
        if (!startA1) {
            return {
                ok: false,
                error: "failed to resolve active cell A1",
                grid: this.parseClipboardGrid(result.textPlain),
            };
        }
        const grid = this.parseClipboardGrid(result.textPlain);
        const cells = this.expandA1Range(startA1, grid.rowCount, grid.colCount);
        return {
            ok: true,
            startA1,
            rowCount: grid.rowCount,
            colCount: grid.colCount,
            cells,
            rows: grid.rows,
        };
    }
    findActiveCellA1() {
        const selectors = [
            'input[aria-label*="名前"]',
            'input[aria-label*="name"]',
            'input[aria-label*="セル"]',
            'input[aria-label*="cell"]',
            'input.docs-sheet-active-range-name',
            'input[type="text"]',
            '[role="textbox"]',
        ];
        for (const selector of selectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            for (const el of elements) {
                const value = this.readA1Candidate(el);
                if (value) {
                    return value;
                }
            }
        }
        const activeEl = document.activeElement;
        if (activeEl instanceof HTMLElement) {
            const value = this.readA1Candidate(activeEl);
            if (value) {
                return value;
            }
        }
        this.logA1Candidates();
        return null;
    }
    readA1Candidate(el) {
        const values = new Set();
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            values.add(el.value.trim());
        }
        values.add((el.textContent ?? "").trim());
        const ariaLabel = el.getAttribute("aria-label");
        if (ariaLabel) {
            values.add(ariaLabel.trim());
            const match = ariaLabel.match(/\b([A-Z]+[1-9][0-9]*)\b/);
            if (match) {
                values.add(match[1]);
            }
        }
        for (const value of values) {
            const parsed = this.parseA1OrRangeStart(value);
            if (parsed) {
                return parsed;
            }
        }
        return null;
    }
    findActiveSheetName() {
        const activeTabSelectors = [
            '[role="tab"][aria-selected="true"] .docs-sheet-tab-name',
            '[aria-selected="true"] .docs-sheet-tab-name',
            '.docs-sheet-tab[aria-selected="true"] .docs-sheet-tab-name',
            '.docs-sheet-tab.docs-sheet-active-tab .docs-sheet-tab-name',
            '.docs-sheet-active-tab .docs-sheet-tab-name',
        ];
        for (const selector of activeTabSelectors) {
            const el = document.querySelector(selector);
            if (el instanceof HTMLElement) {
                const name = el.textContent?.trim();
                if (name) {
                    return name;
                }
            }
        }
        const visibleNames = Array.from(document.querySelectorAll(".docs-sheet-tab-name"))
            .filter((el) => el instanceof HTMLElement)
            .filter((el) => {
            const tab = el.closest('[role="tab"], .docs-sheet-tab');
            return tab ? this.isVisible(tab) : this.isVisible(el);
        });
        for (const el of visibleNames) {
            const name = el.textContent?.trim();
            if (name) {
                return name;
            }
        }
        return null;
    }
    parseA1OrRangeStart(value) {
        const trimmed = value.trim();
        if (/^[A-Z]+[1-9][0-9]*$/.test(trimmed)) {
            return trimmed;
        }
        const rangeMatch = trimmed.match(/^([A-Z]+[1-9][0-9]*):([A-Z]+[1-9][0-9]*)$/);
        if (rangeMatch) {
            return rangeMatch[1];
        }
        const embeddedRangeMatch = trimmed.match(/\b([A-Z]+[1-9][0-9]*):([A-Z]+[1-9][0-9]*)\b/);
        if (embeddedRangeMatch) {
            return embeddedRangeMatch[1];
        }
        return null;
    }
    logA1Candidates() {
        const candidateElements = Array.from(document.querySelectorAll("input, [role='textbox'], [aria-label], button, div"));
        const candidates = candidateElements
            .filter((el) => this.isVisible(el))
            .map((el) => {
            const text = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
                ? el.value.trim()
                : (el.textContent ?? "").trim();
            const ariaLabel = el.getAttribute("aria-label") ?? "";
            return {
                tag: el.tagName,
                id: el.id || "",
                className: typeof el.className === "string" ? el.className : "",
                ariaLabel,
                text: text.slice(0, 80),
                parsed: this.parseA1OrRangeStart(text) ?? this.parseA1OrRangeStart(ariaLabel) ?? "",
            };
        })
            .filter((item) => {
            return (item.parsed ||
                /^[A-Z]+[1-9][0-9]*(:[A-Z]+[1-9][0-9]*)?$/.test(item.text) ||
                /^[A-Z]+[1-9][0-9]*(:[A-Z]+[1-9][0-9]*)?$/.test(item.ariaLabel));
        })
            .slice(0, 30);
        console.log("trace-pilot google sheets A1 candidates:", candidates);
    }
    parseClipboardGrid(textPlain) {
        const rows = textPlain
            .split(/\r?\n/)
            .filter((line) => line.length > 0)
            .map((line) => line.split("\t"));
        return {
            rowCount: rows.length,
            colCount: rows.reduce((max, row) => Math.max(max, row.length), 0),
            rows,
        };
    }
    expandA1Range(startA1, rowCount, colCount) {
        const origin = this.parseA1(startA1);
        if (!origin) {
            return [];
        }
        const cells = [];
        for (let rowOffset = 0; rowOffset < rowCount; rowOffset++) {
            for (let colOffset = 0; colOffset < colCount; colOffset++) {
                cells.push(`${this.toColumnName(origin.col + colOffset)}${origin.row + rowOffset}`);
            }
        }
        return cells;
    }
    parseA1(a1) {
        const match = a1.match(/^([A-Z]+)([1-9][0-9]*)$/);
        if (!match) {
            return null;
        }
        return {
            col: this.fromColumnName(match[1]),
            row: Number(match[2]),
        };
    }
    fromColumnName(name) {
        let result = 0;
        for (const ch of name) {
            result = result * 26 + (ch.charCodeAt(0) - 64);
        }
        return result;
    }
    toColumnName(value) {
        let current = value;
        let result = "";
        while (current > 0) {
            const remainder = (current - 1) % 26;
            result = String.fromCharCode(65 + remainder) + result;
            current = Math.floor((current - 1) / 26);
        }
        return result;
    }
    describeSelection(rect, prefix) {
        return `${prefix} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
    }
    isGoogleSheetsPage() {
        return window.location.href.startsWith("https://docs.google.com/spreadsheets/");
    }
    safeId(value) {
        return value.replace(/[^a-zA-Z0-9_-]/g, "_");
    }
}
