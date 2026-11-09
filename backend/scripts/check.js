import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Script } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const directory of ['src', 'scripts', 'tests']) {
  const files = await readdir(new URL(directory + '/', new URL('../', import.meta.url)));
  for (const file of files.filter(name => name.endsWith('.js'))) {
    const check = spawnSync(process.execPath, ['--check', directory + '/' + file], { cwd: root, encoding: 'utf8' });
    if (check.status !== 0) {
      console.error(check.stderr || check.error?.message);
      process.exit(1);
    }
  }
}
const html = await readFile(new URL('../public/test.html', import.meta.url), 'utf8');
for (const [, source] of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new Script(source);
console.log('Cú pháp JavaScript và script trong /test: OK.');
