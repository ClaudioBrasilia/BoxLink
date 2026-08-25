import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const mode = process.argv[2];
if (mode !== 'box' && mode !== 'individual') {
  console.error('Uso: node scripts/sync-native.mjs <box|individual>');
  process.exit(2);
}

const isIndividual = mode === 'individual';
const appName = isIndividual ? 'BoxLeague' : 'BoxLink';
const appId = isIndividual ? 'com.crosscity.boxleague' : 'com.crosscity.hub';
const env = { ...process.env, VITE_APP_MODE: mode };
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function findFile(root, filename) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(path, filename);
      if (found) return found;
    } else if (entry.name === filename) {
      return path;
    }
  }
  return null;
}

// Sempre gera o web bundle correspondente antes de copiá-lo para o nativo.
run(npmCommand, ['run', isIndividual ? 'build:solo' : 'build']);
run(npmCommand, ['exec', '--', 'cap', 'sync']);

const androidBuildGradle = 'android/app/build.gradle';
let gradle = readFileSync(androidBuildGradle, 'utf8')
  .replace(/namespace\s+["'][^"']+["']/, `namespace "${appId}"`)
  .replace(/applicationId\s+["'][^"']+["']/, `applicationId "${appId}"`);
writeFileSync(androidBuildGradle, gradle);

const androidMainActivity = findFile('android/app/src/main/java', 'MainActivity.java');
if (!androidMainActivity) throw new Error('MainActivity.java não encontrada');
const desiredActivityPath = `android/app/src/main/java/${appId.replaceAll('.', '/')}/MainActivity.java`;
if (androidMainActivity !== desiredActivityPath) {
  mkdirSync(dirname(desiredActivityPath), { recursive: true });
  renameSync(androidMainActivity, desiredActivityPath);
}
let activity = readFileSync(desiredActivityPath, 'utf8')
  .replace(/^package\s+[^;]+;/m, `package ${appId};`);
writeFileSync(desiredActivityPath, activity);

const androidStrings = 'android/app/src/main/res/values/strings.xml';
let android = readFileSync(androidStrings, 'utf8');
android = android
  .replace(/(<string name="app_name">)[^<]*(<\/string>)/, `$1${appName}$2`)
  .replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, `$1${appName}$2`)
  .replace(/(<string name="package_name">)[^<]*(<\/string>)/, `$1${appId}$2`)
  .replace(/(<string name="custom_url_scheme">)[^<]*(<\/string>)/, `$1${appId}$2`);
writeFileSync(androidStrings, android);

const infoPlist = 'ios/App/App/Info.plist';
let plist = readFileSync(infoPlist, 'utf8').replace(/BoxLink|BoxLeague/g, appName);
writeFileSync(infoPlist, plist);

const iosProject = 'ios/App/App.xcodeproj/project.pbxproj';
let pbx = readFileSync(iosProject, 'utf8')
  .replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${appId};`);
writeFileSync(iosProject, pbx);

console.log(`[native] ${appName} sincronizado com appId ${appId}`);
console.log('[native] O próximo build nativo deve ser arquivado antes de sincronizar o outro modo.');
