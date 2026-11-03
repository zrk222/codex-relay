import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
mkdirSync('plugin/dist', { recursive: true });
const ui = await build({ entryPoints: ['src/relay/native-ui.mjs'], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', minify: true, metafile: true });
let html = readFileSync('docs/panel.html', 'utf8').replace('<link rel="stylesheet" href="/panel.css">', () => `<style>${readFileSync('docs/panel.css', 'utf8')}\n${readFileSync('docs/native.css', 'utf8')}</style>`)
  .replace('<script src="/panel.js" type="module"></script>', () => `<script type="module">${ui.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script>`);
writeFileSync('plugin/dist/workspace.html', html);
const server = await build({ entryPoints: ['src/relay/native-server.mjs'], outfile: 'plugin/dist/relay-server.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node22', metafile: true,
  banner: { js: "import { createRequire as relayCreateRequire } from 'node:module'; const require = relayCreateRequire(import.meta.url);" }, minify: true });
const packages = new Map();
for (const input of [...Object.keys(ui.metafile.inputs), ...Object.keys(server.metafile.inputs)].filter(p => p.startsWith('node_modules/'))) {
  let dir = dirname(resolve(input));
  while (!existsSync(`${dir}/package.json`) && dirname(dir) !== dir) dir = dirname(dir);
  if (!existsSync(`${dir}/package.json`)) throw new Error(`Missing dependency license metadata: ${input}`);
  const pkg = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8')); if (!pkg.name) continue;
  const notices = readdirSync(dir).filter(n => /^(license|copying|notice)(\.|$)/i.test(n)).map(n => `${n}\n${readFileSync(`${dir}/${n}`, 'utf8')}`).join('\n');
  packages.set(pkg.name, `${pkg.name} ${pkg.version}\nLicense: ${pkg.license ?? 'See upstream package'}\n${notices}`);
}
writeFileSync('plugin/THIRD_PARTY_NOTICES.txt', 'Codex Relay bundles the following dependency code. Original notices follow.\n\n' + [...packages.values()].sort().join('\n\n----------------------------------------\n\n'));
console.log('Bundled native stdio plugin + self-contained MCP App UI.');
