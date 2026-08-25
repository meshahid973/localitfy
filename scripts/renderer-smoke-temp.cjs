const fs = require('node:fs');

async function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function getTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:9222/json/list');
      if (response.ok) {
        const targets = await response.json();
        const target = targets.find((item) => /localhost:5173|127\.0\.0\.1:5173/.test(item.url || ''));
        if (target?.webSocketDebuggerUrl) return target;
      }
    } catch {}
    await sleep(500);
  }
  throw new Error('Localtify renderer target not found');
}

async function evaluate(target, expression) {
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('renderer smoke timed out')); }, 12000);
    ws.onerror = () => { clearTimeout(timer); reject(new Error('CDP websocket failed')); };
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }));
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timer);
      ws.close();
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result?.result?.value);
    };
  });
}

(async () => {
  const target = await getTarget();
  await sleep(4000);
  const result = await evaluate(target, `(() => {
    const root = document.getElementById('root');
    const app = document.querySelector('.app');
    const shell = document.querySelector('.appShell, .simpleShell');
    const sidebar = document.querySelector('.sidebar');
    const content = document.querySelector('.content');
    const snap = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return { width:r.width, height:r.height, display:s.display, visibility:s.visibility, opacity:Number(s.opacity) };
    };
    return {
      rootChildren: root?.childElementCount || 0,
      app: snap(app), shell: snap(shell), sidebar: snap(sidebar), content: snap(content),
      title: document.title,
      text: (document.body.innerText || '').slice(0, 300)
    };
  })()`);
  console.log('[renderer-smoke]', JSON.stringify(result));
  const visible = (value) => value && value.width > 100 && value.height > 100 && value.display !== 'none' && value.visibility !== 'hidden' && value.opacity > 0.05;
  if (!result || result.rootChildren < 1 || !visible(result.app) || !visible(result.shell)) {
    throw new Error(`renderer shell is not visibly mounted: ${JSON.stringify(result)}`);
  }
  if (fs.existsSync('/tmp/localtify-electron.log')) {
    const log = fs.readFileSync('/tmp/localtify-electron.log', 'utf8');
    if (log.includes('[localitfy renderer crash]')) throw new Error('renderer crash was logged');
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
