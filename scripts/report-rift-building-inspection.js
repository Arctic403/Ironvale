import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileRiftBuildingProgram} from '../public/rift-building-program.js';
import {createRiftInspectionReport} from '../public/rift-building-inspection-core.js';

const here=path.dirname(fileURLToPath(import.meta.url));
const input=process.argv[2]||'public/riftcity-buildings/riftcity-bank-001.json';
const resolved=path.resolve(here,'..',input);
const source=JSON.parse(fs.readFileSync(resolved,'utf8'));
const compiled=compileRiftBuildingProgram(source,{strict:true});
const report=createRiftInspectionReport(compiled);
process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
