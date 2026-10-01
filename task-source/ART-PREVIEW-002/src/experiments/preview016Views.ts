import {hexToPixel,type Point} from '../geometry/hex.js';
import {label,type SliceData} from './mapData.js';
import {viewBoxForHexes} from '../render/coreSvg.js';
import type {MapViewport} from '../web/preview.js';

export const previewViews:Record<string,{cell:string|null;zoom:number}>={
 full:{cell:null,zoom:1},north:{cell:'W2',zoom:3},central:{cell:'R10',zoom:3},
 south:{cell:'W16',zoom:3},x14:{cell:'X14',zoom:5},ac10:{cell:'AC10',zoom:5}
};
/** Camera-only presets. Uses the same center/fit calculation as the existing X14 control. */
export function previewViewport(data:SliceData,worldWidth:number,key:string):MapViewport{
 const preset=previewViews[key]??previewViews.full!;
 if(!preset.cell)return {zoom:1,panX:0,panY:0};
 const hex=data.hexes.find(h=>label(h.coord)===preset.cell)!;
 const p:Point=hexToPixel(hex.coord),box=viewBoxForHexes(data.hexes,8),scale=worldWidth/box.width;
 return {zoom:preset.zoom,panX:-(p.x-box.minX-box.width/2)*scale*preset.zoom,panY:-(p.y-box.minY-box.height/2)*scale*preset.zoom};
}
