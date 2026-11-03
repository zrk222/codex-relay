import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
for (const directory of ['src/relay', 'docs', 'scripts', 'tests']) {
  for (const name of readdirSync(directory).filter(name => /\.(mjs|js)$/.test(name))) execFileSync(process.execPath, ['--check', join(directory, name)], { stdio: 'inherit' });
}
console.log('Syntax checks passed.');
