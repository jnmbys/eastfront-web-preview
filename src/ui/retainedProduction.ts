/** Retain production controls through authorized pushes. The caller rebinds
 * onclick/onchange (not additive listeners). No optimistic accounting. */
export function patchProduction(parent:Element,next:Element):void{
 const key=(n:Node,i:number)=>n instanceof Element?(n.id?'id:'+n.id:n.getAttribute('data-line-key')?'line:'+n.getAttribute('data-line-key'):
  n.tagName+':'+Array.from(n.attributes).filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value).join('|')+':'+i):'text:'+i;
 const old=new Map(Array.from(parent.childNodes).map((n,i)=>[key(n,i),n]));let cursor=parent.firstChild;
 for(const [i,wanted]of Array.from(next.childNodes).entries()){
  const k=key(wanted,i),prior=old.get(k);let node=prior??wanted;
  if(prior&&prior.nodeType!==wanted.nodeType)node=wanted;
  else if(prior instanceof Element&&wanted instanceof Element){
   const focused=prior===prior.ownerDocument.activeElement;
   for(const a of Array.from(prior.attributes))if(!wanted.hasAttribute(a.name)&&a.name!=='open')prior.removeAttribute(a.name);
   for(const a of Array.from(wanted.attributes))if(a.name!=='open'&&prior.getAttribute(a.name)!==a.value)prior.setAttribute(a.name,a.value);
   if(!focused)patchProduction(prior,wanted);
  }else if(prior&&prior.nodeValue!==wanted.nodeValue)prior.nodeValue=wanted.nodeValue;
  if(node!==cursor)parent.insertBefore(node,cursor);cursor=node.nextSibling;old.delete(k);
 }
 for(const n of old.values())n.remove();
}
