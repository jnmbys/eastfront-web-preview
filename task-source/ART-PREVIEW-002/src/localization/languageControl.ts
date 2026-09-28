import { getLocale, setLocale, t, type Locale } from './index.js';
export function languageControl():string {
  return `<select class="language-select" data-language-select aria-label="${t('language.label')}"><option value="zh-CN" lang="zh-CN" ${getLocale()==='zh-CN'?'selected':''}>简体中文</option><option value="en-US" lang="en-US" ${getLocale()==='en-US'?'selected':''}>English</option></select>`;
}
/** Repaint text only. No game session, seed, terrain or camera references are owned here. */
export function bindLanguageControl(root:HTMLElement,repaint:()=>void):void {
  root.querySelectorAll<HTMLSelectElement>('[data-language-select]').forEach(control=>control.addEventListener('change',()=>{
    const next=control.value;
    if(next!=='zh-CN'&&next!=='en-US')return;
    const selectors=['.command-panel-scroll','.roster-list','.location-grid','.battle-history'];
    const scrolls=selectors.map(selector=>({selector,top:root.querySelector(selector)?.scrollTop??0}));
    const details=Array.from(root.querySelectorAll('details')).map(detail=>detail.open);
    setLocale(next as Locale);
    repaint();
    root.querySelectorAll('details').forEach((detail,index)=>{detail.open=details[index]??false;});
    for(const {selector,top} of scrolls){const element=root.querySelector(selector);if(element)element.scrollTop=top;}
    root.querySelector<HTMLSelectElement>('[data-language-select]')?.focus({preventScroll:true});
  }));
}
