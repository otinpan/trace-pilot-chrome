# trace-pilot-chrome

`trace-pilot-chrome` is a Chrome extension for preserving the provenance of copied text.

Status: Trace-Pilot is still under development and has not been publicly released yet.

When you copy text from sources such as ChatGPT, Google Sheets, PDFs, or regular web pages, the extension saves both the selected text and its source data into a Git repository. It then generates a hash marker and places it on the clipboard together with the copied text. When that text is pasted into VS Code, the marker can be used to trace the pasted content back to its original source.

This makes it easier to understand where copied code or text came from, why it was used, and how to inspect the original context later. The goal is to improve traceability and long-term maintainability.

The VS Code side of Trace-Pilot, which resolves these markers and shows the original source data, is available here:

https://github.com/otinpan/trace-pilot

## What This Repository Contains

This repository contains the Chrome extension side of Trace-Pilot. It is responsible for:

- Detecting supported pages in Chrome
- Capturing selected text
- Collecting source data from the current page
- Sending the captured data to the native host for Git storage
- Writing a trace marker back to the clipboard

## Supported Sources

The extension is designed to work with content copied from:

- ChatGPT
- Google Sheets
- PDF pages
- Static web pages

## How It Works

1. You select text in Chrome.
2. You run the Trace-Pilot context menu action.
3. The extension captures the selected text and the relevant source data.
4. The data is stored in a Git-backed repository through the native host.
5. A trace marker is generated and copied to the clipboard with the selected text.
6. When pasted into VS Code, the pasted content can be linked back to its origin.

## Usage
Tihs tool is not released yet.
At a high level, the workflow is:

1. Open a supported page in Chrome.
2. Select the text you want to preserve.
3. Right-click and choose a Trace-Pilot menu item.
4. Select the target repository.
5. Paste the result into VS Code.

## Why Use It

Trace-Pilot helps when copied text or code would otherwise lose its source context. Instead of leaving behind undocumented snippets, it preserves:

- Where the text came from
- The original surrounding data
- A stable reference that can be resolved later

This is especially useful for research, note-taking, code generation workflows, and long-lived software projects.
