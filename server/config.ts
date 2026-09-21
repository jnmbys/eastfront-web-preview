export const DEFAULTS = Object.freeze({
  port:8787,host:'127.0.0.1',allowedOrigins:['http://localhost:4173','http://127.0.0.1:4173'],
  reconnectGraceMs:60_000,emptyRoomTimeoutMs:120_000,roomTimeoutMs:7_200_000,
  heartbeatMs:15_000,handshakeTimeoutMs:10_000,sweepMs:1_000,
  maxRooms:200,maxConnections:500,maxMessageBytes:32768,maxBufferedBytes:1_048_576,
  messagesPerWindow:200,rateWindowMs:10_000,
});
export type ServerConfig = {-readonly [K in keyof typeof DEFAULTS]:typeof DEFAULTS[K] extends number?number:typeof DEFAULTS[K] extends string?string:string[]};
export function configFromEnv(env:NodeJS.ProcessEnv=process.env):ServerConfig {
  const config:ServerConfig={...DEFAULTS,allowedOrigins:[...DEFAULTS.allowedOrigins]};
  const number=(key:string,fallback:number,min=1)=>{if(!env[key])return fallback;const n=Number(env[key]);if(!Number.isSafeInteger(n)||n<min)throw new Error(`Invalid ${key}`);return n;};
  config.port=number('PORT',config.port,0);if(config.port>65535)throw new Error('Invalid PORT');
  config.host=env.HOST||config.host;
  config.reconnectGraceMs=number('RECONNECT_GRACE_MS',config.reconnectGraceMs);
  config.emptyRoomTimeoutMs=number('EMPTY_ROOM_TIMEOUT_MS',config.emptyRoomTimeoutMs);
  config.roomTimeoutMs=number('ROOM_TIMEOUT_MS',config.roomTimeoutMs);
  if(env.ALLOWED_ORIGINS)config.allowedOrigins=env.ALLOWED_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean);
  for(const origin of config.allowedOrigins){const url=new URL(origin);if(!['http:','https:'].includes(url.protocol)||url.origin!==origin)throw new Error('ALLOWED_ORIGINS requires exact HTTP origins');}
  return config;
}
