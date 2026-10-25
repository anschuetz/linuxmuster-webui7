import {baseParse,parserOptions} from '@vue/compiler-dom';
import {createHash} from 'node:crypto';
export function templateElements(node){return [...(node.type===1?[node]:[]),...(node.children||[]).flatMap(templateElements)];}
export function controlContractHash(template){
 const contracts=templateElements(baseParse(template,parserOptions)).flatMap(node=>{
  const props=node.props.flatMap(p=>{
   if(p.type===6)return ['class','style'].includes(p.name)?[]:[{attribute:p.name,value:p.value?.content??true}];
   if(p.type===7){if(p.name==='bind'&&['class','style'].includes(p.arg?.content))return [];
    return [{directive:p.name,arg:p.arg?.content,expression:p.exp?.content,modifiers:p.modifiers.map(m=>typeof m==='string'?m:m.content)}];}
   return [];
  });
  return props.length?[{tag:node.tag,props}]:[];
 });
 return createHash('sha256').update(JSON.stringify(contracts)).digest('hex');
}
