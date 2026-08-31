import fs from 'node:fs';
const path='scripts/build-brackenford-region-v2.mjs';
let s=fs.readFileSync(path,'utf8');
const replacements=[
  ["max:[15,11,13]","max:[15,11,13]"],
  ["max:[20,13,16]","max:[20,14,16]"],
  ["max:[23,18,14]","max:[23,17,14]"],
  ["max:[27,15,20]","max:[27,16,20]"],
  ["max:[28,17,22]","max:[28,17,22]"],
  ["max:[23,12,19]","max:[23,12,19]"],
  ["max:[24,18,24]","max:[24,16,24]"],
  ["max:[4,8,4]","max:[4,7,4]"]
];
for(const [a,b] of replacements){if(a===b) continue;if(s.includes(a))s=s.replace(a,b);}
s=s.replaceAll("max:[15,16,13]","max:[15,11,13]")
   .replaceAll("max:[20,20,16]","max:[20,14,16]")
   .replaceAll("max:[23,20,14]","max:[23,17,14]")
   .replaceAll("max:[27,20,20]","max:[27,16,20]")
   .replaceAll("max:[28,20,22]","max:[28,17,22]")
   .replaceAll("max:[23,16,19]","max:[23,12,19]")
   .replaceAll("max:[24,20,24]","max:[24,16,24]")
   .replaceAll("max:[4,9,4]","max:[4,7,4]");
fs.writeFileSync(path,s);
console.log('[brackenford-v2] prefab geometry bounds normalized; ready for full starter verifier');
