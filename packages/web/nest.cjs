
const fs = require("fs");
const lines = fs.readFileSync("src/pages/Dashboard.tsx", "utf8").split("\n");
let level = 0;
for(let i=312; i<=490; i++) {
  let l = lines[i];
  if (!l) continue;
  let o = (l.match(/<div/g) || []).length;
  let c = (l.match(/<\/div>/g) || []).length;
  level += o;
  level -= c;
  if(level < 0 || c > 0) console.log(i+1, "L:"+level, o, c, l.trim());
}
