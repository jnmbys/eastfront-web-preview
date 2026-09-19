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
