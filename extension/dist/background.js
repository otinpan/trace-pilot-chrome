"use strict";
(() => {
  // src/background.ts
  chrome.runtime.onInstalled.addListener(function() {
    chrome.contextMenus.create({
      type: "normal",
      title: "create hash and store with trace-pilot (PDF)",
      contexts: ["selection"],
      id: "create_hash_and_store_pdf"
    });
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("background received message:", message);
    console.log("==sender object==");
    console.log(sender);
    if (message.type == "PING") {
      sendResponse({ type: "PONG" });
    } else if (message.type == "COPY_EVENT") {
      setTimeout(() => {
        sendResponse({ type: "COPY_RECORDED", text: message.text });
      }, 100);
      return true;
    }
  });
  function onClickHandler(info, tab) {
    if (info.menuItemId !== "hash_and_store_pdf") return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab0 = tabs[0];
      if (!tab0) return;
      const tabId = tab0.id;
      if (typeof tabId !== "number") {
        console.error("active tab has no id");
        return;
      }
      let url = tab0.url ?? "";
      if (!url) {
        console.error("active tab has no url:", tab0);
        return;
      }
      try {
        const u = new URL(url);
        const file = u.searchParams.get("file");
        if (file) {
          url = file;
        }
      } catch (e) {
        console.error("invalid tab url:", url, e);
        return;
      }
      if (!(url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file:///"))) {
        const i = url.indexOf("/https://") !== -1 ? url.indexOf("/https://") : url.indexOf("/http://") !== -1 ? url.indexOf("/http://") : url.indexOf("/file:///") !== -1 ? url.indexOf("/file:///") : -1;
        if (i === -1) {
          console.error("unsupported viewer url:", tab0.url);
          return;
        }
        url = url.substring(i + 1);
      }
      console.log("resolved pdf url =", url);
      chrome.tabs.sendMessage(
        tabId,
        { type: "trace-pilot" },
        (res) => {
          if (chrome.runtime.lastError) {
            console.error("sendMessage failed:", chrome.runtime.lastError.message);
            return;
          }
          if (!res) return;
          if ("error" in res) {
            console.error("trace-pilot error:", res.error);
            return;
          }
          const plainText = res.selectionText;
          console.log("received selection text:", plainText);
        }
      );
    });
  }
  chrome.contextMenus.onClicked.addListener(onClickHandler);
})();
