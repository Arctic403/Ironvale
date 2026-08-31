import fs from 'node:fs';
const path='scripts/build-brackenford-region-v2.mjs';
let s=fs.readFileSync(path,'utf8');
const replacements=[
  ["max:[15,11,13]","max:[15,16,13]"],
  ["max:[20,13,16]","max:[20,20,16]"],
  ["max:[23,18,14]","max:[23,20,14]"],
  ["max:[27,15,20]","max:[27,20,20]"],
  ["max:[28,17,22]","max:[28,20,22]"],
  ["max:[27,15,20]","max:[27,20,20]"],
  ["max:[23,12,19]","max:[23,16,19]"],
  ["max:[24,18,24]","max:[24,20,24]"],
  ["max:[4,8,4]","max:[4,9,4]"]
];
for(const [a,b] of replacements){if(!s.includes(a)) continue;s=s.replace(a,b);}
fs.writeFileSync(path,s);
console.log('[brackenford-v2] expanded prefab metadata bounds for tall rooms/roofs');
