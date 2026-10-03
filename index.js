import { program } from 'commander';
import { readFileSync } from 'node:fs';

program
  .name('menu')
  .description('Перегляд інформації про меню')
  .version('1.0.0', '-V, --version', 'поглянути версію')
  .option('-f, --file <path>', 'шлях до JSON-файлу', 'data.json');

function loadData() {
  const { file } = program.opts();
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    program.error(`Не вдалося прочитати "${file}": ${err.message}`);
  }
}

program.parse();

