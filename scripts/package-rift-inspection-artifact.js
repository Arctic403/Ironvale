import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=path.resolve(process.argv[2]||'rift-building-previews');
const fullDir=path.join(root,'full-resolution');
const previewDir=path.join(root,'previews');
const reportPath=path.join(root,'bank-inspection-report.json');
const manifestPath=path.join(root,'manifest.json');
const contactPath=path.join(root,'contact-sheet.webp');

if(!fs.existsSync(fullDir))throw new Error(`Missing full-resolution inspection directory: ${fullDir}`);
fs.mkdirSync(previewDir,{recursive:true});

function commandExists(command){
  try{execFileSync('bash',['-lc',`command -v ${command}`],{stdio:'ignore'});return true}catch{return false}
}

const useMagick=commandExists('magick');
const convertCommand=useMagick?'magick':commandExists('convert')?'convert':null;
const montageCommand=useMagick?'magick':commandExists('montage')?'montage':null;
if(!convertCommand||!montageCommand){
  throw new Error('ImageMagick is required to package inspection previews (magick, or convert + montage).');
}

function runConvert(args){
  execFileSync(convertCommand,useMagick?['convert',...args]:args,{stdio:'inherit'});
}
function runMontage(args){
  execFileSync(montageCommand,useMagick?['montage',...args]:args,{stdio:'inherit'});
}
function humanFloor(stem){
  if(stem.includes('-b1-')||stem.includes('-vault-'))return 'B1';
  if(stem.includes('-f1-')||stem.includes('-grand-hall-'))return 'F1';
  return null;
}
function viewMetadata(file){
  const stem=path.basename(file,'.png');
  let category='other',spaceId=null,view=null,priority=50;
  if(stem.startsWith('bank-exterior-')){category='exterior';view=stem.slice('bank-exterior-'.length);priority=view.startsWith('iso-')?20:24}
  else if(stem.startsWith('bank-vault-eye-')){category='interior-eye';spaceId='b1-vault';view=`inside-${stem.slice('bank-vault-eye-'.length)}`;priority=5}
  else if(stem.startsWith('bank-grand-hall-eye-')){category='interior-eye';spaceId='f1-grand-hall';view=`inside-${stem.slice('bank-grand-hall-eye-'.length)}`;priority=5}
  else if(stem.startsWith('bank-stair-section-')){category='stair-section';spaceId='grand-stair-b1-f1';view=stem.slice('bank-stair-section-'.length);priority=8}
  else if(stem.startsWith('bank-section-')){category='building-section';view=stem.slice('bank-section-'.length);priority=10}
  else if(/bank-(?:b1|f1)-iso-/.test(stem)){category='floor-isometric';view=stem.match(/iso-(?:nw|ne|sw|se)$/)?.[0]||null;priority=15}
  else if(stem.endsWith('-plan')){category='floor-plan';view='top';priority=30}
  else if(stem.includes('xray-plan')){category='xray-plan';view='top';priority=28}
  return {id:stem,label:stem.replace(/^bank-/,'').replaceAll('-',' '),category,floor:humanFloor(stem),spaceId,view,priority};
}

const pngs=fs.readdirSync(fullDir).filter(name=>name.toLowerCase().endsWith('.png')).sort();
if(!pngs.length)throw new Error('No inspection PNGs were found to package.');

const views=[];
for(const file of pngs){
  const source=path.join(fullDir,file);
  const meta=viewMetadata(file);
  const previewName=`${meta.id}.webp`;
  const previewPath=path.join(previewDir,previewName);
  runConvert([
    source,
    '-auto-orient','-thumbnail','720x480>',
    '-background','#10151b','-gravity','south','-splice','0x38',
    '-fill','#f4f6f8','-pointsize','18','-annotate','+0+10',meta.label.toUpperCase(),
    '-strip','-quality','74','-define','webp:method=6',previewPath
  ]);
  const sourceStat=fs.statSync(source),previewStat=fs.statSync(previewPath);
  views.push({...meta,fullResolution:`full-resolution/${file}`,preview:`previews/${previewName}`,bytes:{png:sourceStat.size,webp:previewStat.size}});
}

const ordered=[...views].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
runMontage([
  ...ordered.map(item=>path.join(root,item.preview)),
  '-tile','4x','-geometry','+10+10','-background','#080b0f',
  '-strip','-quality','76','-define','webp:method=6',contactPath
]);

let report=null;
if(fs.existsSync(reportPath)){
  try{report=JSON.parse(fs.readFileSync(reportPath,'utf8'))}catch(error){throw new Error(`Inspection report JSON is invalid: ${error.message}`)}
}
const totals=views.reduce((acc,item)=>{acc.png+=item.bytes.png;acc.webp+=item.bytes.webp;return acc},{png:0,webp:0});
const manifest={
  format:'riftcity-building-inspection-manifest',
  version:1,
  generatedAt:new Date().toISOString(),
  building:{id:report?.buildingId||'riftcity-bank-001',name:report?.name||'RiftCity Bank'},
  review:{
    contactSheet:'contact-sheet.webp',
    report:'bank-inspection-report.json',
    preferredOrder:ordered.map(item=>item.id),
    instructions:'Review the contact sheet first. Open individual WebP previews for suspicious views. Fetch the separate full-resolution artifact only when pixel-level inspection is needed.'
  },
  physicalInspection:report?{validation:report.validation||null,clearance:report.clearance?.summary||null,floors:report.floors||[]} : null,
  transfer:{viewCount:views.length,fullResolutionBytes:totals.png,previewBytes:totals.webp,previewRatio:totals.png?Number((totals.webp/totals.png).toFixed(4)):null},
  views:ordered.map(({priority,...item})=>item)
};
fs.writeFileSync(manifestPath,`${JSON.stringify(manifest,null,2)}\n`);

console.log(`[inspection-package] PASS · ${views.length} views · PNG ${(totals.png/1048576).toFixed(2)} MiB → WebP ${(totals.webp/1048576).toFixed(2)} MiB · contact sheet + manifest ready.`);
