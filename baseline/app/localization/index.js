import { enUS } from './en-US.js';
import { zhCN } from './zh-CN.js';
import { enumKeys } from './enumKeys.js';
export const catalogs = { 'zh-CN': zhCN, 'en-US': enUS };
const preferenceKey = 'eastfront.language';
const missingKeys = new Set();
let locale = 'zh-CN';
try {
    const saved = globalThis.localStorage?.getItem(preferenceKey);
    if (saved === 'en-US' || saved === 'zh-CN')
        locale = saved;
}
catch { /* Storage can be unavailable in private browsing. */ }
export const getLocale = () => locale;
export const getMissingKeys = () => [...missingKeys];
export function clearMissingKeys() { missingKeys.clear(); }
export function resolveTranslation(key, selected = locale, dictionaries = catalogs) {
    const local = dictionaries[selected][key], fallback = dictionaries['en-US'][key];
    if (!local)
        missingKeys.add(`${selected}:${key}`);
    if (!fallback)
        missingKeys.add(`en-US:${key}`);
    return local || fallback || `[${key}]`;
}
export function t(key, params = {}) {
    return resolveTranslation(key).replace(/\{(\w+)\}/g, (placeholder, name) => {
        if (params[name] === undefined) {
            missingKeys.add(`parameter:${key}:${name}`);
            return placeholder;
        }
        return formatMessage(params[name]);
    });
}
export function msg(key, params) { return params ? { key, params } : { key }; }
export function formatMessage(message) {
    if (typeof message !== 'object')
        return String(message);
    if ('parts' in message)
        return message.parts.map(formatMessage).join(message.separator);
    if (locale === 'en-US' && message.english !== undefined)
        return message.english;
    return t(message.key, message.params);
}
export function enumMessage(value) {
    const key = enumKeys[value];
    return key ? msg(key) : value;
}
export const enumLabel = (value) => formatMessage(enumMessage(value));
export function phaseMessage(value, includeSide = true) {
    const match = /^(GERMAN|SOVIET)_(.+)$/.exec(value);
    return match ? includeSide ? msg('phase.side', { side: enumMessage(match[1]), phase: enumMessage(match[2]) }) : enumMessage(match[2]) : enumMessage(value);
}
export const phaseName = (value, includeSide = true) => formatMessage(phaseMessage(value, includeSide));
function updateDocument() {
    if (typeof document === 'undefined')
        return;
    document.documentElement.lang = locale;
    document.title = t('game.webPreview');
}
export function setLocale(next) {
    if (next !== 'zh-CN' && next !== 'en-US')
        return;
    locale = next;
    try {
        globalThis.localStorage?.setItem(preferenceKey, next);
    }
    catch { /* Session switching still works. */ }
    updateDocument();
}
updateDocument();
