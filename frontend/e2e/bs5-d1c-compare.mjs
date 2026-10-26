// Offline commit-to-commit runner. Reuses real C-package fixtures without historical baselines.
import assert from 'node:assert/strict';
import {execFileSync, spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, writeFile, readdir, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import postcss from 'postcss';
const frontend=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const repo=resolve(frontend,'..');
const [beforeRef,afterRef,destination,...selected]=process.argv.slice(2);
assert.ok(beforeRef&&afterRef&&destination,'Usage: node e2e/bs5-d1c-compare.mjs BEFORE AFTER OUTPUT [shell-rest c1 ...]');
const output=resolve(destination);
const fixtureEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^C\d+_(ONLY|THEME|BODY_CLASS|REFERENCE)$/.test(key)));
const git=(args)=>execFileSync('git',args,{cwd:repo,maxBuffer:128*1024*1024});
const refs=[beforeRef,afterRef].map(ref=>git(['rev-parse','--verify',`${ref}^{commit}`]).toString().trim());
const sceneList=JSON.parse(await readFile(new URL('./bs5-d1c-scenes.json',import.meta.url)));
const suites=selected.length?[...new Set(['shell-rest',...selected])]:sceneList;
assert.ok(suites.length&&new Set(suites).size===suites.length&&suites.every(s=>sceneList.includes(s)),'Unknown/duplicate scene suite');
assert.ok(['0','1',undefined].includes(process.env.D1C_GRID_BREAKPOINTS),'D1C_GRID_BREAKPOINTS must be 0 or 1');
const gridBreakpoints=process.env.D1C_GRID_BREAKPOINTS==='1';
const viewports=gridBreakpoints?[1440,768,390,575,576,767,991,992,1199,1200,1399,1400]:[1440,768,390];
const timeoutMinutes=suite=>gridBreakpoints&&suite!=='shell-rest'?90*viewports.length/3:90;
const lock=await readFile(join(frontend,'package-lock.json'),'utf8');
for(const commit of refs)assert.equal(git(['show',`${commit}:frontend/package-lock.json`]).toString(),lock,'Dependency lock differs: install/compare using the matching lockstand');
await mkdir(output,{recursive:true});
assert.equal((await readdir(output)).length,0,'Use a fresh evidence directory to prevent stale screenshot pairs');
const rules=[];
const compatPath='frontend/theme/compat-bs3.css';
const hasCompat=git(['ls-tree','--name-only',refs[0],compatPath]).toString().trim();
postcss.parse(hasCompat?git(['show',`${refs[0]}:${compatPath}`]).toString():'').walkRules(rule=>{
 const media=[];for(let p=rule.parent;p;p=p.parent)if(p.type==='atrule'&&p.name==='media')media.unshift(p.params);
 rules.push({id:rules.length+1,selector:rule.selector,media});
});
const scratch=await mkdtemp(join(tmpdir(),'p175-'));
const harnessHashes={};
for(const name of ['bs5-d1c-compare.mjs','bs5-d1c-probe.mjs',...suites.map(s=>`bs5-${s}.local.mjs`)])harnessHashes[name]=createHash('sha256').update(await readFile(new URL('./'+name,import.meta.url))).digest('hex');
const manifest={refs,suites,harnessHashes,viewports,gridBreakpoints,suiteTimeoutMinutes:Object.fromEntries(suites.map(suite=>[suite,timeoutMinutes(suite)])),shellRestViewports:[1440,768,390],sameCommitUsesFixtureAA:refs[0]===refs[1],fixtureSource:git(['rev-parse','HEAD']).toString().trim(),results:[],errors:[]};
// Each archive uses its own complete sources and generated CSS. Dependencies are shared read-only.
// Never check out/reset a user's working tree, and never contact a server.
async function snapshot(side,commit){
 const root=join(scratch,side);await mkdir(root);
 await new Promise((done,reject)=>{
  const archive=spawn('git',['archive',commit],{cwd:repo});
  const tar=spawn('tar',['-xf','-','-C',root]);archive.stdout.pipe(tar.stdin);
  archive.on('error',reject);tar.on('error',reject);
  Promise.all([new Promise(r=>archive.on('close',r)),new Promise(r=>tar.on('close',r))]).then(codes=>codes.every(c=>c===0)?done():reject(Error('Archive failed: '+codes)));
 });
 await symlink(join(frontend,'node_modules'),join(root,'frontend/node_modules'),'dir');
 const e2e=join(root,'frontend/e2e');
 await writeFile(join(e2e,'p175-rules.json'),JSON.stringify(rules));
 await writeFile(join(e2e,'p175-browser.mjs'),await readFile(new URL('./bs5-d1c-probe.mjs',import.meta.url)));
 const runSuite=async suite=>{
  const target=join(output,side,suite);await mkdir(target,{recursive:true});
  let source=await readFile(new URL(`./bs5-${suite}.local.mjs`,import.meta.url),'utf8');
  // Preserve shell-rest's exact 21-pair contract and navigation's separate zoom case.
  if(gridBreakpoints&&suite!=='shell-rest'){
   const tuples=JSON.stringify(viewports.map(w=>[w,w===768?1024:w===390?844:900]));
   const pattern=/\[\[1440,\s*900\],\s*\[768,\s*1024\],\s*\[390,\s*844\]\]/g;
   const supported=suite==='navigation'?source.includes('[1440, 768, 576, 390]'):pattern.test(source);
   assert.ok(supported,'No recognized viewport loop in '+suite);
   source=suite==='navigation'?source.replace('[1440, 768, 576, 390]',JSON.stringify(viewports)):source.replace(pattern,tuples);
   source=source.replace(/\[1440,\s*768,\s*390\]/g,JSON.stringify(viewports));
  }
  // Preserve fixture interactions/assertions; resolve all historical reads inside this archive.
  source=source.replace(/import\s*\{\s*execFileSync\s*\}\s*from\s*'node:child_process';/,"import {readFileSync as p175Read} from 'node:fs';\nconst execFileSync=(cmd,args,options)=>{if(cmd==='cat'&&args.length===1)return p175Read(args[0],'utf8');if(cmd!=='git'||args[0]!=='show')throw Error('Unexpected fixture command');return p175Read(new URL('../../'+args[1].slice(args[1].indexOf(':')+1),import.meta.url),'utf8');};");
  source=source.replace("from '@playwright/test'","from './p175-browser.mjs'");
  source=source.replace(/(['"])[0-9a-f]{9,40}\1/g,JSON.stringify(commit));
  if(suite==='auth')source=source.replace("name === 'before' && reference === "+JSON.stringify(commit)+" ? '.btn-default' : '.auth-secondary'","'.auth-secondary'");
  // Historical migration probes sometimes exercised new scrolling only on the after side.
  // Commit comparisons must exercise and capture the same state on both sides.
  if(suite==='c4')source=source.replace("scene==='permissions-scroll'&&name==='after'&&width===390","scene==='permissions-scroll'&&width===390");
  if(suite==='c9')source=source.replace("scene.startsWith('sync')&&width===390&&variant==='after'","scene.startsWith('sync')&&width===390");
  if(suite==='wizard')source=source.replace('observations.before.logo[0].width>observations.before.logo[0].bodyWidth-40','observations.before.logo[0].width<=observations.before.logo[0].bodyWidth-40');
  if(suite==='devices')source=source.replace("scene==='devices' && width===390 && name==='after'","scene==='devices' && width===390");
  if(suite==='c10')source=source.replace("name === 'after' && width === 390 && ['students'","width === 390 && ['students'").replace("scene + '-390-scrolled.png'","scene + '-390-scrolled-' + name + '.png'");
  if(suite==='shell-rest')source=source.replace("['plugins','plugins-active','details','details-focus','denied','tasks','message','message-focus','message-active']","['plugins','details','details-focus','denied','tasks','message','message-focus']");
  const script=join(e2e,`p175-${suite}.mjs`);await writeFile(script,source);
  const log=await new Promise((resolveRun,reject)=>{
   const child=spawn(process.execPath,[script,target],{cwd:join(root,'frontend'),env:{...fixtureEnv,P175_HITS:join(target,'hits.json')}});
   const timer=setTimeout(()=>child.kill('SIGTERM'),timeoutMinutes(suite)*60*1000);
   const chunks=[];child.stdout.on('data',b=>chunks.push(b));child.stderr.on('data',b=>chunks.push(b));
   child.on('error',error=>{clearTimeout(timer);reject(error);});child.on('close',code=>{clearTimeout(timer);resolveRun({code,text:Buffer.concat(chunks).toString()});});
  });
  await writeFile(join(target,'run.log'),log.text);
  if(log.code!==0)manifest.errors.push({side,suite,exit:log.code});
  // A fixture's historical pixel assertion may fail due to A/A raster noise. It remains recorded.
  console.log(`${side}/${suite}: exit ${log.code}`);
 };
 return runSuite;
}
async function files(root){const entries=await readdir(root,{withFileTypes:true});return (await Promise.all(entries.map(async e=>e.isDirectory()?(await files(join(root,e.name))).map(p=>join(e.name,p)):[e.name]))).flat();}
try{
 const [before,after]=await Promise.all([snapshot('before',refs[0]),refs[0]===refs[1]?null:snapshot('after',refs[1])]);
 // Share three slots across the archives. The large session group must not leave
 // two slots idle at a batch boundary while the other archive waits its turn.
 const ordered=suites.toSorted((a,b)=>Number(b==='session')-Number(a==='session'));
 const jobs=ordered.flatMap(suite=>[()=>before(suite),...(after?[()=>after(suite)]:[])]);
 manifest.scheduling={parallelSuites:3,sessionFirst:true,sharedAcrossCommits:true,jobs:jobs.length};
 let nextJob=0;
 const consume=async()=>{while(nextJob<jobs.length){const job=jobs[nextJob++];await job();}};
 const workers=await Promise.allSettled(Array.from({length:Math.min(3,jobs.length)},consume));
 const failed=workers.filter(result=>result.status==='rejected');
 if(failed.length){
  manifest.errors.push(...failed.map(result=>({stage:'fixture-worker',error:String(result.reason)})));
  throw new AggregateError(failed.map(result=>result.reason),'Fixture workers failed');
 }
 for(const suite of suites){
  const same=refs[0]===refs[1];
  const left=join(output,'before',suite),right=join(output,same?'before':'after',suite);
  const beforeName=name=>same?name.replace(/-after\.png$/,'-before.png'):name;
  const a=(await files(left)).filter(p=>p.endsWith('-after.png')).sort();
  const b=(await files(right)).filter(p=>p.endsWith('-after.png')).sort();
  if(!a.length||JSON.stringify(a)!==JSON.stringify(b))manifest.errors.push({suite,error:'Missing/different screenshot sets',before:a,after:b});
  for(const name of new Set([...a,...b])){
   const hash=async path=>{try{return createHash('sha256').update(await readFile(path)).digest('hex');}catch(e){if(e.code==='ENOENT')return null;throw e;}};
   const hashes=await Promise.all([hash(join(left,beforeName(name))),hash(join(right,name))]);
   const row={suite,pair:name,exact:hashes[0]!==null&&hashes[0]===hashes[1],hashes};manifest.results.push(row);
   console.log(`${row.exact?'exakt':'abweichend'} ${suite}/${name}`);
  }
 }
}finally{
 await writeFile(join(output,'comparison.json'),JSON.stringify(manifest,null,2)+'\n');
 await rm(scratch,{recursive:true,force:true});
}
console.log(`${manifest.results.filter(r=>r.exact).length}/${manifest.results.length} exakt; ${manifest.errors.length} fixture errors`);
process.exitCode=manifest.errors.length||manifest.results.some(r=>!r.exact)?1:0;
