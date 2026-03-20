const fs = require('fs');
const contents = fs.readFileSync('packages/server/server.ts', 'utf8');
const routes = contents.match(/app\.(?:get|post|put|patch|delete)\(['"\]\/api\/(parents|users)[^'"\]*['"\]/g);
console.log(routes?.join('\n'));
