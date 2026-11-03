// Catch syntax that would blank the whole app before polyfills can run. This is
// deliberately a production-artifact check, including dependency and lazy chunks.
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const directory = path.resolve(__dirname, '../build/static/js');
const files = fs.readdirSync(directory).filter(file => file.endsWith('.js') && file !== 'native-import.js');
for (const file of files) {
  acorn.parse(fs.readFileSync(path.join(directory, file), 'utf8'), { ecmaVersion: 5 });
}
if (!files.length) throw new Error('No production JavaScript found');
console.log(`Verified ES5 syntax in ${files.length} production JavaScript files`);
