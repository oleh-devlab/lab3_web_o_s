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

function printDish(dish, data, options, id) {
const prefix = options.showId ? `[${id}]` : '-';
  let desc = '';
  if (options.dishDescriptions && dish.description != null) {
    desc = `: ${dish.description}`;
  }
  console.log(`${prefix} ${dish.name} (${dish.price} ${data.currency})${desc}`);
}

function printDishFull(dish, data) {
  console.log(`Назва: ${dish.name}`);
  console.log(`Ціна: ${dish.price} ${data.currency}`);
  console.log(`Вага: ${dish.weight} г`);
  console.log(`Гостра: ${dish.isSpicy ? 'так' : 'ні'}`);
  console.log(`Вегетаріанська: ${dish.isVegetarian ? 'так' : 'ні'}`);
  console.log(`Опис: ${dish.description ?? 'немає'}`);
  console.log(`Інгредієнти: ${dish.ingredients ? dish.ingredients.join(', ') : 'не вказано'}`);
}

function parsePrice(value) {
  const n = Number(value);
  if (value.trim() === '' || Number.isNaN(n) || n < 0) {
    throw new InvalidArgumentError('Очікується невід\'ємне число.');
  }
  return n;
}

// Шукає страву за ID (номер зі списку `list -i`) або за назвою.
function findDish(data, key) {
  let i = 0;
  for (const category of data.categories) {
    for (const dish of category.dishes) {
      i++;
      if (String(i) === key || dish.name === key) return dish;
    }
  }
  program.error(`Страву "${key}" не знайдено`);
}

program.command('list')
  .description('показати усі страви, за потреби з відбором за позначками й ціною')
  .option('-l, --limit <int>', 'обмежити кількість страв для виведення', parsePositiveInt)
  .option('-d, --dish-descriptions', 'показувати опис страв')
  .option('-i, --show-id', 'показувати ID страв')
  .option('--no-categories', 'не показувати категорії страв')
  .option('-s, --spicy', 'лише гострі страви')
  .option('-v, --vegetarian', 'лише вегетаріанські страви')
  .option('-p, --max-price <number>', 'найвища допустима ціна', parsePrice)
  .action((options) => {
    const data = loadData();
    let i = 0; // Кількість виведених страв для ліміту
    let id = 0; // Загальна кількість страв для індексування
    const isFilter = (options.spicy || options.vegetarian || (options.maxPrice !== undefined)); // Чи задано хоч одну умову фільтрування

    outerLoop:
    for (const category of data.categories) {
      let headerPrinted = false; // чи вже виведено заголовок цієї категорії
      if (options.categories && !isFilter && category.dishes.length === 0) {
        console.log(`${category.name}:`);
        console.log('- Категорія не має страв');
      }
      for (const dish of category.dishes) {
        id++;
        
        if (options.spicy && dish.isSpicy !== true) continue;
        if (options.vegetarian && dish.isVegetarian !== true) continue;
        if (options.maxPrice !== undefined && dish.price > options.maxPrice) continue;
        
        // заголовок друкується лише перед першою стравою, що пройшла фільтр
        if (options.categories && !headerPrinted) {
          console.log(`${category.name}:`);
          headerPrinted = true;
        }

        printDish(dish, data, options, id);

        i++;
        if (i === options.limit) break outerLoop;
      }
    }
    
    if (i === 0 && isFilter) console.log('Страв за заданими умовами не знайдено');
  });

program.command('show')
  .description('показати всі відомості про одну страву')
  .argument('<dish>', 'ID страви (з list -i) або її назва')
  .action((dishKey) => {
    const data = loadData();
    const dish = findDish(data, dishKey);
    printDishFull(dish, data);
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

program.command('search')
  .description('знайти страви, що містять інгредієнт')
  .argument('<ingredient>', 'назва інгредієнта або її частина')
  .option('-e, --exact', 'шукати лише точний збіг назви')
  .option('-d, --dish-descriptions', 'показувати опис страв')
  .action((ingredient, options) => {
    const data = loadData();
    const wanted = ingredient.toLowerCase();
    let found = 0;
    for (const category of data.categories) {
      for (const dish of category.dishes) {
        const ingredients = dish.ingredients ?? [];
        const matches = ingredients.some((item) => {
          const name = item.toLowerCase();
          return options.exact ? name === wanted : name.includes(wanted);
        });
        if (!matches) continue;
        printDish(dish, data, options);
        found++;
      }
    }
    if (found === 0) console.log(`Страв з інгредієнтом "${ingredient}" не знайдено`);
  });

program.parse();
