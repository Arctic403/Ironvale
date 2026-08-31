import fs from 'node:fs';
const path='scripts/check-ironvale-foundation.js';
let text=fs.readFileSync(path,'utf8');
text=text.replace("expect(exists('public/rift-world-blocks/ironvale-foundation-001.json'), 'Ironvale foundation world must be the default block');","expect(exists('public/rift-world-blocks/ironvale-terrain-bootstrap.json'), 'Ironvale terrain bootstrap must be the default world while Rift Terrain is rebuilt');");
text=text.replace("expect(worldShell.includes('IRONVALE · RIFT ENGINE WORLD FOUNDATION') && worldShell.includes(\"ironvale:world:active-block:v2\"), '3D world shell must be Ironvale-branded');","expect(worldShell.includes('IRONVALE · RIFT ENGINE WORLD FOUNDATION') && worldShell.includes(\"ironvale:world:active-block:v3\") && worldShell.includes('ironvale-terrain-bootstrap.json'), '3D world shell must be Ironvale-branded and terrain-reset aware');");
fs.writeFileSync(path,text);
console.log('[terrain-reset] foundation verifier aligned');
