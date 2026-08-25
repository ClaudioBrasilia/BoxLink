import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const root = process.cwd();
const distDir = join(root, 'dist');
const snapshotsDir = join(root, '.tmp-app-separation');
const boxSnapshot = join(snapshotsDir, 'box');
const individualSnapshot = join(snapshotsDir, 'individual');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const boxOnlyChunks = ['Admin-', 'Coach-', 'Challenges-', 'Clans-', 'Feed-', 'Leaderboard-', 'MyBox-', 'TV-', 'Wod-'];
const individualChunks = ['Diario-', 'Duels-', 'Frequencia-', 'HeartRateSummary-', 'HeartRateWidget-', 'Insights-', 'Liga-', 'Profile-', 'hrv-', 'readiness-', 'vendor-charts-', 'vendor-react-'];

function runBuild(script, mode) {
  const result = spawnSync(npmCommand, ['run', script], {
    cwd: root,
    env: { ...process.env, VITE_APP_MODE: mode },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Build ${mode} falhou com código ${result.status}`);
}

async function filesStartingWith(snapshot, prefix) {
  const files = await readdir(join(snapshot, 'assets'));
  return files.filter((file) => file.startsWith(prefix));
}

async function assertIncludes(snapshot, prefix, label) {
  if ((await filesStartingWith(snapshot, prefix)).length === 0) {
    throw new Error(`${label}: chunk ${prefix} não encontrado`);
  }
}

async function assertNoPrefix(snapshot, prefix, label) {
  const files = await filesStartingWith(snapshot, prefix);
  if (files.length > 0) throw new Error(`${label}: chunk proibido ${files.join(', ')}`);
}

await rm(snapshotsDir, { recursive: true, force: true });
await mkdir(snapshotsDir, { recursive: true });

runBuild('build', 'box');
await cp(distDir, boxSnapshot, { recursive: true });

runBuild('build:solo', 'individual');
await cp(distDir, individualSnapshot, { recursive: true });

const boxIndex = await readFile(join(boxSnapshot, 'index.html'), 'utf8');
const individualIndex = await readFile(join(individualSnapshot, 'index.html'), 'utf8');
const boxManifest = JSON.parse(await readFile(join(boxSnapshot, 'manifest.webmanifest'), 'utf8'));
const individualManifest = JSON.parse(await readFile(join(individualSnapshot, 'manifest.webmanifest'), 'utf8'));

if (!boxIndex.includes('BoxLink') || boxIndex.includes('BoxLeague')) {
  throw new Error('BoxLink: index.html não está identificado exclusivamente como BoxLink');
}
if (!individualIndex.includes('BoxLeague') || individualIndex.includes('BoxLink')) {
  throw new Error('BoxLeague: index.html não está identificado exclusivamente como BoxLeague');
}
if (boxManifest.name !== 'BoxLink' || individualManifest.name !== 'BoxLeague') {
  throw new Error(`Manifestos inesperados: Box=${boxManifest.name}, Individual=${individualManifest.name}`);
}

for (const prefix of boxOnlyChunks) await assertIncludes(boxSnapshot, prefix, 'BoxLink');
for (const prefix of individualChunks) await assertIncludes(individualSnapshot, prefix, 'BoxLeague');
for (const prefix of boxOnlyChunks) await assertNoPrefix(individualSnapshot, prefix, 'BoxLeague');

const loginChunks = await filesStartingWith(individualSnapshot, 'Login-');
const loginText = await Promise.all(loginChunks.map((file) => readFile(join(individualSnapshot, 'assets', file), 'utf8')));
if (!loginText.some((text) => text.includes('Treine no seu ritmo'))) {
  throw new Error('BoxLeague: o chunk de Login não contém a copy individual esperada');
}
if (loginText.some((text) => text.includes('BoxLink'))) {
  throw new Error('BoxLeague: o chunk de Login ainda contém a marca BoxLink');
}

console.log(`[separation] BoxLink aprovado: ${boxManifest.name}; ${boxOnlyChunks.length} famílias de chunks Box presentes`);
console.log(`[separation] BoxLeague aprovado: ${individualManifest.name}; ${individualChunks.length} famílias necessárias presentes e nenhuma família Box-only vazou`);
