import { program, InvalidArgumentError } from 'commander';
import { readFileSync } from 'node:fs';

program
  .name('menu')
  .description('Перегляд інформації про меню')
  .version('1.0.0', '-V, --version', 'поглянути версію')
  .option('-f, --file <path>', 'шлях до JSON-файлу', 'data.json');

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new InvalidArgumentError('Очікується додатне ціле число.');
  }
  return n;
}

function loadData() {
  const { file } = program.opts();
  let data = {};
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') program.error(`Файл "${file}" не знайдено`);
    if (err instanceof SyntaxError) program.error(`Файл "${file}" містить некоректний JSON`);
    program.error(`Не вдалося прочитати "${file}": ${err.message}`);
  }
  if (!Array.isArray(data?.categories)) {
    program.error(`Файл "${file}" не містить масиву categories`);
  }
  for (const category of data.categories) {
    if (!Array.isArray(category?.dishes)) {
      program.error(`Файл "${file}" містить категорію без масиву dishes`);
    }
  }
  return data;
}

function printDish(dish, data, options) {
  let desc = '';
  if (options.dishDescriptions && dish.description != null) {
    desc = `: ${dish.description}`;
  }
  console.log(`- ${dish.name} (${dish.price} ${data.currency})${desc}`);
}

// Шукає страву за ID (номер зі списку `list -i`) або за назвою.
function findDish(data, key) {
  let i = 0;
  for (const category of data.categories) {
    for (const dish of category.dishes) {
      if (String(i) === key || dish.name === key) return dish;
      i++;
    }
  }
  program.error(`Страву "${key}" не знайдено`);
}

program.command('list')
  .description('показати усі страви')
  .option('-l, --limit <int>', 'обмежити кількість страв для виведення', parsePositiveInt)
  .option('-d, --dish-descriptions', 'показувати опис страв')
  .option('-i, --show-id', 'показувати ID страв')
  .option('--no-categories', 'не показувати категорії страв')
  .action((options) => {
    const data = loadData();
    let i = 0;
    outerLoop: for (const category of data.categories) {
      if (options.categories) {
        console.log(`${category.name}:`);
        if (category.dishes.length === 0) console.log('- Категорія не має страв');
      }
      for (const dish of category.dishes) {
        let desc = '';
        let tid = '-';
        if (options.dishDescriptions && dish.description != null) {
          desc = `: ${dish.description}`;
        }
        if (options.showId) {
          tid = `[${i}]`;
        }

        console.log(`${tid} ${dish.name} (${dish.price} ${data.currency})${desc}`);

        i++;
        if (i === options.limit) break outerLoop;
      }
    }
  });

program.command('show')
  .description('показати всі відомості про одну страву')
  .argument('<dish>', 'ID страви (з list -i) або її назва')
  .action((dishKey) => {
    const data = loadData();
    const dish = findDish(data, dishKey);
    console.log(JSON.stringify(dish, null, 2));
  });

program.command('get')
  .description('показати значення окремого поля страви')
  .argument('<dish>', 'ID страви (з list -i) або її назва')
  .argument('<path>', 'шлях до поля через крапку, наприклад ingredients.0')
  .action((dishKey, path) => {
    const data = loadData();
    const dish = findDish(data, dishKey);

    let value = dish;
    for (const key of path.split('.')) {
      if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) {
        program.error(`Поле "${path}" відсутнє у страві "${dish.name}"`);
      }
      value = value[key];
    }

    if (typeof value === 'object') {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(value);
    }
  });

program.command('category')
  .description('показати страви однієї категорії')
  .argument('<name>', 'назва категорії')
  .option('-d, --dish-descriptions', 'показувати опис страв')
  .action((name, options) => {
    const data = loadData();
    const category = data.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (category === undefined) program.error(`Категорію "${name}" не знайдено`);

    console.log(`${category.name}:`);
    if (category.dishes.length === 0) console.log('- Категорія не має страв');
    for (const dish of category.dishes) {
      printDish(dish, data, options);
    }
  });

program.parse();
