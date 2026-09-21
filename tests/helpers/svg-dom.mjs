/** Minimal software SVG DOM for renderer contract tests and reproducible frame evidence.
 * This is not a browser: no CSS layout, event dispatch, GPU, or device-performance claims. */
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const decode=value=>value.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
export class SvgNode {
 constructor(tag='g',attrs={},document){this.tagName=tag;this.attrs={...attrs};this.children=[];this.parentNode=null;this.ownerDocument=document;this.writes=0;this.text='';this.clientWidth=0;}
 get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,value}));}
 getAttribute(key){return this.attrs[key]??null;}
 setAttribute(key,value){this.attrs[key]=String(value);this.writes++;}
 removeAttribute(key){delete this.attrs[key];this.writes++;}
 appendChild(child){child.remove();child.parentNode=this;this.children.push(child);return child;}
 insertBefore(child,reference){child.remove();child.parentNode=this;const index=this.children.indexOf(reference);if(index<0)this.children.push(child);else this.children.splice(index,0,child);return child;}
 remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}}
 cloneNode(deep){const node=new SvgNode(this.tagName,this.attrs,this.ownerDocument);node.text=this.text;if(deep)for(const child of this.children)node.appendChild(child.cloneNode(true));return node;}
 matches(selector){if(selector==='*')return true;if(selector.startsWith('.'))return (this.getAttribute('class')??'').split(/\s+/).includes(selector.slice(1));if(selector.startsWith('#'))return this.getAttribute('id')===selector.slice(1);const attr=selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);if(attr)return attr[2]===undefined?this.getAttribute(attr[1])!==null:this.getAttribute(attr[1])===attr[2];return this.tagName===selector;}
 querySelectorAll(selector){return this.children.flatMap(n=>[...(n.matches(selector)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
 serialize(){return `<${this.tagName}${Object.entries(this.attrs).map(([k,v])=>` ${k}="${escape(v)}"`).join('')}>${this.text}${this.children.map(n=>n.serialize()).join('')}</${this.tagName}>`;}
}
export function svgDom(markup){
 const doc={created:0,createElementNS(_ns,tag){this.created++;return new SvgNode(tag,{},this);}};
 const root=new SvgNode('div',{'data-zoom':'1'},doc),stack=[root];
 for(const token of markup.match(/<[^>]+>|[^<]+/g)??[]){
  if(token.startsWith('</')){stack.pop();continue;}
  if(token.startsWith('<')){
   const tag=token.match(/^<([\w-]+)/)?.[1];if(!tag)continue;
   const attrs=Object.fromEntries([...token.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([,key,value])=>[key,decode(value)]));
   const node=new SvgNode(tag,attrs,doc);stack.at(-1).appendChild(node);if(!token.endsWith('/>'))stack.push(node);
  }else stack.at(-1).text+=token;
 }
 return root;
}
