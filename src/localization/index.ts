import { enUS } from './en-US.js';
import { zhCN } from './zh-CN.js';
import { enumKeys } from './enumKeys.js';
export type Locale = 'zh-CN' | 'en-US';
export type MessageKey = keyof typeof enUS;
export type Message = string | number | {key:MessageKey;params?:MessageParams;english?:string} | {parts:Message[];separator:string};
export type MessageParams = Readonly<Record<string,Message>>;
export const catalogs:Record<Locale,Readonly<Partial<Record<MessageKey,string>>>>={'zh-CN':zhCN,'en-US':enUS};
const preferenceKey='eastfront.language';
const missingKeys=new Set<string>();
let locale:Locale='zh-CN';
try { const saved=globalThis.localStorage?.getItem(preferenceKey);if(saved==='en-US'||saved==='zh-CN')locale=saved; } catch { /* Storage can be unavailable in private browsing. */ }
export const getLocale=():Locale=>locale;
export const getMissingKeys=():readonly string[]=>[...missingKeys];
export function clearMissingKeys():void { missingKeys.clear(); }
export function resolveTranslation(key:string,selected:Locale=locale,dictionaries:Record<Locale,Readonly<Record<string,string|undefined>>>=catalogs):string {
  const local=dictionaries[selected][key],fallback=dictionaries['en-US'][key];
  if(!local)missingKeys.add(`${selected}:${key}`);
  if(!fallback)missingKeys.add(`en-US:${key}`);
  return local||fallback||`[${key}]`;
}
export function t(key:MessageKey,params:MessageParams={}):string {
  return resolveTranslation(key).replace(/\{(\w+)\}/g,(placeholder:string,name:string)=>{
    if(params[name]===undefined){missingKeys.add(`parameter:${key}:${name}`);return placeholder;}
    return formatMessage(params[name]);
  });
}
export function msg(key:MessageKey,params?:MessageParams):Message {return params?{key,params}:{key};}
export function formatMessage(message:Message):string {
  if(typeof message!=='object')return String(message);
  if('parts'in message)return message.parts.map(formatMessage).join(message.separator);
  if(locale==='en-US'&&message.english!==undefined)return message.english;
  return t(message.key,message.params);
}
export function enumMessage(value:string):Message {
  const key:MessageKey|undefined=(enumKeys as Readonly<Record<string,MessageKey>>)[value];
  return key?msg(key):value;
}
export const enumLabel=(value:string):string=>formatMessage(enumMessage(value));
export function phaseMessage(value:string,includeSide=true):Message {
  const match=/^(GERMAN|SOVIET)_(.+)$/.exec(value);
  return match?includeSide?msg('phase.side',{side:enumMessage(match[1]!),phase:enumMessage(match[2]!)}):enumMessage(match[2]!):enumMessage(value);
}
export const phaseName=(value:string,includeSide=true):string=>formatMessage(phaseMessage(value,includeSide));
function updateDocument():void {
  if(typeof document==='undefined')return;
  document.documentElement.lang=locale;
  document.title=t('game.webPreview');
}
export function setLocale(next:Locale):void {
  if(next!=='zh-CN'&&next!=='en-US')return;
  locale=next;
  try {globalThis.localStorage?.setItem(preferenceKey,next);} catch { /* Session switching still works. */ }
  updateDocument();
}
updateDocument();
