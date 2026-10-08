import {cfg,products} from './config.mjs';
// National stock excludes equipment already delivered to formations, but includes
// reusable vehicles assigned to transport. Occupation is not vehicle consumption.
export function occupiedVehicles(e,side,tick){const net=e.net[side],cargo=e.cargoHour?.hour===Math.floor(tick/cfg.networkTicks)?e.cargoHour.sides[side]:null;return {TRAIN:Math.ceil((net.trainUsed+(cargo?.train??0))/cfg.trainWork),TRUCK:net.trucksUsed};}
export function demands(e,side,view,gear,tick){const stock=e.nations[side].stock,net=e.net[side],occupied=occupiedVehicles(e,side,tick),formation={};
 for(const u of view.units.filter(u=>u.side===side&&u.alive!==false))for(const[k,required]of Object.entries(e.establishment[u.id]??{}))formation[k]=(formation[k]??0)+Math.max(0,required-(gear.units[u.id]?.held[k]??0));
 return Object.fromEntries(Object.keys(products).map(k=>{const committed=occupied[k]??0,transport=Math.max(committed,k==='TRAIN'?net.trainNeed:k==='TRUCK'?net.truckNeed:0),refill=formation[k]??0,gross=transport+refill;return [k,{transport,formation:refill,gross,stock:stock[k],committed,free:Math.max(0,stock[k]-committed),net:Math.max(0,gross-stock[k])}];}));
}
