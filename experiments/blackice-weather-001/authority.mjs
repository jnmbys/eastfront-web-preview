import {Campaign as Province} from '../hoi4-map-province-001/province-authority.mjs';
import {canonicalEdgeKey} from '../../vendor/eastfront-digital-core/dist/index.js';
import {refreshNetwork} from '../grand-economy-002/economy.mjs';
import {VERSION,createWeather,advanceWeather,conditions,groundFactor,publicWeather} from './weather.mjs';
export class Campaign extends Province{
 static newCampaignClass=Campaign;static rulesVersion=VERSION;
 constructor(){super();this.clock.weather=createWeather(this.state.hexes,this.clock.rng,this.clock.tick);refreshNetwork(this);}
 advance(){advanceWeather(this.clock.weather,this.clock.tick+1);return super.advance();}
 groundMarchRate(id,march){const u=this.state.units[id],e=this.state.edges[canonicalEdgeKey(u.hex,march.to)];return 1/groundFactor(this.clock.weather,march.to,!!e?.road);}
 snapshot(draft){const d=super.snapshot(draft);if(!this.clock.weather)return d;d.weather=publicWeather(this.clock.weather);
  // Internal cached paths need not be retransmitted; own shipment ETA remains visible.
  for(const h of d.modern.network.hubs)delete h.deliveryPaths;
  for(const p of d.provinces?.items??[])p.weather={...conditions(this.clock.weather,p.capital),roadFactor:groundFactor(this.clock.weather,p.capital,true),offroadFactor:groundFactor(this.clock.weather,p.capital)};
  for(const [id,u]of Object.entries(d.continuous.units)){u.weather={...conditions(this.clock.weather,this.state.units[id].hex),roadFactor:groundFactor(this.clock.weather,this.state.units[id].hex,true),offroadFactor:groundFactor(this.clock.weather,this.state.units[id].hex)};const v=this.clock.units[id];if(v.refillStatus&&u.refillStatus&&this.clock.divisionLedger.balance.transit?.some(x=>x.unit===id&&x.weatherWork))u.refillStatus.reason='已扣库发运；按当前天气推进装卸、铁路与末端行程，雨停不立即干燥';}
  for(const a of d.continuous.map.actions??[]){const m=this.clock.units[a.unit]?.march??this.clock.tactical?.withdrawals?.[a.unit];if(m&&a.segment){a.segment.remainingMinutes=m.remaining*5/this.groundMarchRate(a.unit,m);a.reason+='；到达估计随路况变化';}}
  const warnings=d.divisions?.integrated?.balance?.warnings;if(warnings)warnings[1]='动态降雨与泥泞已启用；未模拟冬季、历史国家学说、完整科技与马匹制服生产';return d;
 }
 restore(s,pause=true){if(s.clock?.weather?.version!==VERSION)throw Error('WEATHER_NEW_CAMPAIGN_REQUIRED');return super.restore(s,pause);}
}
