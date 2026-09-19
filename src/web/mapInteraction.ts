import type { MapViewport } from './preview.js';

export const MAP_DRAG_THRESHOLD_PX = 6;

export interface MapContentMetrics {
  viewportWidth:number;
  viewportHeight:number;
  contentWidth:number;
  contentHeight:number;
}

export interface MapPanBounds {
  scaledWidth:number;
  scaledHeight:number;
  maxX:number;
  maxY:number;
}

export interface MapGestureState {
  pointerId:number;
  startX:number;
  startY:number;
  startPanX:number;
  startPanY:number;
  dragging:boolean;
}

export function mapPanBounds(metrics:MapContentMetrics,zoom:number):MapPanBounds {
  const scaledWidth=Math.max(0,metrics.contentWidth)*zoom,scaledHeight=Math.max(0,metrics.contentHeight)*zoom;
  return {
    scaledWidth,
    scaledHeight,
    maxX:Math.max(0,(scaledWidth-Math.max(0,metrics.viewportWidth))/2),
    maxY:Math.max(0,(scaledHeight-Math.max(0,metrics.viewportHeight))/2),
  };
}

export function clampMapViewport(view:MapViewport,metrics:MapContentMetrics):MapViewport {
  const bounds=mapPanBounds(metrics,view.zoom);
  const panX=bounds.maxX===0?0:Math.max(-bounds.maxX,Math.min(bounds.maxX,view.panX));
  const panY=bounds.maxY===0?0:Math.max(-bounds.maxY,Math.min(bounds.maxY,view.panY));
  return {...view,panX,panY};
}

export function exceedsMapDragThreshold(dx:number,dy:number,threshold=MAP_DRAG_THRESHOLD_PX):boolean {
  return Math.hypot(dx,dy)>threshold;
}

export function beginMapGesture(pointerId:number,x:number,y:number,view:MapViewport):MapGestureState {
  return {pointerId,startX:x,startY:y,startPanX:view.panX,startPanY:view.panY,dragging:false};
}

export function updateMapGesture(gesture:MapGestureState,x:number,y:number,threshold=MAP_DRAG_THRESHOLD_PX):MapGestureState {
  if(gesture.dragging)return gesture;
  const dx=x-gesture.startX,dy=y-gesture.startY;
  return exceedsMapDragThreshold(dx,dy,threshold)?{...gesture,dragging:true}:gesture;
}

export function gesturePanViewport(gesture:MapGestureState,x:number,y:number,zoom:number):MapViewport {
  return {zoom,panX:gesture.startPanX+(x-gesture.startX),panY:gesture.startPanY+(y-gesture.startY)};
}

export function dragSuppressesTap(gesture:MapGestureState,cancelled=false):boolean {
  return gesture.dragging&&!cancelled;
}
