const OFFSCREEN_DOCUMENT_PATH = "dist/offscreen/offscreen.html";
const OFFSCREEN_WRITE_KIND = "TRACE_PILOT_OFFSCREEN_WRITE_CLIPBOARD";

type OffscreenClipboardResponse = {
  ok: boolean;
  error?: string;
};

type RuntimeWithContexts = typeof chrome.runtime & {
  getContexts?: (filter: {
    contextTypes?: string[];
    documentUrls?: string[];
  }) => Promise<Array<{ documentUrl?: string }>>;
};

type ChromeWithOffscreen = typeof chrome & {
  offscreen?: {
    createDocument(options: {
      url: string;
      reasons: string[];
      justification: string;
    }): Promise<void>;
  };
};

let creatingOffscreenDocument: Promise<void> | null = null;

async function hasOffscreenDocument(): Promise<boolean> {
  const runtime = chrome.runtime as RuntimeWithContexts;

  if (typeof runtime.getContexts === "function") {
    const contexts = await runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)],
    });
    return contexts.length > 0;
  }

  if (typeof clients === "undefined") {
    return false;
  }

  const matchedClients = await clients.matchAll();
  return matchedClients.some(
    (client) => client.url === chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)
  );
}

async function ensureOffscreenDocument(): Promise<void> {
  if (await hasOffscreenDocument()) {
    return;
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = (async () => {
      const offscreen = (chrome as ChromeWithOffscreen).offscreen;
      if (!offscreen) {
        throw new Error("chrome.offscreen is not available");
      }

      await offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ["CLIPBOARD"],
        justification: "Write clipboard text for PDF tabs",
      });
    })().finally(() => {
      creatingOffscreenDocument = null;
    });
  }

  await creatingOffscreenDocument;
}

export async function writeClipboardForPdf(text: string): Promise<void> {
  await ensureOffscreenDocument();

  const response = (await chrome.runtime.sendMessage({
    kind: OFFSCREEN_WRITE_KIND,
    text,
  })) as OffscreenClipboardResponse | undefined;

  if (!response?.ok) {
    throw new Error(response?.error ?? "offscreen clipboard write failed");
  }
}
