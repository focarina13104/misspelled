import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(import.meta.dirname, '..');
const licenses = resolve(root, 'public/licenses');
await mkdir(licenses, { recursive: true });
for (const [name, locale] of [['dictionary-en', 'en'], ['dictionary-en-gb', 'en-GB']]) {
  const source = dirname(fileURLToPath(import.meta.resolve(name)));
  const target = resolve(root, 'public/dictionaries', locale);
  await mkdir(target, { recursive: true });
  for (const file of ['index.aff', 'index.dic']) {
    const input = resolve(source, file);
    if (!(await stat(input)).size) throw new Error(`Empty dictionary: ${name}/${file}`);
    await copyFile(input, resolve(target, file));
  }
  await copyFile(resolve(source, 'license'), resolve(licenses, `${name}.txt`));
}
const nspell = dirname(createRequire(import.meta.url).resolve('nspell/package.json'));
await copyFile(resolve(nspell, 'license'), resolve(licenses, 'nspell.txt'));
const bundledDependency = dirname(createRequire(import.meta.url).resolve('is-buffer/package.json'));
await copyFile(resolve(bundledDependency, 'LICENSE'), resolve(licenses, 'is-buffer.txt'));
console.log('Local English dictionaries and license notices prepared.');
