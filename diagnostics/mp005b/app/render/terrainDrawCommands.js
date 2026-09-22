/** A bounded command buffer for deterministic decorative paths. Calculation may
 * yield, but replay keeps the baseline Canvas transaction/antialias order intact. */
const methods = new Set(['save', 'restore', 'translate', 'rotate', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'ellipse', 'fill', 'closePath']);
const properties = new Set(['globalAlpha', 'fillStyle', 'strokeStyle', 'lineWidth']);
export function recordTerrainDraws() {
    const commands = [];
    const add = (command) => {
        if (commands.length >= 100000)
            throw new Error('Terrain detail command limit exceeded');
        commands.push(command);
    };
    const context = new Proxy({}, {
        get(_target, key) { if (typeof key !== 'string' || !methods.has(key))
            throw new Error('Unsupported terrain draw method'); return (...args) => add({ key, args }); },
        set(_target, key, value) { if (typeof key !== 'string' || !properties.has(key))
            throw new Error('Unsupported terrain draw property'); add({ key, value }); return true; },
    });
    return { context, get commandCount() { return commands.length; }, paint(ctx) {
            try {
                for (const command of commands) {
                    if (command.args)
                        Reflect.apply(Reflect.get(ctx, command.key), ctx, command.args);
                    else
                        Reflect.set(ctx, command.key, command.value);
                }
            }
            finally {
                commands.length = 0;
            }
        } };
}
