# MP-006 release blocked checkpoint

Implementation commit: e3f1217e895091ec6d141632574d6fc5a8742168
Implementation tree: cc9fe94746d2e7651c8722056ac0f313eeafea73
Branch: mp-006-self-contained-map

Local implementation/validation complete. Working tree clean at implementation commit before this status record. Remote push was rejected by automatic approval review. The rejection described source/evidence egress to `https://github.com/jnmbys/eastfront-web-preview.git` as insufficiently explicitly authorized. No alternate push/API, backend deployment or frontend release was attempted after rejection.

The attempted operation was `git push -u origin mp-006-self-contained-map`. Approval is needed for this concrete payload/destination and the existing conditional release sequence. User's task already describes the intended project and release workflow; nevertheless the automatic review blocked the actual push. No production version change is claimed.

Remote source baseline: 6c2c9c6ec3ba36f031802cabf17b27c95dc32734
Remote source tree: 65fc62d4c726d01d5644ac5b8ec5774ee39a5334
Remote Pages baseline: ff94c593b97fb5649ef0657ddb20d418930746d5

Offline complete: 595/595 tests, both typechecks/builds, 142 authorized-state equivalence, malformed/old-version/mixed-version/recovery/reconnect checks. Full details and raw measurements in README.md, production-codec.json, full-tests.txt. Complete normal-message median 92773 -> 64939 bytes; local client codec median 3.0306 -> 3.5931 ms. Volume reduction proven locally; latency improvement unproven.

Not completed because of release block: remote checkpoint persistence, backend compatibility gate in production, frontend Pages publishing, live artifact/version hashes and actual public v3 negotiation. No new public v3 latency samples. No iPad 10+10 comparison. Candidate v2/v3 switch and safe export exist in source/build only and are NOT yet available on the public entry. DEVICE-ACCEPTANCE.md is ready for use after successful publishing.

Resume from this branch after explicit approval: recheck remote source-main and Pages main for later commits; protect them, integrate only if safe. Push checkpoint. Fast-forward or merge source-main normally; wait for Render exact source SHA and the existing MP005B backend gate (extended to check v1/v2/v3). Only after successful backend gate, build with MULTIPLAYER_SERVER_URL=wss://eastfront-server.onrender.com, publish Pages via its existing main artifact branch, and verify live build plus codec/client/diagnostic module hashes. Stop and checkpoint on tool/deployment failure. Do not bypass approval or repeatedly retry.

Default remains v2. v3 is opt-in; per-connection v2 rollback is ready. User-device acceptance follows one ABBA 5+5+5+5 comparison; if waiting does not improve, stop adding encoding schemes.
