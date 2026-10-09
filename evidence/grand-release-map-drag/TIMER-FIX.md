# Startup Illegal invocation hotfix

The viewport scheduler introduced in bdb3384 stored native setTimeout/clearTimeout and invoked them as instance methods. That supplies the ViewportWork object as their receiver; browser Window methods reject it with Illegal invocation. Initial map viewport scheduling can therefore throw inside the common start catch, which labels the error as local AI startup failure. Node timers and the previous arrow-function test doubles do not validate this receiver, so earlier tests missed this browser integration defect.

Both schedule and cancel now explicitly use globalThis as their receiver. No other runtime change; drag optimization, game rules, saves and public visitor isolation retained.

`timer-binding-check.mjs` reproduces both old failures with receiver-validating host timer doubles, and checks corrected scheduling, cancellation, coalescing, hold/release and disposal. `map-drag-check.mjs`, TypeScript and the seven existing camera geometry/gesture regressions pass. These are not physical browser or tablet acceptance. Binding the existing browser tab through the available control tool timed out again (40 seconds); no alternate UI automation used.

Deploy on the same preview service and disk. Users refresh and continue with existing visitor cookie; do not clear cookies or create a replacement game. Release verification must check exact source plus the served timer module. No need to change server instance size, authentication or build command.
