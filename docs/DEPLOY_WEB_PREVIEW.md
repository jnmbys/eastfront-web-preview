# EASTFRONT Web Preview Deployment

Build: **v0.0.8 / UI-008**

The Web Preview is a static front-end application. It does not require a backend, account system, telemetry, service worker, or cloud save.

## A. Local preview

From the source Candidate:

```bash
npm install
npm run build
npm run preview
```

Then open the local URL printed by the server. `npm run preview` serves the final `dist/` directory, not a development fixture.

## B. Static deploy artifact

Use `EASTFRONT_UI008_WEB_PREVIEW_DIST.zip` from the Leader Review Bundle.

Extract it and upload the **contents of the archive** to the root of a static web host. `index.html` must remain beside `styles.css`, `app/`, `assets/`, and `vendor/`.

The artifact is already compiled. No Node.js build step is required on the host.

## C. Vercel

Use a static project and publish the extracted deploy directory as-is. No serverless function or rewrite is required because UI-008 deliberately uses one page and no client-side route tree.

## D. Netlify

Upload the extracted deploy directory or configure `dist` as the publish directory when building from source. No redirect file is required for the current single-page entry.

## E. GitHub Pages / subpath hosting

UI-008 uses relative entry, map, manifest, and runtime asset URLs. It can therefore be served below a repository subpath when the whole deploy artifact remains together under that subpath.

Do not move `index.html` away from its sibling `app/`, `assets/`, `vendor/`, or `styles.css` paths.

## Refresh behavior

There are no secondary client-side routes. Refreshing `/` returns the Home / New Game entry. Full save/load is intentionally outside UI-008 scope.

## Production runtime assets

Only the P5R1 runtime pack is shipped. The historical directory name `assets/terrain/p4r3/` is a frozen asset-path contract; it does **not** mean the old P4R3 art pack is shipped.

Production audit proves:

- 123 runtime raster files;
- 122 match P5 production hashes;
- `city/small/S02.png` matches P5R1;
- runtime raster payload: 6,472,819 bytes / 6.173 MiB;
- no `dev-assets/p4r3-baseline`;
- no review screenshots, Painter comparison sheets, tests, or Leader review files in `dist/`.
