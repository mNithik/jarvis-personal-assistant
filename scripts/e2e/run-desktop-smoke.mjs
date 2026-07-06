#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const isWindows = process.platform === "win32";
const appBinaryName = isWindows ? "jarvis.exe" : "jarvis";
const tauriDriverName = isWindows ? "tauri-driver.exe" : "tauri-driver";
const nativeDriverName = isWindows ? "msedgedriver.exe" : "WebKitWebDriver";

function resolveAppBinary() {
  if (process.env.JARVIS_DESKTOP_EXE && fs.existsSync(process.env.JARVIS_DESKTOP_EXE)) {
    return process.env.JARVIS_DESKTOP_EXE;
  }
  const targetDir = process.env.CARGO_TARGET_DIR
    ? path.resolve(process.env.CARGO_TARGET_DIR)
    : path.join(root, "apps/desktop/src-tauri/target");
  return path.join(targetDir, "debug", appBinaryName);
}

function resolveCargoBin(binaryName) {
  const candidate = path.join(os.homedir(), ".cargo", "bin", binaryName);
  return fs.existsSync(candidate) ? candidate : null;
}

function resolveTauriDriver() {
  if (process.env.TAURI_DRIVER_PATH && fs.existsSync(process.env.TAURI_DRIVER_PATH)) {
    return process.env.TAURI_DRIVER_PATH;
  }
  return resolveCargoBin(tauriDriverName);
}

function resolveNativeDriver() {
  if (process.env.NATIVE_DRIVER_PATH && fs.existsSync(process.env.NATIVE_DRIVER_PATH)) {
    return process.env.NATIVE_DRIVER_PATH;
  }
  for (const entry of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!entry) {
      continue;
    }
    const candidate = path.join(entry, nativeDriverName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStatus(url, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {}
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function webdriverRequest(method, route, body) {
  const response = await fetch(`http://127.0.0.1:4444${route}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.value?.error) {
    throw new Error(
      `WebDriver ${method} ${route} failed: ${JSON.stringify(payload.value ?? payload)}`,
    );
  }
  return payload.value;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function elementIdOf(element) {
  return element["element-6066-11e4-a52e-4f735466cecf"] ?? element.ELEMENT;
}

const WEBDRIVER_ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";

async function findElement(using, value) {
  const element = await webdriverRequest("POST", `/session/${sessionId}/element`, {
    using,
    value,
  });
  const id = elementIdOf(element);
  assert(id, `Expected element for ${using}=${value}`);
  return id;
}

async function waitForFindElement(using, value, timeoutMs, description) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      return await findElement(using, value);
    } catch (error) {
      lastError = error;
      await sleep(500);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for ${description}`);
}

async function getElementText(elementId) {
  return webdriverRequest("GET", `/session/${sessionId}/element/${elementId}/text`);
}

async function clickElement(elementId) {
  await scrollIntoView(elementId);
  await webdriverRequest("POST", `/session/${sessionId}/element/${elementId}/click`, {});
}

async function scrollIntoView(elementId) {
  await webdriverRequest("POST", `/session/${sessionId}/execute/sync`, {
    script: "arguments[0].scrollIntoView({block: 'center'});",
    args: [{ [WEBDRIVER_ELEMENT_KEY]: elementId }],
  });
}

async function pressEnter(elementId) {
  await webdriverRequest("POST", `/session/${sessionId}/actions`, {
    actions: [
      {
        type: "key",
        id: "keyboard",
        actions: [
          { type: "pause", duration: 100 },
          { type: "keyDown", value: "\uE007" },
          { type: "keyUp", value: "\uE007" },
        ],
      },
    ],
  });
}

async function sendKeys(elementId, text) {
  await webdriverRequest("POST", `/session/${sessionId}/element/${elementId}/value`, {
    text,
    value: [...text],
  });
}

async function clearElement(elementId) {
  await webdriverRequest("POST", `/session/${sessionId}/element/${elementId}/clear`, {});
}

async function waitForElementText(elementId, predicate, timeoutMs, description) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const text = await getElementText(elementId);
    if (predicate(text)) {
      return text;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function waitForWindowTitle(expectedTitle, timeoutMs) {
  const started = Date.now();
  let lastTitle = "";
  while (Date.now() - started < timeoutMs) {
    lastTitle = await webdriverRequest("GET", `/session/${sessionId}/title`);
    if (lastTitle === expectedTitle) {
      return lastTitle;
    }
    await sleep(500);
  }
  throw new Error(`Expected window title "${expectedTitle}", got "${lastTitle}"`);
}

const desktopDist = path.join(root, "apps/desktop/dist/index.html");
const appBinary = resolveAppBinary();
const tauriDriver = resolveTauriDriver();
const nativeDriver = resolveNativeDriver();

assert(fs.existsSync(desktopDist), `Missing desktop dist at ${desktopDist}`);
assert(fs.existsSync(appBinary), `Missing debug app binary at ${appBinary}`);
assert(tauriDriver, "tauri-driver was not found. Install it or set TAURI_DRIVER_PATH.");
assert(
  nativeDriver,
  `Native WebDriver ${nativeDriverName} was not found. Set NATIVE_DRIVER_PATH or add it to PATH.`,
);

const driverArgs = [];
driverArgs.push("--native-driver", nativeDriver);

console.log(`Using app binary: ${appBinary}`);
console.log(`Using tauri-driver: ${tauriDriver}`);
console.log(`Using native driver: ${nativeDriver}`);

const tauriDriverProcess = spawn(tauriDriver, driverArgs, {
  cwd: root,
  stdio: ["ignore", "inherit", "inherit"],
});

let sessionId = null;
let exitCode = 0;

try {
  tauriDriverProcess.on("exit", (code) => {
    if (sessionId === null && code !== 0) {
      console.error(`tauri-driver exited before session start with code ${code}`);
    }
  });

  await waitForStatus("http://127.0.0.1:4444/status", 30000);

  const session = await webdriverRequest("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        "tauri:options": {
          application: appBinary,
        },
      },
    },
  });
  sessionId = session.sessionId;
  assert(sessionId, "WebDriver session did not return a session id");

  await waitForWindowTitle("JARVIS", 90000);
  console.log("OK: window title");

  const handles = await webdriverRequest("GET", `/session/${sessionId}/window/handles`);
  assert(Array.isArray(handles) && handles.length >= 1, "Expected at least one window handle");
  console.log("OK: window handles");

  await clickElement(
    await waitForFindElement(
      "xpath",
      "//div[@role='tablist']//button[.//span[normalize-space()='Command']]",
      30000,
      "Command workspace tab",
    ),
  );
  console.log("OK: command workspace opened");

  const elementId = await waitForFindElement(
    "css selector",
    '[data-testid="command-input"]',
    30000,
    "command input",
  );
  console.log("OK: command input");

  const gatewayPreviewId = await waitForFindElement(
    "css selector",
    '[data-testid="gateway-preview"]',
    30000,
    "gateway preview card",
  );
  const gatewayPreviewRouteId = await findElement(
    "css selector",
    '[data-testid="gateway-preview"] .gateway-preview-route',
  );
  const defaultPreviewText = await getElementText(gatewayPreviewRouteId);
  assert(
    defaultPreviewText.includes("Type a command to preview the route."),
    `Expected default gateway preview text, got "${defaultPreviewText}"`,
  );
  console.log("OK: default gateway preview");

  await clearElement(elementId);
  await sendKeys(elementId, "list trigger recipes");
  await pressEnter(elementId);
  const previewText = await waitForElementText(
    gatewayPreviewRouteId,
    (text) =>
      text
      && !text.includes("Type a command to preview the route.")
      && !text.toLowerCase().includes("thinking"),
    30000,
    "gateway preview to update after routing",
  );
  assert(
    previewText.includes("Trigger Recipes /")
      || previewText.includes("Automation /")
      || previewText.includes("Command /"),
    `Expected routed preview label after routing, got "${previewText}"`,
  );
  const previewCardText = await getElementText(gatewayPreviewId);
  assert(
    previewCardText.toLowerCase().includes("score:")
      || previewCardText.toLowerCase().includes("matched"),
    `Expected preview reason details after routing, got "${previewCardText}"`,
  );
  console.log("OK: routed command updates gateway preview");

  const showTraceButtonId = await findElement(
    "xpath",
    "//button[normalize-space()='Show gateway trace']",
  );
  await clickElement(showTraceButtonId);
  const traceHeadingId = await findElement(
    "xpath",
    "//*[normalize-space()='Gateway trace']",
  );
  const traceHeadingText = await getElementText(traceHeadingId);
  assert(
    traceHeadingText === "Gateway trace",
    `Expected Gateway trace heading after opening trace panel, got "${traceHeadingText}"`,
  );
  console.log("OK: gateway trace toggle");

  console.log("Desktop smoke completed.");
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.message : String(error));
} finally {
  if (sessionId) {
    try {
      await webdriverRequest("DELETE", `/session/${sessionId}`);
    } catch {}
  }
  tauriDriverProcess.kill();
  process.exit(exitCode);
}
