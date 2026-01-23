// content/gpt-module/gpt-thread.ts
function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), timeout);
  };
}
var GPTThread = class {
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
        console.log("stored user message=undefined:", this.tempUserMessage);
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
          return;
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
        if (result) {
          sendResponse({
            ok: true,
            result
          });
        }
      }
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
    const code = preNode?.innerText || "";
    const codeRef = preNode;
    const surroundingText = codeRef?.innerText || "";
    const language = preNode?.innerText.split(" ")[0] || "";
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

// content/gpt-module/gpt-listener.ts
var GPTListener = class {
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

// content/content.ts
var gptListener = new GPTListener();
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
  if (msg?.kind !== "TRACE_PILOT_WRITE_CLIPBOARD") return;
  (async () => {
    try {
      await navigator.clipboard.writeText(msg.text);
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  return true;
});
