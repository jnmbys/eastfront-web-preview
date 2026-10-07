import type {BrowserRenderModel} from './coreModel.js';

/** Long-lived terrain input deliberately excludes viewers, units, control and facilities. */
export function staticGrandGeometry(model:BrowserRenderModel):BrowserRenderModel {
 return {hexes:model.hexes.map(({coord,terrain})=>({coord:{...coord},terrain})),
  edges:model.edges.map(({key,a,b,road,railway,river,bridge})=>({key,a:{...a},b:{...b},road,railway,river,bridge}))} as BrowserRenderModel;
}
