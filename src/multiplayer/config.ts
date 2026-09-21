export const CLIENT_NETWORK=Object.freeze({initialRetryMs:750,maxRetryMs:5000,requestTimeoutMs:10000});
/** Static hosting runtime config; never default a public client to localhost. */
export async function loadMultiplayerUrl():Promise<string> {
  const response=await fetch('./multiplayer-config.json',{cache:'no-store'});
  if(!response.ok)return '';
  const config:unknown=await response.json();
  if(!config||typeof config!=='object'||!('serverUrl' in config)||typeof config.serverUrl!=='string')return '';
  if(!config.serverUrl)return '';
  const url=new URL(config.serverUrl);
  if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password||url.hash||url.search||
    (location.protocol==='https:'&&url.protocol!=='wss:'))throw new Error('invalidUrl');
  return url.href;
}
