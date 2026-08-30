import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(item => {
  const [key, ...rest] = item.replace(/^--/, '').split('=');
  return [key, rest.join('=') || '1'];
}));
const port = Number(args.port || args['debug-port'] || 9222);
const outputDir = path.resolve(args.output || 'rift-building-previews/full-resolution');
const base3d = args.base3d || 'http://127.0.0.1:4173/building-3d-inspection.html?program=./riftcity-buildings/riftcity-bank-001.json';
const basePlan = args.plan || 'http://127.0.0.1:4173/building-inspection.html?program=./riftcity-buildings/riftcity-bank-001.json';

const shots = [
  ['bank-exterior-iso-nw', `${base3d}&mode=full&view=iso-nw`, '3d'],
  ['bank-exterior-south', `${base3d}&mode=full&view=south`, '3d'],
  ['bank-exterior-top', `${base3d}&mode=full&view=top`, '3d'],
  ['bank-f1-iso-se', `${base3d}&mode=floor&floor=1&view=iso-se`, '3d'],
  ['bank-grand-hall-eye-north', `${base3d}&mode=full&space=grand-hall&view=inside-north`, '3d'],
  ['bank-grand-hall-eye-south', `${base3d}&mode=full&space=grand-hall&view=inside-south`, '3d'],
  ['bank-teller-eye-north', `${base3d}&mode=full&space=teller-gallery&view=inside-north`, '3d'],
  ['bank-vault-eye-north', `${base3d}&mode=full&space=main-vault&view=inside-north`, '3d'],
  ['bank-vault-eye-south', `${base3d}&mode=full&space=main-vault&view=inside-south`, '3d'],
  ['bank-executive-eye-west', `${base3d}&mode=full&space=east-executive-offices&view=inside-west`, '3d'],
  ['bank-security-eye-west', `${base3d}&mode=full&space=east-security&view=inside-west`, '3d'],
  ['bank-section-long', `${base3d}&mode=section&sectionAxis=z&sectionDepth=3&view=south`, '3d'],
  ['bank-vault-section', `${base3d}&mode=section&sectionAxis=z&sectionDepth=3&focus=main-vault&view=south`, '3d'],
  ['bank-teller-section', `${base3d}&mode=section&sectionAxis=z&sectionDepth=3&focus=teller-gallery&view=south`, '3d'],
  ['bank-f1-plan', `${basePlan}&floor=1`, 'plan']
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
  }
  async connect() {
    this.ws = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
      else pending.resolve(message.result || {});
    });
    this.ws.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('Chrome DevTools connection closed.'));
      this.pending.clear();
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.ws?.close(); }
}

async function getPageTarget() {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!response.ok) throw new Error(`Chrome target list returned HTTP ${response.status}.`);
  const targets = await response.json();
  const page = targets.find(target => target.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('Chrome did not expose a debuggable page target.');
  return page;
}

async function pageState(client, kind) {
  const expression = kind === '3d'
    ? `(() => { const d=document.documentElement.dataset; if(d.riftInspectionError==='1') return 'error:'+(document.querySelector('#inspection-status')?.textContent||document.title); return d.riftInspectionReady==='1'?'ready':'pending'; })()`
    : `(() => { const d=document.documentElement.dataset; if(d.riftBuildingInspectionError==='1') return 'error:'+(document.querySelector('#status')?.textContent||document.title); const s=document.querySelector('#status')?.textContent||''; return s && !s.includes('Loading BuildingProgram') ? 'ready' : 'pending'; })()`;
  const result = await client.send('Runtime.evaluate', { expression, returnByValue: true });
  return result?.result?.value || 'pending';
}

async function waitReady(client, kind, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let last = 'pending';
  while (Date.now() < deadline) {
    try {
      last = await pageState(client, kind);
      if (last === 'ready') return;
      if (String(last).startsWith('error:')) throw new Error(String(last).slice(6));
    } catch (error) {
      if (!/context|navigation|closed/i.test(error?.message || '')) throw error;
    }
    await sleep(100);
  }
  throw new Error(`Inspection page did not become ready (${last}).`);
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const target = await getPageTarget();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1800,
      height: 1200,
      deviceScaleFactor: 1,
      mobile: false,
      screenWidth: 1800,
      screenHeight: 1200
    });

    let captured = 0;
    for (const [name, url, kind] of shots) {
      process.stdout.write(`[inspection-capture] ${captured + 1}/${shots.length} ${name} ... `);
      const nav = await client.send('Page.navigate', { url });
      if (nav.errorText) throw new Error(`${name}: navigation failed: ${nav.errorText}`);
      await waitReady(client, kind);
      await sleep(100);
      const shot = await client.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
        captureBeyondViewport: false
      });
      const file = path.join(outputDir, `${name}.png`);
      fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
      if (fs.statSync(file).size < 1024) throw new Error(`${name}: screenshot output is unexpectedly small.`);
      captured += 1;
      console.log('OK');
    }
    console.log(`[inspection-capture] PASS · ${captured} screenshots captured through one Chrome process and one reusable tab.`);
  } finally {
    client.close();
  }
}

main().catch(error => {
  console.error(`[inspection-capture] FAIL · ${error?.stack || error?.message || error}`);
  process.exit(1);
});
