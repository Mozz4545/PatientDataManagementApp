import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const baseUrl = "http://localhost:3000";
const outputDir = path.resolve("UserManual_Lao", "screenshots");
const qaDir = path.resolve("UserManual_Lao", "responsive-qa");
const profileDir = path.resolve("UserManual_Lao", `.edge-profile-${Date.now()}`);
const port = 9229;

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await mkdir(qaDir, { recursive: true });
await mkdir(profileDir, { recursive: true });

const loginResponse = await fetch("http://localhost:5000/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "admin123" }),
});
if (!loginResponse.ok) throw new Error(`Login failed: ${loginResponse.status}`);
const loginPayload = await loginResponse.json();
const user = loginPayload.data.user;
const sessionCookieHeader = loginResponse.headers.get("set-cookie") || "";
const sessionToken = sessionCookieHeader.match(/radiology_session=([^;]+)/)?.[1];
if (!sessionToken) throw new Error("Login response did not include a session cookie");

const edge = spawn(
  edgePath,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--use-gl=disabled",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    "--window-size=1440,1000",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "ignore"], windowsHide: true }
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDebugger() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (response.ok) return response.json();
    } catch {}
    await sleep(250);
  }
  throw new Error("Edge debugging endpoint did not start");
}

const targets = await waitForDebugger();
const target = targets.find((item) => item.type === "page");
if (!target) throw new Error("No Edge page target");

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id) return;
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(JSON.stringify(message.error)));
  else handler.resolve(message.result);
});

function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function setViewport(width, height) {
  await cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
    screenWidth: width,
    screenHeight: height,
  });
}

async function navigate(route) {
  await cdp("Page.navigate", { url: `${baseUrl}${route}` });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if ((await evaluate("document.readyState")) === "complete") break;
    await sleep(150);
  }
  await sleep(1200);
}

async function capture(filename, { fullPage = true } = {}) {
  const metrics = await cdp("Page.getLayoutMetrics");
  const viewport = metrics.layoutViewport;
  const width = Math.ceil(viewport.clientWidth);
  const height = fullPage
    ? Math.max(viewport.clientHeight, Math.min(5000, Math.ceil(metrics.contentSize.height)))
    : Math.ceil(viewport.clientHeight);
  const shot = await cdp("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: fullPage,
    fromSurface: true,
    clip: { x: 0, y: 0, width, height, scale: 1 },
  });
  await writeFile(path.join(outputDir, filename), Buffer.from(shot.data, "base64"));
}

async function clickText(text) {
  return evaluate(`(() => {
    const target = [...document.querySelectorAll("button,a")].find(
      (node) => node.textContent.trim().includes(${JSON.stringify(text)})
    );
    if (!target) return false;
    target.click();
    return true;
  })()`);
}

async function auditPage(route, viewportName, width, height) {
  await setViewport(width, height);
  await navigate(route);
  const audit = await evaluate(`(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const bodyOverflow = document.documentElement.scrollWidth > viewportWidth + 2;
    const offenders = [...document.querySelectorAll("body *")]
      .filter((element) => {
        if (element.closest('[aria-hidden="true"]')) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
        if (style.position === "fixed" || style.position === "absolute") return false;
        if (rect.width <= 0 || rect.height <= 0) return false;
        return rect.right > viewportWidth + 4 || rect.left < -4;
      })
      .slice(0, 12)
      .map((element) => ({
        tag: element.tagName,
        text: (element.textContent || "").trim().slice(0, 80),
        className: String(element.className || "").slice(0, 160),
        rect: {
          left: Math.round(element.getBoundingClientRect().left),
          right: Math.round(element.getBoundingClientRect().right),
          width: Math.round(element.getBoundingClientRect().width),
        },
      }));
    const visibleFixedBottomNav = [...document.querySelectorAll('nav[aria-label="Mobile navigation"]')]
      .some((element) => getComputedStyle(element).display !== "none");
    const visibleSidebar = [...document.querySelectorAll("aside")]
      .some((element) => {
        if (element.closest('[aria-hidden="true"]')) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0
          && rect.right > 0 && rect.left < viewportWidth;
      });
    const buttonLabels = [...document.querySelectorAll("button,a")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((element) => (element.textContent || "").trim())
      .filter(Boolean);
    return {
      route: location.pathname,
      viewport: { width: innerWidth, height: innerHeight },
      bodyOverflow,
      offenders,
      visibleFixedBottomNav,
      visibleSidebar,
      buttonLabels,
    };
  })()`);
  return { viewportName, ...audit };
}

await cdp("Page.enable");
await cdp("Runtime.enable");

const auditRoutes = [
  "/dashboard",
  "/patients",
  "/queues",
  "/orders",
  "/orders/new",
  "/payments",
  "/results",
  "/exam-types",
  "/staff",
  "/staff/new",
  "/reports",
];
const viewports = [
  ["desktop", 1440, 900],
  ["laptop", 1280, 720],
  ["tablet", 768, 1024],
  ["mobile", 390, 844],
];
const auditResults = [];

try {
  await cdp("Network.enable");
  await setViewport(1440, 900);
  await navigate("/login");
  await capture("01-login.png", { fullPage: false });
  await cdp("Network.setCookie", {
    name: "radiology_session",
    value: decodeURIComponent(sessionToken),
    url: baseUrl,
    httpOnly: true,
    sameSite: "Strict",
  });
  await evaluate(`
    localStorage.setItem("radiology_user", ${JSON.stringify(JSON.stringify(user))});
  `);

  const patientId = await evaluate(`
    fetch("http://localhost:5000/api/patients?limit=1", {
      credentials: "include"
    }).then(r => r.json()).then(x => x.data?.[0]?.patient_id || null)
  `);

  const desktopPages = [
    ["02-dashboard.png", "/dashboard"],
    ["03-patients.png", "/patients"],
    ["04-orders.png", "/orders"],
    ["05-new-order.png", "/orders/new"],
    ["06-queues.png", "/queues"],
    ["07-queue-display.png", "/queues/display"],
    ["08-payments.png", "/payments"],
    ["09-results.png", "/results"],
    ["10-exam-types.png", "/exam-types"],
    ["11-staff.png", "/staff"],
    ["12-staff-new.png", "/staff/new"],
    ["13-reports-payments.png", "/reports"],
  ];

  for (const [filename, route] of desktopPages) {
    await setViewport(1440, 900);
    await navigate(route);
    await capture(filename);
  }

  await setViewport(1440, 900);
  await navigate("/reports");
  await clickText("ລາຍງານຜົນກວດ");
  await sleep(400);
  await capture("14-reports-results.png");

  if (patientId) {
    await navigate(`/patients/${patientId}/history`);
    await capture("15-patient-history.png");
    await navigate(`/patients/${patientId}/edit`);
    await capture("16-patient-edit.png");
  }

  await setViewport(390, 844);
  await navigate("/dashboard");
  await capture("17-mobile-dashboard.png", { fullPage: false });
  await clickText("ເມນູ");
  await sleep(300);
  await capture("18-mobile-menu.png", { fullPage: false });

  for (const [viewportName, width, height] of viewports) {
    for (const route of auditRoutes) {
      auditResults.push(await auditPage(route, viewportName, width, height));
    }
  }

  await writeFile(
    path.join(qaDir, "responsive-audit.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        viewports: viewports.map(([name, width, height]) => ({ name, width, height })),
        results: auditResults,
      },
      null,
      2
    ),
    "utf8"
  );
} finally {
  ws.close();
  edge.kill();
  await sleep(500);
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}

const failures = auditResults.filter((result) => result.bodyOverflow);
console.log(`Screenshots: ${outputDir}`);
console.log(`Responsive audits: ${auditResults.length}, page-level overflow failures: ${failures.length}`);
if (failures.length) {
  console.log(JSON.stringify(failures.map(({ viewportName, route, offenders }) => ({ viewportName, route, offenders })), null, 2));
}
