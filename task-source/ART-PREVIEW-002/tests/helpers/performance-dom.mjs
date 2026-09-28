// Software DOM adapter for production incremental updater. Not a browser/layout emulator.
import {SvgNode,svgDom} from './svg-dom.mjs';
Object.defineProperties(SvgNode.prototype,{
 innerHTML:{get(){return this.children.map(n=>n.serialize()).join('');},set(html){for(const child of [...this.children])child.remove();const parsed=svgDom(html);const own=n=>{n.ownerDocument=this.ownerDocument;this.ownerDocument.created++;for(const c of n.children)own(c);};for(const child of [...parsed.children]){own(child);this.appendChild(child);}this.writes++;}},
 firstElementChild:{get(){return this.children[0]??null;}},
 textContent:{get(){return this.text+this.children.map(n=>n.textContent).join('');},set(text){this.text=text;for(const c of [...this.children])c.remove();this.writes++;}}
});
SvgNode.prototype.replaceChildren=function(...children){for(const c of [...this.children])c.remove();for(const c of children)this.appendChild(c);this.writes++;};
SvgNode.prototype.addEventListener=function(){};SvgNode.prototype.removeEventListener=function(){};
export {SvgNode,svgDom};
