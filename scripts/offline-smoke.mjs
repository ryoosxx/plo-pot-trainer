/**
 * Chrome CDP で preview を開き、ネットワークを切ってチップ 10 問を完走する。
 * DevTools の Offline（機内モード相当）を Network.emulateNetworkConditions で再現する。
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.PWA_URL ?? 'http://127.0.0.1:4173';
const CHROME =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = Number(process.env.CDP_PORT ?? '9519');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      const box = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) box.reject(new Error(JSON.stringify(msg.error)));
      else box.resolve(msg.result);
    }
  });
  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve({ send, close: () => ws.close() }));
    ws.addEventListener('error', reject);
  });
}

async function evalExpr(session, expression, awaitPromise = false) {
  const result = await session.send('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const text = result.exceptionDetails.text ?? 'evaluate failed';
    const desc = result.exceptionDetails.exception?.description ?? '';
    throw new Error(`${text} ${desc}`.trim());
  }
  return result.result?.value;
}

async function click(session, testId) {
  const ok = await evalExpr(
    session,
    `(() => {
      const el = document.querySelector('[data-testid="${testId}"]');
      if (!el) return false;
      el.click();
      return true;
    })()`,
  );
  if (!ok) throw new Error(`missing click target ${testId}`);
}

async function waitFor(session, expression, timeoutMs, label) {
  const start = Date.now();
  let lastErr = '';
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await evalExpr(session, expression);
      if (value) return value;
      lastErr = `falsy (${typeof value})`;
    } catch (err) {
      lastErr = String(err);
    }
    await sleep(150);
  }
  throw new Error(`timeout waiting ${label}: ${lastErr} | ${await dump(session)}`);
}

async function dump(session) {
  try {
    return await evalExpr(
      session,
      `location.href + " | " + (document.body ? document.body.textContent : "").slice(0, 240)`,
    );
  } catch (err) {
    return String(err);
  }
}

async function main() {
  const profile = mkdtempSync(join(tmpdir(), 'plo-pwa-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--mute-audio',
      '--window-size=390,844',
      `--user-data-dir=${profile}`,
      `--remote-debugging-port=${DEBUG_PORT}`,
      BASE,
    ],
    { stdio: 'ignore' },
  );
  try {
    let version;
    for (let i = 0; i < 50; i++) {
      try {
        version = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((r) =>
          r.json(),
        );
        break;
      } catch {
        await sleep(150);
      }
    }
    if (!version?.webSocketDebuggerUrl) throw new Error('chrome debugger not ready');
    let page;
    for (let i = 0; i < 40; i++) {
      const list = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`).then((r) =>
        r.json(),
      );
      page = list.find(
        (t) => t.type === 'page' && String(t.webSocketDebuggerUrl ?? '').length > 0,
      );
      if (page?.webSocketDebuggerUrl) break;
      await sleep(150);
    }
    if (!page?.webSocketDebuggerUrl) throw new Error('no page websocket');
    const session = await openCdp(page.webSocketDebuggerUrl);
    await session.send('Page.enable');
    await session.send('Runtime.enable');
    await session.send('Network.enable');
    const href = await evalExpr(session, 'location.href');
    if (!String(href).includes('4173')) {
      await session.send('Page.navigate', { url: BASE });
    }
    await waitFor(
      session,
      `!!document.querySelector('[data-testid="home-chips"]')`,
      20000,
      'home',
    );
    console.log('loaded app');

    const swOk = await evalExpr(
      session,
      `Promise.race([
        navigator.serviceWorker.ready.then(async (reg) => {
          if (!navigator.serviceWorker.controller) {
            await new Promise((resolve) => {
              navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
              setTimeout(resolve, 4000);
            });
          }
          return !!(reg.active && navigator.serviceWorker.controller);
        }),
        new Promise((resolve) => setTimeout(() => resolve(false), 12000))
      ])`,
      true,
    );
    if (!swOk) {
      throw new Error(`service worker not controlling: ${await dump(session)}`);
    }
    console.log('sw controlling');

    await evalExpr(
      session,
      `localStorage.setItem('plo-trainer:settings:v1', JSON.stringify({
        schemaVersion: 1, ratePreset: '1/2', sb: 1, bb: 2, unit: 1,
        anteType: 'none', ante: 0, straddle: 'double', levels: [1,2,3],
        questionCount: 10, answerType: 'raiseTo', timeLimitSec: 0,
        chipPreset: 'jp', chipDenoms: [100,500,1000,5000,10000],
        sound: false, vibe: false
      }))`,
    );

    await session.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });

    const cachedHome = await evalExpr(session, `fetch('/').then((r) => r.ok)`, true);
    if (!cachedHome) {
      throw new Error('offline fetch of / failed — SW cache miss');
    }
    console.log('offline fetch / ok');

    await evalExpr(session, 'location.reload()');
    await waitFor(
      session,
      `!!document.querySelector('[data-testid="home-chips"]')`,
      15000,
      'offline home',
    );
    const title = String(
      await evalExpr(session, 'document.body ? document.body.textContent : ""'),
    );
    if (!title.includes('PLO Pot Trainer')) {
      throw new Error(`offline reload failed: ${await dump(session)}`);
    }
    console.log('reloaded offline');

    await click(session, 'home-chips');
    await waitFor(
      session,
      `location.pathname === '/quiz/chips' && !!document.querySelector('[data-testid="quiz-phase"]')`,
      8000,
      'chips quiz',
    );
    console.log('entered chips quiz');

    for (let i = 0; i < 10; i++) {
      let guard = 0;
      while (guard < 50) {
        const phase = String(
          await evalExpr(
            session,
            `document.querySelector('[data-testid="quiz-phase"]')?.textContent ?? ''`,
          ),
        );
        if (phase === 'feedback') break;
        if (phase === 'reveal') {
          await click(session, 'reveal-next');
          await sleep(40);
          guard += 1;
          continue;
        }
        const answer = String(
          await evalExpr(
            session,
            `document.querySelector('[data-testid="quiz-answer"]')?.textContent ?? ''`,
          ),
        );
        if (answer === '') {
          await sleep(40);
          guard += 1;
          continue;
        }
        for (const ch of answer) {
          await click(session, `key-${ch}`);
        }
        await click(session, 'key-submit');
        await sleep(60);
        guard += 1;
      }
      const phase = String(
        await evalExpr(
          session,
          `document.querySelector('[data-testid="quiz-phase"]')?.textContent ?? ''`,
        ),
      );
      if (phase !== 'feedback') {
        throw new Error(`q${i + 1} stuck at ${phase}: ${await dump(session)}`);
      }
      await click(session, 'next-question');
      await sleep(80);
    }

    const result = String(
      await waitFor(
        session,
        `document.querySelector('[data-testid="result-accuracy"]')?.textContent ?? ''`,
        8000,
        'result',
      ),
    );
    if (!result.includes('100%')) {
      throw new Error(`session did not finish offline: ${result} ${await dump(session)}`);
    }
    console.log('offline session complete', result);
    session.close();
  } finally {
    chrome.kill();
    await sleep(300);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      // chrome がプロファイルを握ったままでも検証自体は成功扱い
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
