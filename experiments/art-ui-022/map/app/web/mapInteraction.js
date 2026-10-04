export const MAP_DRAG_THRESHOLD_PX = 6;
export function mapPanBounds(metrics, zoom) {
    const scaledWidth = Math.max(0, metrics.contentWidth) * zoom, scaledHeight = Math.max(0, metrics.contentHeight) * zoom;
    return {
        scaledWidth,
        scaledHeight,
        maxX: Math.max(0, (scaledWidth - Math.max(0, metrics.viewportWidth)) / 2),
        maxY: Math.max(0, (scaledHeight - Math.max(0, metrics.viewportHeight)) / 2),
    };
}
export function clampMapViewport(view, metrics) {
    const bounds = mapPanBounds(metrics, view.zoom);
    const panX = bounds.maxX === 0 ? 0 : Math.max(-bounds.maxX, Math.min(bounds.maxX, view.panX));
    const panY = bounds.maxY === 0 ? 0 : Math.max(-bounds.maxY, Math.min(bounds.maxY, view.panY));
    return { ...view, panX, panY };
}
export function exceedsMapDragThreshold(dx, dy, threshold = MAP_DRAG_THRESHOLD_PX) {
    return Math.hypot(dx, dy) > threshold;
}
export function beginMapGesture(pointerId, x, y, view) {
    return { pointerId, startX: x, startY: y, startPanX: view.panX, startPanY: view.panY, dragging: false };
}
export function updateMapGesture(gesture, x, y, threshold = MAP_DRAG_THRESHOLD_PX) {
    if (gesture.dragging)
        return gesture;
    const dx = x - gesture.startX, dy = y - gesture.startY;
    return exceedsMapDragThreshold(dx, dy, threshold) ? { ...gesture, dragging: true } : gesture;
}
export function gesturePanViewport(gesture, x, y, zoom) {
    return { zoom, panX: gesture.startPanX + (x - gesture.startX), panY: gesture.startPanY + (y - gesture.startY) };
}
export function dragSuppressesTap(gesture, cancelled = false) {
    return gesture.dragging && !cancelled;
}
/** Preserve the world point beneath the pointer; only FIT recentres the map. */
export function zoomMapAt(view, requestedZoom, focus) {
    const zoom = Math.max(1, Math.min(2.5, requestedZoom));
    const ratio = zoom / view.zoom;
    return { zoom, panX: focus.x - (focus.x - view.panX) * ratio, panY: focus.y - (focus.y - view.panY) * ratio };
}
export function pinchMapViewport(view, startA, startB, a, b) {
    const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    const from = mid(startA, startB), to = mid(a, b);
    const initialDistance = Math.hypot(startA.x - startB.x, startA.y - startB.y);
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const next = zoomMapAt(view, view.zoom * (initialDistance > 0 ? distance / initialDistance : 1), from);
    return { ...next, panX: next.panX + to.x - from.x, panY: next.panY + to.y - from.y };
}
