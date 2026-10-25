// Rebuild P175 rule ledger from exact CSS, source occurrences and real Chromium observations.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {resolve,join,dirname,relative,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';
const frontend=resolve(dirname(fileURLToPath(import.meta.url)),'..'),repo=resolve(frontend,'..');
const [measurements,destination,...supplements]=process.argv.slice(2);assert.ok(measurements&&destination,'Usage: node e2e/bs5-d1c-inventory.mjs MEASUREMENTS OUTPUT');
const output=resolve(destination);await mkdir(output,{recursive:true});
const paths=execFileSync('rg',['--files','frontend/src','usr/lib/linuxmuster-webui/plugins/lmn_common/resources/content'],{cwd:repo,encoding:'utf8'}).trim().split('\n').filter(p=>/\.(vue|mjs|html)$/.test(p)&&!/(test|spec)\.mjs$/.test(p));
const sources=await Promise.all(paths.map(async path=>({path,text:await readFile(join(repo,path),'utf8')})));
const rules=[];
postcss.parse(await readFile(join(frontend,'theme/compat-bs3.css'),'utf8')).walkRules(rule=>{
 const context=[];for(let p=rule.parent;p;p=p.parent)if(p.type==='atrule')context.unshift(`@${p.name} ${p.params}`);
 const comment=rule.prev()?.type==='comment'?rule.prev().text:'';
 const group=/grid|column|row children/.test(comment)?'Raster/Breakpoints':/modal|backdrop|fade state/.test(comment)?'Modal':/forms/.test(comment)?'Formular-Basis':/tables/.test(comment)?'Tabellen':/typography|text|BS3 type;/.test(comment)?'Typografie':'Rest';
 rules.push({id:rules.length+1,line:rule.source.start.line,selector:rule.selector,context,effect:rule.nodes.filter(n=>n.type==='decl').map(n=>`${n.prop}:${n.value}${n.important?' !important':''}`).join(';'),comment,group});
});
assert.equal(rules.length,643);
async function files(root){const out=[];for(const e of await readdir(root,{withFileTypes:true})){const path=join(root,e.name);if(e.isDirectory())out.push(...await files(path));else if(e.name==='hits.json')out.push(path);}return out;}
const hits=new Map(),shellPairs=new Set();let snapshots=0;const browsers=new Set(),selectorErrors=[];
const roots=[measurements,...supplements].map(p=>resolve(p));
// Later corrected suite measurements replace earlier incomplete probes for that suite.
const probes=new Map((await Promise.all(roots.map(files))).flat().filter(path=>path.includes('/before/')).map(path=>[basename(dirname(path)),path]));
for(const path of probes.values()){
 // Use just one side of the A/A run, never inflate hit counts by duplicate renderings.
 if(!path.includes('/before/'))continue;
 const data=JSON.parse(await readFile(path,'utf8'));browsers.add(data.browser);
 for(const [scene,observations]of Object.entries(data.snapshots)){
  if(!scene.endsWith('-after.png'))continue;snapshots++;
  if(path.includes('/shell-rest/'))shellPairs.add(scene.split('/').at(-1));
  for(const h of observations){if(h.error){selectorErrors.push({scene,id:h.id,error:h.error});continue;}const values=hits.get(h.id)||[];values.push({scene:relative(resolve(measurements),scene),count:h.count,sample:h.sample});hits.set(h.id,values);}
 }
}
assert.equal(shellPairs.size,21,'Expected all 21 P174 shell measurements');
assert.equal(selectorErrors.length,0,'Selector probe errors: inspect hits.json');
const utility={'.text-left':'text-start','.text-right':'text-end','.text-center':'text-center','.text-nowrap':'text-nowrap','.text-lowercase':'text-lowercase','.text-uppercase':'text-uppercase','.text-capitalize':'text-capitalize','.list-unstyled':'list-unstyled','.sr-only':'visually-hidden','.sr-only-focusable:active, .sr-only-focusable:focus':'visually-hidden-focusable','.table-condensed':'table-sm','.pull-right':'float-end','.pull-left':'float-start','.center-block':'d-block mx-auto','.hidden':'d-none','.show':'d-block','.invisible':'invisible','.clearfix':'clearfix'};
function themeTarget(rule,family){
 const props=rule.effect.split(';').map(d=>d.split(':')[0]);
 if(rule.selector==='html')return 'html.aj-theme: --aj-type-root (10px) und --aj-tap-highlight; Reboot-/rem-Vertrag ausdrücklich entscheiden';
 if(family==='layout')return /container/.test(rule.selector)?'.aj-container: --aj-container-max an 768/992/1200; Innenabstand als --aj-container-gutter':'.aj-grid / .aj-grid-cell: 12 Spalten, --aj-span/--aj-start/--aj-grid-gap; Float/Offset/Push-Pull in Grid-Platzierung übersetzen, Responsive-Vertrag 768/992/1200';
 if(family==='modal')return '.modal/.modal-dialog mit .aj-modal: --aj-modal-width/--aj-modal-margin/--aj-modal-z; sm/lg und Zustand/Bodylock getrennt benennen';
 if(family==='table')return '.table mit .aj-table: --aj-table-cell-padding/--aj-table-border/--aj-table-background auf BS5-Zellstruktur; Varianten über table-sm/BS5-Variablen';
 if(family==='card')return '.card/.card-header/.card-body/.card-footer anstelle panel: --aj-card-padding/--aj-card-border/--aj-card-background, Größen/Listen-Kanten explizit';
 if(family==='alert')return '.alert: --bs-alert-* aus --aj-alert-{info,warning,danger,success}-*; kein eigener BS3-Variantenblock';
 const heading=rule.selector.match(/(?:^|[,.\s])h([1-6])(?:$|[,.\s])/);
 const prefix=family==='type'&&heading?`heading-${heading[1]}`:family;
 const tokens=props.map(prop=>`--aj-${prefix}-${prop}`).join(', ');
 return `${family==='button'?'.btn':family==='field'?'.form-control/.form-check/.input-group':family==='navigation'?'.nav/.navbar/.dropdown':'.aj-theme-'+family}: ${tokens}; Varianten/Zustände am Komponenten-Hook, gleichartige Regeln zusammenführen`;
}
const rows=rules.map(rule=>{
 const tokens=[...new Set([...rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m=>m[1]))];
 const tags=[...new Set([...rule.selector.matchAll(/(?:^|[,\s>+~])([a-z][a-z0-9-]*)(?=[\s,.#:[>+~]|$)/g)].map(m=>m[1]))];
 const candidates=[];
 for(const source of sources){const needles=tokens.length?tokens:tags;const lines=source.text.split('\n');
  for(let i=0;i<lines.length;i++)if(needles.some(t=>new RegExp(`(?<![\\w-])${t}(?![\\w-])`).test(lines[i])))candidates.push(`${source.path}:${i+1}`);
 }
 const observations=hits.get(rule.id)||[];
 const target=utility[rule.selector];
 const family=rule.group==='Rest'?(/navigation/.test(rule.comment)?'navigation':/buttons/.test(rule.comment)?'button':/panels/.test(rule.comment)?'card':/alerts/.test(rule.comment)?'alert':/progress/.test(rule.comment)?'progress':'utility'):({'Typografie':'type','Raster/Breakpoints':'layout','Modal':'modal','Formular-Basis':'field','Tabellen':'table'}[rule.group]);
 // No zero-hit deletion inference: unseen states/dynamic class values remain possible.
 const decision=target?'a':'b';
 const risk=['Raster/Breakpoints','Modal','Typografie'].includes(rule.group)||rule.context.length>0||/!important|:focus|:active|:checked|:disabled/.test(rule.selector+rule.effect)?'hoch':'mittel';
 const packageName=rule.group==='Rest'?(family==='navigation'?'P181':family==='button'?'P182':'P183'):({'Typografie':'P176','Raster/Breakpoints':'P177','Modal':'P178','Formular-Basis':'P179','Tabellen':'P180'}[rule.group]);
 const dynamicCandidates=[...(/modal/.test(rule.selector)?['frontend/src/shell/modal.mjs:14 (modal-${size})']:[]),...(/alert-/.test(rule.selector)?['frontend/src/shell/task-components.mjs:64 (alert variant)']:[]),...(/btn-/.test(rule.selector)?['frontend/src/shell/static-pages.mjs:15 (btn variant)']:[]),...(/col-/.test(rule.selector)?['frontend/src/shell/Dashboard.vue:30 (conditional grid)']:[]),'gettext HTML/v-html and Linbo image.status: see dynamic-class-producers.txt'];
 return {...rule,risk,package:packageName,decision,target:target?`Template BS5 ${target}; bei Wertabweichung benannter Theme-Token, keine blinde Gleichsetzung`:`ajenti-bs5.css: ${themeTarget(rule,family)}; Deklarationsvertrag siehe effect, kein 1:1-Selektorkopieren`,sourceCandidates:candidates,dynamicCandidates,chromium:observations,assessment:observations.length?'DOM-Treffer unter aktiver Media-Bedingung; Kaskadenwirkung separat gegenmessen':candidates.length?'Nur Quellkandidaten; Zustand/Renderer noch nicht lokal getroffen':'Kein Quell-/Szenentreffer; Löschkandidat, aber dynamische Erzeuger/ungeprüfte Zustände schließen c derzeit aus'};
});
const groupOrder=['Typografie','Raster/Breakpoints','Modal','Formular-Basis','Tabellen','Rest'];
const grouped=rows.toSorted((a,b)=>groupOrder.indexOf(a.group)-groupOrder.indexOf(b.group)||(a.risk===b.risk?0:a.risk==='hoch'?-1:1)||a.id-b.id);
const headers=['id','line','group','risk','package','context','selector','effect','decision','target','sourceCandidates','dynamicCandidates','chromium','assessment'];
await writeFile(join(output,'rules.tsv'),headers.join('\t')+'\n'+grouped.map(row=>headers.map(h=>typeof row[h]==='string'?row[h].replaceAll('\t',' ').replaceAll('\n',' '):JSON.stringify(row[h])).join('\t')).join('\n')+'\n');
const countBy=key=>Object.fromEntries([...new Set(rows.map(r=>r[key]))].map(v=>[v,rows.filter(r=>r[key]===v).length]));
await writeFile(join(output,'inventory-summary.json'),JSON.stringify({rules:rows.length,snapshots,measurementRoots:roots,selectorErrors,browsers:[...browsers],groups:countBy('group'),risk:countBy('risk'),packages:countBy('package'),decisions:countBy('decision'),matched:rows.filter(r=>r.chromium.length).length,sourceCandidates:rows.filter(r=>r.sourceCandidates.length).length,unobserved:rows.filter(r=>!r.chromium.length).map(r=>r.id),noSourceOrScene:rows.filter(r=>!r.chromium.length&&!r.sourceCandidates.length).map(r=>r.id)},null,2)+'\n');
console.log(JSON.stringify({rules:rows.length,snapshots,groups:countBy('group'),risk:countBy('risk'),packages:countBy('package'),decisions:countBy('decision'),matched:rows.filter(r=>r.chromium.length).length}));
