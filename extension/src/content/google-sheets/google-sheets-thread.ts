export interface ThreadSelectors{
  container: string;
}
export const defaultSelectors: ThreadSelectors={
  container: "",
}

interface MenuPosition{
  x: number;
  y: number;
}

interface MenuAnchor{
  rect: DOMRect;
  label: string;
}

interface ClipboardCaptureResult{
  ok: boolean;
  types: string[];
  textPlain?: string;
  textHtml?: string;
  error?: string;
}

interface GridShape{
  rowCount: number;
  colCount: number;
  rows: string[][];
}

export class GoogleSheetsThread{
  private observer: MutationObserver | null = null;
  private menuEl: HTMLElement | null = null;
  private latestPosition: MenuPosition | null = null;
  private latestStartA1: string | null = null;
  private repos: string[] = [];
  private selectedRepo: string | null = null;
  private selectedClipboard: ClipboardCaptureResult | null = null; // cellの内容
  private selectedCells: ReturnType<GoogleSheetsThread["resolveSelectedCells"]> | null = null; // 選択されたcell
  private allCellsClipboard: ClipboardCaptureResult | null=null; // 全範囲コピー
  private allCells: ReturnType<GoogleSheetsThread["resolveSelectedCells"]> | null = null; // 全範囲のcell
  private isBound = false;
  private readonly menuId: string;
  
  constructor(
    readonly id:string,
    readonly title:string,
    private selectors: ThreadSelectors=defaultSelectors,
  ){
    this.menuId = `trace-pilot-sheets-menu-${this.safeId(id)}`;
    this.init();
  }

  init(){
    this.initPageObserver();
    this.initListener();
  }

  public setRepos(repos: string[]){
    this.repos = repos.filter((repo) => !repo.endsWith(".trace-worktree"));
    console.log("trace-pilot google sheets repos:", repos);
    this.renderRepoList();
    this.updateSelectedRepoLabel();
  }

  private getThreadContainer():HTMLElement | null{
    if(this.selectors.container){
      return document.querySelector(this.selectors.container) as HTMLElement | null;
    }

    return document.body;
  }

  initListener(){
    if(this.isBound) return;
    this.isBound = true;

    document.addEventListener("contextmenu", this.handleContextMenu, true);
    document.addEventListener("click", this.handleDismiss, true);
    document.addEventListener("keydown", this.handleKeydown, true);
    window.addEventListener("scroll", this.handleDismiss, true);
  }

  initPageObserver(){
    const targetNode=this.getThreadContainer();
    if(!targetNode){
      setTimeout(()=>this.initPageObserver(),5000);
      return;
    }

    this.observer?.disconnect();
    this.observer = new MutationObserver(() => {
      if(this.menuEl && !document.body.contains(this.menuEl)){
        this.menuEl = null;
      }
    });
    this.observer.observe(targetNode,{childList:true,subtree:true});
  }

  private handleContextMenu = (event: MouseEvent) => {
    const isSpreadSheetsPage=this.isGoogleSheetsPage();
    console.log("is google spread sheets: ",isSpreadSheetsPage);
    if(!isSpreadSheetsPage) return;

    const anchor = this.findMenuAnchor();
    if(!anchor){
      console.log("failed to find active selection");
      this.hideMenu();
      return;
    }
    this.latestStartA1 = this.findActiveCellA1();
    console.log("success: find active selection: ",anchor);
    console.log("active cell A1 on context menu: ", this.latestStartA1);

    this.latestPosition = {
      x: event.clientX,
      y: event.clientY,
    };

    window.setTimeout(() => {
      this.showMenu(anchor, this.latestPosition);
    }, 0);
  };

  private handleDismiss = (event?: Event) => {
    if(!this.menuEl){
      return;
    }

    const target = event?.target;
    if(target instanceof Node && this.menuEl.contains(target)){
      return;
    }

    this.hideMenu();
  };

  private handleKeydown = (event: KeyboardEvent) => {
    if(event.key === "Escape"){
      this.hideMenu();
    }
  };

  private findMenuAnchor(): MenuAnchor | null{
    const activeRect = this.findActiveCellRect();
    if(activeRect){
      return {
        rect: activeRect,
        label: this.describeSelection(activeRect, "Active cell"),
      };
    }

    const selectionRect = this.findSelectionRect();
    if(selectionRect){
      return {
        rect: selectionRect,
        label: this.describeSelection(selectionRect, "Selection"),
      };
    }

    return null;
  }

  private findActiveCellRect(): DOMRect | null{
    const borders = Array.from(
      document.querySelectorAll(".range-border.active-cell-border")
    ) as HTMLElement[];


    const rects = borders
      .filter((el) => this.isVisible(el))
      .map((el) => el.getBoundingClientRect())
      .filter((rect) => rect.width > 0 || rect.height > 0);

    return this.mergeRects(rects);
  }

  private findSelectionRect(): DOMRect | null{
    const selections = Array.from(
      document.querySelectorAll(".selection")
    ) as HTMLElement[];

    const rects = selections
      .filter((el) => this.isVisible(el))
      .map((el) => el.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);

    if(rects.length === 0) return null;

    return rects.reduce((best, rect) => {
      const bestArea = best.width * best.height;
      const rectArea = rect.width * rect.height;
      return rectArea > bestArea ? rect : best;
    });
  }

  private isVisible(el: HTMLElement){
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.bottom >= 0 &&
      rect.right >= 0 &&
      rect.left <= window.innerWidth &&
      rect.top <= window.innerHeight
    );
  }

  private mergeRects(rects: DOMRect[]): DOMRect | null{
    if(rects.length === 0) return null;

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;

    for(const rect of rects){
      left = Math.min(left, rect.left);
      top = Math.min(top, rect.top);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
    }

    return new DOMRect(left, top, right - left, bottom - top);
  }

  private showMenu(anchor: MenuAnchor, position: MenuPosition | null){
    if(!position) return;

    const menu = this.ensureMenu();
    const hintEl = menu.querySelector('[data-role="cell-label"]');
    if(hintEl){
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

  private ensureMenu(){
    if(this.menuEl && document.body.contains(this.menuEl)){
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

  private hideMenu(){
    if(this.menuEl){
      this.menuEl.style.display = "none";
    }
  }

  private showPrimaryActions(){
    const actions = this.menuEl?.querySelector('[data-role="primary-actions"]') as HTMLElement | null;
    const repoList = this.menuEl?.querySelector('[data-role="repo-list"]') as HTMLElement | null;
    if(actions) actions.style.display = "block";
    if(repoList) repoList.style.display = "none";
  }

  private showRepoList(){
    this.renderRepoList();
    const actions = this.menuEl?.querySelector('[data-role="primary-actions"]') as HTMLElement | null;
    const repoList = this.menuEl?.querySelector('[data-role="repo-list"]') as HTMLElement | null;
    if(actions) actions.style.display = "none";
    if(repoList) repoList.style.display = "block";
  }

  private renderRepoList(){
    const repoList = this.menuEl?.querySelector('[data-role="repo-list"]') as HTMLElement | null;
    if(!repoList) return;

    repoList.replaceChildren();

    const title = document.createElement("div");
    title.textContent = "Select repo";
    title.style.fontSize = "12px";
    title.style.fontWeight = "600";
    title.style.color = "#5f6368";
    title.style.marginBottom = "8px";
    repoList.appendChild(title);

    if(this.repos.length === 0){
      const empty = document.createElement("div");
      empty.textContent = "No repositories available";
      empty.style.fontSize = "12px";
      empty.style.color = "#5f6368";
      repoList.appendChild(empty);
      return;
    }

    for(const repo of this.repos){
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

  private async onMenuClick(repo: string):Promise<void>{
    this.selectedRepo = repo;
    this.selectedClipboard = await this.captureSelectionClipboard();
    this.selectedCells = this.resolveSelectedCells(this.selectedClipboard);
    this.allCellsClipboard = null;
    this.allCells = null;

    const selectedWholeSheet = await this.selectWholeSheet();
    if(selectedWholeSheet){
      this.allCellsClipboard = await this.captureSelectionClipboard();
      this.allCells = this.resolveSelectedCells(this.allCellsClipboard);
    }

    console.log("trace-pilot google sheets selected repo:", this.selectedRepo);
    console.log("trace-pilot google sheets clipboard capture:", this.selectedClipboard);
    console.log("trace-pilot google sheets selected cells:", this.selectedCells);
    console.log("trace-pilot google sheets all cells clipboard:", this.allCellsClipboard);
    console.log("trace-pilot google sheets all cells:", this.allCells);
  }

  private async selectWholeSheet(): Promise<boolean>{
    const target = this.findWholeSheetSelectTarget();
    if(!target){
      return false;
    }

    const rect = target.getBoundingClientRect();
    const clientX = rect.left + Math.max(1, Math.min(8, rect.width / 2));
    const clientY = rect.top + Math.max(1, Math.min(8, rect.height / 2));

    for(const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]){
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          button: 0,
        })
      );
    }

    await this.sleep(120);
    this.latestStartA1 = "A1";
    return true;
  }

  private findWholeSheetSelectTarget(): HTMLElement | null{
    const rowHeaders = document.querySelector(".row-headers-background") as HTMLElement | null;
    const columnHeaders = document.querySelector(".column-headers-background") as HTMLElement | null;
    if(!rowHeaders || !columnHeaders){
      return null;
    }

    const rowRect = rowHeaders.getBoundingClientRect();
    const columnRect = columnHeaders.getBoundingClientRect();
    const x = Math.max(1, rowRect.right - 4);
    const y = Math.max(1, columnRect.bottom - 4);
    // (x,y)の位置に見えている一番上の要素が返る
    const target = document.elementFromPoint(x, y);

    return target instanceof HTMLElement ? target : null;
  }

  private sleep(ms: number){
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  private updateSelectedRepoLabel(){
    const label = this.menuEl?.querySelector('[data-role="selected-repo"]') as HTMLElement | null;
    if(!label) return;

    label.textContent = this.selectedRepo
      ? `Repo: ${this.selectedRepo}`
      : "Repo: not selected";
  }

  private async captureSelectionClipboard(): Promise<ClipboardCaptureResult>{
    const execResult = await this.captureClipboardByCopyEvent();
    if(this.hasClipboardPayload(execResult)){
      return execResult;
    }

    const navigatorResult = await this.captureClipboardByNavigator();
    if(this.hasClipboardPayload(navigatorResult)){
      return navigatorResult;
    }

    return {
      ok: false,
      types: [],
      error:
        navigatorResult.error ??
        execResult.error ??
        "clipboard capture failed",
    };
  }

  private captureClipboardByCopyEvent(): Promise<ClipboardCaptureResult>{
    return new Promise((resolve) => {
      let settled = false;

      const finalize = (result: ClipboardCaptureResult) => {
        if(settled) return;
        settled = true;
        resolve(result);
      };

      const onCopy = (event: ClipboardEvent) => {
        const clipboardData = event.clipboardData;
        if(!clipboardData){
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

        if(!this.hasClipboardPayload(result)){
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

      try{
        const success = document.execCommand("copy");
        if(!success){
          finalize({
            ok: false,
            types: [],
            error: "document.execCommand(copy) returned false",
          });
        }
      }catch(error){
        finalize({
          ok: false,
          types: [],
          error: String(error),
        });
      }
    });
  }

  private async captureClipboardByNavigator(): Promise<ClipboardCaptureResult>{
    if(!navigator.clipboard?.read){
      return {
        ok: false,
        types: [],
        error: "navigator.clipboard.read is not available",
      };
    }

    try{
      const items = await navigator.clipboard.read();
      const types = new Set<string>();
      let textPlain = "";
      let textHtml = "";

      for(const item of items){
        for(const type of item.types){
          types.add(type);
        }

        if(item.types.includes("text/plain") && !textPlain){
          const blob = await item.getType("text/plain");
          textPlain = await blob.text();
        }

        if(item.types.includes("text/html") && !textHtml){
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
    }catch(error){
      return {
        ok: false,
        types: [],
        error: String(error),
      };
    }
  }

  private hasClipboardPayload(result: ClipboardCaptureResult){
    return (
      result.types.length > 0 ||
      !!result.textPlain ||
      !!result.textHtml
    );
  }

  private resolveSelectedCells(result: ClipboardCaptureResult){
    if(!result.textPlain){
      return {
        ok: false,
        error: "text/plain is empty",
      };
    }

    const startA1 = this.latestStartA1 ?? this.findActiveCellA1();
    if(!startA1){
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

  private findActiveCellA1(): string | null{
    const selectors = [
      'input[aria-label*="名前"]',
      'input[aria-label*="name"]',
      'input[aria-label*="セル"]',
      'input[aria-label*="cell"]',
      'input.docs-sheet-active-range-name',
      'input[type="text"]',
      '[role="textbox"]',
    ];

    for(const selector of selectors){
      const elements = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
      for(const el of elements){
        const value = this.readA1Candidate(el);
        if(value){
          return value;
        }
      }
    }

    const activeEl = document.activeElement;
    if(activeEl instanceof HTMLElement){
      const value = this.readA1Candidate(activeEl);
      if(value){
        return value;
      }
    }

    this.logA1Candidates();
    return null;
  }

  private readA1Candidate(el: HTMLElement): string | null{
    const values = new Set<string>();

    if(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement){
      values.add(el.value.trim());
    }

    values.add((el.textContent ?? "").trim());

    const ariaLabel = el.getAttribute("aria-label");
    if(ariaLabel){
      values.add(ariaLabel.trim());
      const match = ariaLabel.match(/\b([A-Z]+[1-9][0-9]*)\b/);
      if(match){
        values.add(match[1]);
      }
    }

    for(const value of values){
      const parsed = this.parseA1OrRangeStart(value);
      if(parsed){
        return parsed;
      }
    
    }

    return null;
  }

  private parseA1OrRangeStart(value: string): string | null{
    const trimmed = value.trim();
    if(/^[A-Z]+[1-9][0-9]*$/.test(trimmed)){
      return trimmed;
    }

    const rangeMatch = trimmed.match(/^([A-Z]+[1-9][0-9]*):([A-Z]+[1-9][0-9]*)$/);
    if(rangeMatch){
      return rangeMatch[1];
    }

    const embeddedRangeMatch = trimmed.match(/\b([A-Z]+[1-9][0-9]*):([A-Z]+[1-9][0-9]*)\b/);
    if(embeddedRangeMatch){
      return embeddedRangeMatch[1];
    }

    return null;
  }

  private logA1Candidates(){
    const candidateElements = Array.from(
      document.querySelectorAll("input, [role='textbox'], [aria-label], button, div")
    ) as HTMLElement[];

    const candidates = candidateElements
      .filter((el) => this.isVisible(el))
      .map((el) => {
        const text =
          el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
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
        return (
          item.parsed ||
          /^[A-Z]+[1-9][0-9]*(:[A-Z]+[1-9][0-9]*)?$/.test(item.text) ||
          /^[A-Z]+[1-9][0-9]*(:[A-Z]+[1-9][0-9]*)?$/.test(item.ariaLabel)
        );
      })
      .slice(0, 30);

    console.log("trace-pilot google sheets A1 candidates:", candidates);
  }

  private parseClipboardGrid(textPlain: string): GridShape{
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

  private expandA1Range(startA1: string, rowCount: number, colCount: number){
    const origin = this.parseA1(startA1);
    if(!origin){
      return [];
    }

    const cells: string[] = [];
    for(let rowOffset = 0; rowOffset < rowCount; rowOffset++){
      for(let colOffset = 0; colOffset < colCount; colOffset++){
        cells.push(
          `${this.toColumnName(origin.col + colOffset)}${origin.row + rowOffset}`
        );
      }
    }

    return cells;
  }

  private parseA1(a1: string){
    const match = a1.match(/^([A-Z]+)([1-9][0-9]*)$/);
    if(!match){
      return null;
    }

    return {
      col: this.fromColumnName(match[1]),
      row: Number(match[2]),
    };
  }

  private fromColumnName(name: string){
    let result = 0;
    for(const ch of name){
      result = result * 26 + (ch.charCodeAt(0) - 64);
    }
    return result;
  }

  private toColumnName(value: number){
    let current = value;
    let result = "";

    while(current > 0){
      const remainder = (current - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      current = Math.floor((current - 1) / 26);
    }

    return result;
  }

  private describeSelection(rect: DOMRect, prefix: string){
    return `${prefix} ${Math.round(rect.width)}x${Math.round(rect.height)}`;
  }

  private isGoogleSheetsPage(){
    return window.location.href.startsWith("https://docs.google.com/spreadsheets/");
  }

  private safeId(value: string){
    return value.replace(/[^a-zA-Z0-9_-]/g, "_");
  }
}
