#!/usr/bin/env node
/**
 * Responsive check for the public site (09-WEBSITE-TEMPLATE-PROMPT.md §6:
 * "no horizontal scroll at 360/390/768/1440").
 *
 * Drives the Chrome you already have over the DevTools protocol, using Node's
 * built-in WebSocket — no Playwright, no puppeteer, nothing to install.
 *
 *   node scripts/check-layout.mjs                        # production
 *   node scripts/check-layout.mjs http://localhost:3000  # local
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_TO_TEST = process.argv[2] ?? "https://societymatter.vercel.app";
const PORT = 9333;

const VIEWPORTS = [
  { label: "360x800   (small phone)", width: 360, height: 800 },
  { label: "390x844   (iPhone 14)", width: 390, height: 844 },
  { label: "768x1024  (tablet)", width: 768, height: 1024 },
  { label: "1024x768  (tablet landscape)", width: 1024, height: 768 },
  { label: "1440x900  (laptop)", width: 1440, height: 900 },
];

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const chromePath = CHROME_PATHS.find((path) => existsSync(path));
if (!chromePath) {
  console.error("Could not find Chrome. Set CHROME_PATH and try again.");
  process.exit(1);
}

const profileDir = mkdtempSync(join(tmpdir(), "layout-check-"));
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--remote-allow-origins=*",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

function cleanup(code) {
  try {
    chrome.kill();
  } catch {
    /* already gone */
  }
  try {
    rmSync(profileDir, { recursive: true, force: true });
  } catch {
    /* windows lock */
  }
  process.exit(code);
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Chrome did not expose a debugging target in time.");
}

const MEASURE = `(() => {
  const doc = document.documentElement;
  const innerWidth = window.innerWidth;
  const offenders = [];
  for (const el of document.querySelectorAll("body *")) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const right = rect.right + window.scrollX;
    if (right > innerWidth + 1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute("class") || "").toString().slice(0, 60),
        right: Math.round(right),
      });
    }
  }
  return JSON.stringify({
    innerWidth,
    scrollWidth: doc.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflowing: offenders.slice(0, 8),
  });
})()`;

const socketUrl = await waitForTarget();
const socket = new WebSocket(socketUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const loaded = new Set();

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
    return;
  }
  if (message.method === "Page.loadEventFired") loaded.forEach((fn) => fn());
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
}

await send("Page.enable");

let failures = 0;
for (const viewport of VIEWPORTS) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width < 768,
  });

  const waitForLoad = new Promise((resolve) => loaded.add(resolve));
  await send("Page.navigate", { url: URL_TO_TEST });
  await Promise.race([waitForLoad, new Promise((r) => setTimeout(r, 12_000))]);
  loaded.clear();
  // Let fonts and layout settle.
  await new Promise((resolve) => setTimeout(resolve, 900));

  const result = await send("Runtime.evaluate", {
    expression: MEASURE,
    returnByValue: true,
  });

  const data = JSON.parse(result.result?.result?.value ?? "{}");
  const overflow = (data.scrollWidth ?? 0) - (data.innerWidth ?? 0);
  const clean = overflow <= 1 && (data.overflowing?.length ?? 0) === 0;

  if (!clean) failures += 1;
  console.log(
    `${clean ? "PASS" : "FAIL"}  ${viewport.label}  inner=${data.innerWidth} scrollWidth=${data.scrollWidth} overflow=${overflow}`,
  );
  for (const item of data.overflowing ?? []) {
    console.log(`         ↳ <${item.tag} class="${item.cls}"> right edge ${item.right}px`);
  }
}

console.log(
  failures === 0
    ? "\nAll viewports render without horizontal overflow."
    : `\n${failures} viewport(s) overflow.`,
);

socket.close();
cleanup(failures === 0 ? 0 : 1);
