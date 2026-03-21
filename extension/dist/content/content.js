"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // content/gpt-module/gpt-thread.ts
  function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), timeout);
    };
  }
  var GPTThread;
  var init_gpt_thread = __esm({
    "content/gpt-module/gpt-thread.ts"() {
      "use strict";
      GPTThread = class {
        constructor(id, title) {
          this.id = id;
          this.title = title;
          this.observer = null;
          // 新しいメッセージが追加されたか
          this.threadItems = /* @__PURE__ */ new Map();
          // スレッド内の履歴データ
          this.assistantTurnRef = null;
          this.userRef = null;
          // 対応するユーザー発言のDOM要素
          this.tempUserMessage = null;
          // ユーザーがtextエリアに入力中のテキスト
          this.tempPair = null;
          // 現在生成中のThreadPair
          this.lastEditedTime = null;
          // Botの出力が止まったことを検出
          this.botObserver = null;
          this.lastTarget = null;
          this.handleUserInput = (e) => {
            const el = e.target;
            if (!el) return;
            const root = el.closest("#prompt-textarea");
            if (!root) return;
            const text = root.textContent ?? "";
            this.tempUserMessage = text;
            console.log("tempUserMessage:", this.tempUserMessage);
          };
          this.handleMessages = (mutationList, observer) => {
            if (!mutationList.length) return;
            const msg = this.tempUserMessage;
            if (!msg || msg.length === 0) {
              return;
            }
            for (const mutation of mutationList) {
              const addedNodes = Array.from(mutation.addedNodes);
              for (const node of addedNodes) {
                const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
                if (!el) continue;
                const turn = el.closest('article[data-testid^="conversation-turn-"]');
                if (!turn) {
                  console.log("el.closest(article)=null, el HTML:");
                  continue;
                }
                const extracted = this.extractUserText(turn);
                if (extracted && extracted === this.tempUserMessage) {
                  console.log("ysessss");
                  this.userRef = this.getUserElFromTurn(turn);
                  const assistantTurn = this.findNextAssistantTurn(turn);
                  if (!assistantTurn) {
                    console.log("assistant turn not found yet");
                    return;
                  }
                  this.assistantTurnRef = assistantTurn;
                  this.botObserver?.disconnect();
                  this.botObserver = new MutationObserver((mutations, observer2) => {
                    this.addToThread(mutations, observer2);
                  });
                  this.botObserver.observe(
                    assistantTurn,
                    {
                      childList: true,
                      subtree: true,
                      characterData: true
                    }
                  );
                }
              }
            }
          };
          this.init();
        }
        init() {
          this.initPageObserver();
          this.initListener();
        }
        // 画面上の一番最初の会話ターンを取得し、その親を返す
        getThreadContainer() {
          const firstTurn = document.querySelector(
            'article[data-testid^="conversation-turn-"]'
          );
          return firstTurn?.parentElement ?? null;
        }
        // ユーザの操作からparentIdを推測する
        initListener() {
          document.addEventListener("selectionchange", () => {
            const sel = window.getSelection();
            if (!sel || sel.rangeCount === 0) return;
            const anchor = sel.anchorNode;
            if (!anchor) return;
            const resolved = this.resolveParentFromNode(anchor);
            if (!resolved) return;
            const pre = (anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement)?.closest("pre");
            const preIndex = pre ? Array.from(resolved.turn.querySelectorAll("pre")).indexOf(pre) : null;
            this.lastTarget = {
              parentId: resolved.parentId,
              preIndex,
              updatedAt: Date.now()
            };
          });
          chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
            if (msg?.kind === "RESOLVE_LAST_TARGET") {
              if (!this.lastTarget) {
                sendResponse({ ok: false, reason: "no lastTarget" });
                return true;
              }
              sendResponse({
                ok: true,
                parentId: this.lastTarget.parentId,
                preIndex: this.lastTarget.preIndex,
                updatedAt: this.lastTarget.updatedAt
              });
              return true;
            }
            if (msg.kind === "FORCE_RESPONSE_THREADPAIR") {
              const parentId = msg.parentId;
              const preIndex = msg.preIndex;
              const result = this.threadItems.get(parentId);
              if (!result) {
                sendResponse({ ok: false, reason: "threadItem not found", parentId, preIndex });
                return true;
              }
              sendResponse({ ok: true, result });
              return true;
            }
            return false;
          });
        }
        initPageObserver() {
          const targetNode = this.getThreadContainer();
          if (!targetNode) {
            setTimeout(() => this.initPageObserver(), 5e3);
            return;
          }
          targetNode.dataset.gptThreadId = this.id;
          if (!this.threadItems.size) {
            this.initThreadItems(targetNode);
          }
          this.observer?.disconnect();
          this.observer?.disconnect();
          this.observer = new MutationObserver(this.handleMessages);
          this.observer.observe(targetNode, { childList: true, subtree: true });
          this.listenForUserText();
        }
        readComposerText() {
          const root = document.querySelector("#prompt-textarea");
          return (root?.textContent ?? "").trim();
        }
        listenForUserText() {
          document.addEventListener("input", debounce(() => {
            this.tempUserMessage = this.readComposerText();
            console.log("tempUserMessage1:", this.tempUserMessage);
          }, 50), true);
          document.addEventListener("paste", () => {
            requestAnimationFrame(() => {
              this.tempUserMessage = this.readComposerText();
              console.log("tempUserMessage2:", this.tempUserMessage);
            });
          }, true);
          document.addEventListener("beforeinput", (e) => {
            const ie = e;
            if (ie.inputType === "insertFromPaste") {
              requestAnimationFrame(() => {
                this.tempUserMessage = this.readComposerText();
                console.log("tempUserMessage3:", this.tempUserMessage);
              });
            }
          }, true);
          document.addEventListener("compositionend", () => {
            requestAnimationFrame(() => {
              this.tempUserMessage = this.readComposerText();
              console.log("tempUserMessage4:", this.tempUserMessage);
            });
          }, true);
        }
        getUserElFromTurn(turn) {
          return turn.querySelector('[data-message-author-role="user"]');
        }
        findNextAssistantTurn(fromTurn) {
          let cur = fromTurn.nextElementSibling;
          for (let i = 0; i < 8 && cur; i++) {
            if (cur instanceof HTMLElement) {
              const hasAssistant = !!cur.querySelector('[data-message-author-role="assistant"]');
              if (hasAssistant) {
                console.log(cur);
                return cur;
              }
            }
            cur = cur.nextElementSibling;
          }
          return null;
        }
        reset() {
          this.userRef = null;
          this.assistantTurnRef = null;
          this.tempPair = null;
          this.tempUserMessage = null;
          this.botObserver?.disconnect();
        }
        addToThread(mutationList, observer) {
          this.tempPair = this.tempPair || {
            id: `${(/* @__PURE__ */ new Date()).getTime().toString()}-${this.tempUserMessage}`,
            time: (/* @__PURE__ */ new Date()).getTime(),
            userMessage: "",
            botResponse: "",
            codeBlocks: []
          };
          const addedNodes = mutationList.filter((m) => m.addedNodes && m.addedNodes.length > 0).flatMap((m) => Array.from(m.addedNodes));
          const preNode = addedNodes.find((n) => n.nodeName === "PRE") ?? addedNodes.map((n) => n.querySelector?.("pre") ?? null).find(Boolean) ?? null;
          if (preNode) {
            const codeBlock = this.makeCodeBlock(preNode, this.tempPair.id);
            this.tempPair = {
              ...this.tempPair,
              codeBlocks: [...this.tempPair.codeBlocks, codeBlock]
            };
          }
          this.lastEditedTime && clearTimeout(this.lastEditedTime);
          this.lastEditedTime = setTimeout(() => {
            const codeBlocks = this.tempPair?.codeBlocks.map(
              (c) => this.updateCodeBlock(c)
            );
            const botText = this.assistantTurnRef ? this.extractAssistantText(this.assistantTurnRef) : "";
            console.log("bot text:", botText);
            this.tempPair = {
              ...this.tempPair,
              userMessage: this.userRef?.innerText || "",
              botResponse: botText,
              id: this.tempPair?.id || (/* @__PURE__ */ new Date()).getTime().toString(),
              time: this.tempPair?.time || (/* @__PURE__ */ new Date()).getTime(),
              codeBlocks: codeBlocks || []
            };
            const key = this.assistantTurnRef?.getAttribute("data-message-id") ?? this.assistantTurnRef?.getAttribute("data-testid") ?? this.tempPair?.id ?? `${Date.now()}`;
            this.threadItems.set(key, this.tempPair);
            console.log("threadItems after response:", this.threadItems);
            this.reset();
          }, 5e3);
          console.log("threadItems: ", this.threadItems);
        }
        // codeBlockを上書き
        updateCodeBlock(codeBlock) {
          const innerText = codeBlock.codeRef.innerText;
          return { ...codeBlock, code: innerText };
        }
        extractUserText(turn) {
          return turn.querySelector('[data-message-author-role="user"] .whitespace-pre-wrap')?.textContent?.trim() ?? "";
        }
        extractAssistantText(turn) {
          const assistants = Array.from(
            turn.querySelectorAll('[data-message-author-role="assistant"]')
          );
          const real = assistants.find((el) => {
            const mid = el.getAttribute("data-message-id") || "";
            if (mid.startsWith("placeholder-request-")) return false;
            const md2 = el.querySelector(".markdown");
            return !!md2 && (md2.textContent?.trim().length ?? 0) > 0;
          });
          const md = real?.querySelector(".markdown");
          return md?.textContent ?? real?.innerText ?? "";
        }
        initThreadItems(container) {
          const turns = Array.from(
            container.querySelectorAll('article[data-testid^="conversation-turn-"]')
          );
          for (let i = 0; i < turns.length; i++) {
            const a = turns[i];
            if (a.getAttribute("data-turn") !== "user") continue;
            let b = null;
            for (let j = i + 1; j < turns.length; j++) {
              if (turns[j].getAttribute("data-turn") === "assistant") {
                b = turns[j];
                break;
              }
            }
            if (!b) continue;
            const userMessage = this.extractUserText(a);
            const botMessage = this.extractAssistantText(b);
            const id = `${Date.now()}-${userMessage.slice(0, 30)}`;
            const preNodes = b.querySelectorAll("pre");
            const codeBlocks = Array.from(preNodes).map((pre) => {
              return this.makeCodeBlock(pre, id);
            });
            const key = b.getAttribute("data-message-id") ?? b.getAttribute("data-testid") ?? id;
            this.threadItems.set(key, {
              id,
              time: Date.now(),
              userMessage,
              botResponse: botMessage,
              codeBlocks
            });
          }
          console.log("threadItems: ", this.threadItems);
        }
        destroyPageObserver() {
          this.observer?.disconnect();
        }
        makeCodeBlock(preNode, parentId) {
          console.log("preNode", preNode, "preNode.innerText", preNode.innerText);
          const codeNode = preNode.querySelector("code");
          const code = codeNode?.innerText ?? "";
          const codeRef = preNode;
          const surroundingText = codeRef?.innerText || "";
          const langClass = codeNode?.className ?? "";
          const language = langClass.replace("language-", "");
          const turnParentId = preNode.closest('article[data-testid^="conversation-turn-"]')?.getAttribute("data-message-id") ?? preNode.closest('article[data-testid^="conversation-turn-"]')?.getAttribute("data-testid") ?? "";
          const codeBlock = {
            code,
            codeRef: preNode,
            copied: false,
            surroundingText,
            language,
            parentId,
            turnParentId
          };
          return codeBlock;
        }
        // nodeからparentIdを特定 (bot側のparentId)
        resolveParentFromNode(node) {
          const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement ?? null;
          if (!el) return null;
          let turn = el.closest('article[data-testid^="conversation-turn-"]');
          if (!turn) return null;
          if (turn.getAttribute("data-turn") === "user") {
            const assistant = this.findNextAssistantTurn(turn);
            if (assistant) turn = assistant;
          }
          const parentId = turn.getAttribute("data-message-id") ?? turn.getAttribute("data-testid") ?? "";
          if (!parentId) return null;
          return { parentId, turn };
        }
      };
    }
  });

  // content/gpt-module/gpt-listener.ts
  var GPTListener;
  var init_gpt_listener = __esm({
    "content/gpt-module/gpt-listener.ts"() {
      "use strict";
      init_gpt_thread();
      GPTListener = class {
        constructor() {
          this.threads = /* @__PURE__ */ new Map();
          this.activeThread = null;
          this.init();
        }
        init() {
          this.listen();
        }
        listen() {
          chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (!request || typeof request !== "object") return;
            if (request.kind !== "GPT_START_OBSERVE") return;
            console.log("start gpt thread");
            const url = request.url;
            const title = request.title;
            if (!this.threads.has(url)) {
              console.log("create new thread url=", url);
              const newThread = new GPTThread(url, title);
              this.threads.set(url, newThread);
              this.activeThread = newThread;
            } else {
              const thread = this.threads.get(url);
              console.log("use thread: url=", url);
              if (thread) {
                this.activeThread?.destroyPageObserver();
                thread.initPageObserver();
                this.activeThread = thread;
              }
            }
            console.log("thread num: ", this.threads.size);
            console.log(this.threads);
          });
        }
      };
    }
  });

  // content/google-sheets/google-sheets-thread.ts
  var defaultSelectors, GoogleSheetsThread;
  var init_google_sheets_thread = __esm({
    "content/google-sheets/google-sheets-thread.ts"() {
      "use strict";
      defaultSelectors = {
        container: ""
      };
      GoogleSheetsThread = class {
        constructor(id, title, selectors = defaultSelectors) {
          this.id = id;
          this.title = title;
          this.selectors = selectors;
          this.observer = null;
          this.menuEl = null;
          this.latestPosition = null;
          this.latestStartA1 = null;
          this.isBound = false;
          this.handleContextMenu = (event) => {
            const isSpreadSheetsPage = this.isGoogleSheetsPage();
            console.log("is google spread sheets: ", isSpreadSheetsPage);
            if (!isSpreadSheetsPage) return;
            const anchor = this.findMenuAnchor();
            if (!anchor) {
              console.log("failed to find active selection");
              this.hideMenu();
              return;
            }
            this.latestStartA1 = this.findActiveCellA1();
            console.log("success: find active selection: ", anchor);
            console.log("active cell A1 on context menu: ", this.latestStartA1);
            this.latestPosition = {
              x: event.clientX,
              y: event.clientY
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
        getThreadContainer() {
          if (this.selectors.container) {
            return document.querySelector(this.selectors.container);
          }
          return document.body;
        }
        initListener() {
          if (this.isBound) return;
          this.isBound = true;
          document.addEventListener("contextmenu", this.handleContextMenu, true);
          document.addEventListener("click", this.handleDismiss, true);
          document.addEventListener("keydown", this.handleKeydown, true);
          window.addEventListener("scroll", this.handleDismiss, true);
        }
        initPageObserver() {
          const targetNode = this.getThreadContainer();
          if (!targetNode) {
            setTimeout(() => this.initPageObserver(), 5e3);
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
              label: this.describeSelection(activeRect, "Active cell")
            };
          }
          const selectionRect = this.findSelectionRect();
          if (selectionRect) {
            return {
              rect: selectionRect,
              label: this.describeSelection(selectionRect, "Selection")
            };
          }
          return null;
        }
        findActiveCellRect() {
          const borders = Array.from(
            document.querySelectorAll(".range-border.active-cell-border")
          );
          console.log("num of selected cell: ", borders.length);
          const rects = borders.filter((el) => this.isVisible(el)).map((el) => el.getBoundingClientRect()).filter((rect) => rect.width > 0 || rect.height > 0);
          return this.mergeRects(rects);
        }
        findSelectionRect() {
          const selections = Array.from(
            document.querySelectorAll(".selection")
          );
          const rects = selections.filter((el) => this.isVisible(el)).map((el) => el.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
          if (rects.length === 0) return null;
          return rects.reduce((best, rect) => {
            const bestArea = best.width * best.height;
            const rectArea = rect.width * rect.height;
            return rectArea > bestArea ? rect : best;
          });
        }
        isVisible(el) {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.bottom >= 0 && rect.right >= 0 && rect.left <= window.innerWidth && rect.top <= window.innerHeight;
        }
        mergeRects(rects) {
          if (rects.length === 0) return null;
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
          if (!position) return;
          const menu = this.ensureMenu();
          const hintEl = menu.querySelector('[data-role="cell-label"]');
          if (hintEl) {
            hintEl.textContent = anchor.label;
          }
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
          wrapper.style.fontFamily = '"Segoe UI", sans-serif';
          wrapper.style.color = "#202124";
          const label = document.createElement("div");
          label.setAttribute("data-role", "cell-label");
          label.style.fontSize = "12px";
          label.style.color = "#5f6368";
          label.style.marginBottom = "6px";
          label.textContent = "Google Sheets cell";
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
          button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const result = await this.captureSelectionClipboard();
            console.log("trace-pilot google sheets clipboard capture:", result);
            const selectionCells = this.resolveSelectedCells(result);
            console.log("trace-pilot google sheets selected cells:", selectionCells);
            this.hideMenu();
          });
          wrapper.appendChild(label);
          wrapper.appendChild(button);
          document.body.appendChild(wrapper);
          this.menuEl = wrapper;
          return wrapper;
        }
        hideMenu() {
          if (this.menuEl) {
            this.menuEl.style.display = "none";
          }
        }
        async captureSelectionClipboard() {
          const execResult = await this.captureClipboardByCopyEvent();
          if (this.hasClipboardPayload(execResult)) {
            return execResult;
          }
          const navigatorResult = await this.captureClipboardByNavigator();
          if (this.hasClipboardPayload(navigatorResult)) {
            return navigatorResult;
          }
          return {
            ok: false,
            types: [],
            error: navigatorResult.error ?? execResult.error ?? "clipboard capture failed"
          };
        }
        captureClipboardByCopyEvent() {
          return new Promise((resolve) => {
            let settled = false;
            const finalize = (result) => {
              if (settled) return;
              settled = true;
              resolve(result);
            };
            const onCopy = (event) => {
              const clipboardData = event.clipboardData;
              if (!clipboardData) {
                finalize({
                  ok: false,
                  types: [],
                  error: "copy event did not expose clipboardData"
                });
                return;
              }
              const result = {
                ok: true,
                types: Array.from(clipboardData.types),
                textPlain: clipboardData.getData("text/plain"),
                textHtml: clipboardData.getData("text/html")
              };
              if (!this.hasClipboardPayload(result)) {
                finalize({
                  ok: false,
                  types: result.types,
                  textPlain: result.textPlain,
                  textHtml: result.textHtml,
                  error: "copy event returned empty clipboard payload"
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
                error: "copy event timeout"
              });
            }, 300);
            try {
              const success = document.execCommand("copy");
              if (!success) {
                finalize({
                  ok: false,
                  types: [],
                  error: "document.execCommand(copy) returned false"
                });
              }
            } catch (error) {
              finalize({
                ok: false,
                types: [],
                error: String(error)
              });
            }
          });
        }
        async captureClipboardByNavigator() {
          if (!navigator.clipboard?.read) {
            return {
              ok: false,
              types: [],
              error: "navigator.clipboard.read is not available"
            };
          }
          try {
            const items = await navigator.clipboard.read();
            const types = /* @__PURE__ */ new Set();
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
              textHtml
            };
          } catch (error) {
            return {
              ok: false,
              types: [],
              error: String(error)
            };
          }
        }
        hasClipboardPayload(result) {
          return result.types.length > 0 || !!result.textPlain || !!result.textHtml;
        }
        resolveSelectedCells(result) {
          if (!result.textPlain) {
            return {
              ok: false,
              error: "text/plain is empty"
            };
          }
          const startA1 = this.latestStartA1 ?? this.findActiveCellA1();
          if (!startA1) {
            return {
              ok: false,
              error: "failed to resolve active cell A1",
              grid: this.parseClipboardGrid(result.textPlain)
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
            rows: grid.rows
          };
        }
        findActiveCellA1() {
          const selectors = [
            'input[aria-label*="\u540D\u524D"]',
            'input[aria-label*="name"]',
            'input[aria-label*="\u30BB\u30EB"]',
            'input[aria-label*="cell"]',
            "input.docs-sheet-active-range-name",
            'input[type="text"]',
            '[role="textbox"]'
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
          const values = /* @__PURE__ */ new Set();
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
          const candidateElements = Array.from(
            document.querySelectorAll("input, [role='textbox'], [aria-label], button, div")
          );
          const candidates = candidateElements.filter((el) => this.isVisible(el)).map((el) => {
            const text = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value.trim() : (el.textContent ?? "").trim();
            const ariaLabel = el.getAttribute("aria-label") ?? "";
            return {
              tag: el.tagName,
              id: el.id || "",
              className: typeof el.className === "string" ? el.className : "",
              ariaLabel,
              text: text.slice(0, 80),
              parsed: this.parseA1OrRangeStart(text) ?? this.parseA1OrRangeStart(ariaLabel) ?? ""
            };
          }).filter((item) => {
            return item.parsed || /^[A-Z]+[1-9][0-9]*(:[A-Z]+[1-9][0-9]*)?$/.test(item.text) || /^[A-Z]+[1-9][0-9]*(:[A-Z]+[1-9][0-9]*)?$/.test(item.ariaLabel);
          }).slice(0, 30);
          console.log("trace-pilot google sheets A1 candidates:", candidates);
        }
        parseClipboardGrid(textPlain) {
          const rows = textPlain.split(/\r?\n/).filter((line) => line.length > 0).map((line) => line.split("	"));
          return {
            rowCount: rows.length,
            colCount: rows.reduce((max, row) => Math.max(max, row.length), 0),
            rows
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
              cells.push(
                `${this.toColumnName(origin.col + colOffset)}${origin.row + rowOffset}`
              );
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
            row: Number(match[2])
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
      };
    }
  });

  // content/google-sheets/google-sheets-listener.ts
  var GoogleSheetsListener;
  var init_google_sheets_listener = __esm({
    "content/google-sheets/google-sheets-listener.ts"() {
      "use strict";
      init_google_sheets_thread();
      GoogleSheetsListener = class {
        constructor() {
          this.thread = /* @__PURE__ */ new Map();
          this.activeThread = null;
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
            if (!request || typeof request !== "object") return;
            if (request.kind !== "GOOGLE_SHEETS_START_OBSERVE") return;
            const url = typeof request.url === "string" ? request.url : window.location.href;
            const title = typeof request.title === "string" ? request.title : document.title;
            this.ensureActiveThread(url, title);
          });
        }
        ensureActiveThread(url, title) {
          if (!this.isGoogleSheetsUrl(url)) return;
          const key = this.normalizeThreadKey(url);
          const existing = this.thread.get(key);
          if (existing) {
            this.activeThread = existing;
            existing.initPageObserver();
            return;
          }
          const newThread = new GoogleSheetsThread(key, title);
          this.thread.set(key, newThread);
          this.activeThread = newThread;
        }
        normalizeThreadKey(rawUrl) {
          try {
            const url = new URL(rawUrl);
            return `${url.origin}${url.pathname}`;
          } catch {
            return rawUrl;
          }
        }
        isGoogleSheetsPage() {
          return this.isGoogleSheetsUrl(window.location.href);
        }
        isGoogleSheetsUrl(url) {
          return url.startsWith("https://docs.google.com/spreadsheets/");
        }
      };
    }
  });

  // content/content.ts
  var require_content = __commonJS({
    "content/content.ts"() {
      init_gpt_listener();
      init_google_sheets_listener();
      var gptListener = new GPTListener();
      var googleSheetsListener = new GoogleSheetsListener();
      chrome.runtime.sendMessage(
        { type: "PING" },
        (response) => {
          console.log("response from background:", response);
        }
      );
      chrome.runtime.onMessage.addListener(
        (request, sender, sendResponse) => {
          if (typeof request !== "object" || request === null || !("type" in request) || request.type !== "trace-pilot") {
            return;
          }
          (async () => {
            try {
              const st = await navigator.clipboard.readText();
              sendResponse({ selectionText: st });
            } catch (e) {
              sendResponse({ error: String(e) });
            }
          })();
          return true;
        }
      );
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg?.kind !== "TRACE_PILOT_GET_SELECTION_WITH_BREAKES") return;
        try {
          const sel = window.getSelection?.();
          const text = sel ? sel.toString() : "";
          console.log("text", text);
          sendResponse({ ok: true, text });
        } catch (e) {
          sendResponse({ ok: false, error: String(e?.message ?? e) });
        }
        return true;
      });
      async function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
      }
      async function waitForReady(timeoutMs = 1200) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          if (document.hasFocus() && document.visibilityState === "visible") return true;
          await sleep(30);
        }
        return document.hasFocus() && document.visibilityState === "visible";
      }
      async function writeClipboardWithRetry(text, tries = 6) {
        let lastErr = null;
        for (let i = 0; i < tries; i++) {
          try {
            await navigator.clipboard.writeText(text);
            return;
          } catch (e) {
            lastErr = e;
            await sleep(80);
          }
        }
        throw lastErr;
      }
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg?.kind !== "TRACE_PILOT_WRITE_CLIPBOARD") return;
        (async () => {
          const ready = await waitForReady(1500);
          try {
            await writeClipboardWithRetry(msg.text, 8);
            sendResponse({ ok: true, ready });
          } catch (e) {
            sendResponse({ ok: false, error: String(e?.message ?? e), ready });
          }
        })();
        return true;
      });
      function viewClipboardData(event) {
        const clipboardData = event.clipboardData;
        if (!clipboardData) {
          console.log("clipboardData is empty");
          return;
        }
        console.log("clipboard data");
        console.log("types:", Array.from(clipboardData.types));
        if (clipboardData.items) {
          for (let i = 0; i < clipboardData.items.length; i++) {
            const item = clipboardData.items[i];
            const kind = item.kind;
            const type = item.type;
            if (item.kind === "string") {
              item.getAsString((s) => {
                console.log(`kind = ${kind}, type = ${type}, string = ${s}`);
              });
            } else if (item.kind === "file") {
              const f = item.getAsFile();
              if (!f) continue;
              const url = window.URL.createObjectURL(f);
              console.log(`kind = ${kind}, type = ${type}, url = ${url}`);
              window.URL.revokeObjectURL(url);
            }
          }
        }
      }
      var isCtrlCPressed = false;
      window.addEventListener("keydown", (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
          isCtrlCPressed = true;
        }
      });
      window.addEventListener("keyup", (event) => {
        if (event.key.toLowerCase() === "c" || event.key === "Control" || event.key === "Meta") {
          isCtrlCPressed = false;
        }
      });
      window.addEventListener("blur", () => {
        isCtrlCPressed = false;
      });
      window.addEventListener("copy", (event) => {
        if (!isCtrlCPressed) return;
        viewClipboardData(event);
        isCtrlCPressed = false;
      });
    }
  });
  require_content();
})();
