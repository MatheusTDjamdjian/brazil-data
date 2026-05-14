import { readFileSync } from 'node:fs';

const content = readFileSync('Makefile', 'utf8');

const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

console.log('');
console.log('  ' + bold('Brazil Data') + dim(' — Assistente Contábil'));
console.log('');
console.log('  Comandos:');
console.log('');

for (const line of content.split('\n')) {
  const m = line.match(/^([a-zA-Z_-]+):.*?##\s*(.+)$/);
  if (m) {
    console.log(`    ${cyan(m[1].padEnd(10))}  ${m[2]}`);
  }
}

console.log('');
console.log('  Quickstart:  ' + bold('cp .env.example .env && make up'));
console.log('');
