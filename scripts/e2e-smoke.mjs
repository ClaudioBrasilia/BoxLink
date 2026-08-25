import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import process from 'node:process';

const port = Number(process.env.E2E_PORT ?? 4173);
const baseUrl = `http://127.0.0.1:${port}`;
const maxAssetBytes = Number(process.env.MAX_JS_ASSET_BYTES ?? 700 * 1024);

function fail(message) {
  console.error(`[e2e] ${message}`);
  process.exitCode = 1;
}

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // O preview ainda pode estar iniciando.
    }
    await sleep(250);
  }
  throw new Error(`Servidor não respondeu em ${url}`);
}

async function assertRoute(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  if (!response.ok) throw new Error(`${pathname} retornou HTTP ${response.status}`);
  const html = await response.text();
  if (!html.includes('<div id="root"></div>')) {
    throw new Error(`${pathname} não retornou o shell React esperado`);
  }
  return html;
}

function chromiumBinary() {
  for (const candidate of [process.env.CHROMIUM_BIN, 'chromium', 'google-chrome', 'chromium-browser']) {
    if (!candidate) continue;
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
    if (result.status === 0) return candidate;
  }
  return null;
}

function assertBrowserRoute(binary, pathname) {
  const result = spawnSync(binary, [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--dump-dom',
    '--virtual-time-budget=5000',
    `${baseUrl}${pathname}`,
  ], { encoding: 'utf8', timeout: 20_000 });

  if (result.status !== 0) {
    throw new Error(`Chromium falhou em ${pathname}: ${(result.stderr || '').slice(0, 500)}`);
  }
  const dom = result.stdout || '';
  if (dom.length < 500 || !/<body[\s>]/i.test(dom)) {
    throw new Error(`Chromium retornou DOM vazio em ${pathname}`);
  }
  if (pathname === '/login' && !/ENTRAR|LOGIN|ACESSO/i.test(dom)) {
    throw new Error('A rota /login não renderizou o conteúdo de autenticação esperado');
  }
}

function assertBundleBudget() {
  const assetsDir = 'dist/assets';
  if (!existsSync(assetsDir)) throw new Error('dist/assets não existe; execute o build antes do smoke test');
  const jsAssets = readdirSync(assetsDir).filter((file) => file.endsWith('.js'));
  if (jsAssets.length < 2) throw new Error('Code splitting não gerou chunks JavaScript suficientes');
  const largest = jsAssets
    .map((file) => ({ file, bytes: statSync(`${assetsDir}/${file}`).size }))
    .sort((a, b) => b.bytes - a.bytes)[0];
  if (largest.bytes > maxAssetBytes) {
    throw new Error(`Chunk ${largest.file} excede o orçamento: ${largest.bytes} bytes > ${maxAssetBytes}`);
  }
  console.log(`[e2e] maior chunk JS: ${largest.file} (${Math.round(largest.bytes / 1024)} KiB)`);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const server = spawn(npmCommand, ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port)], {
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
  env: { ...process.env, NO_COLOR: '1' },
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

try {
  await waitForServer(`${baseUrl}/login`);
  await assertRoute('/login');
  await assertRoute('/insights');
  assertBundleBudget();

  const binary = chromiumBinary();
  if (!binary) {
    throw new Error('Chromium não encontrado; defina CHROMIUM_BIN para executar o teste end-to-end real');
  }
  assertBrowserRoute(binary, '/login');
  assertBrowserRoute(binary, '/insights');
  console.log('[e2e] login, insights, shell React e navegação headless aprovados');
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  if (serverOutput) console.error(serverOutput.slice(-1000));
} finally {
  try {
    if (server.pid && process.platform !== 'win32') process.kill(-server.pid, 'SIGTERM');
    else server.kill('SIGTERM');
  } catch {
    // O processo pode já ter encerrado depois do último request.
  }
  await sleep(100);
}

if (process.exitCode) process.exit(process.exitCode);
