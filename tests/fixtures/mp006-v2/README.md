Pinned files copied byte-for-byte from source commit 6c2c9c6ec3ba36f031802cabf17b27c95dc32734. Authority/runtime remain unchanged in MP006; the compatibility harness uses those existing sources with this old protocol/codec/client. No legacy behavior was recreated or relaxed.

COMBAT-UX3.1: authority.ts frozen from deployed pre-summary server 8876f812b6e9bb137d7f08fd6e92eecfb5635b4b. The previous helper mixed a historical v2 parser with current authority.ts; this is no longer a valid old-server fixture after capability advertisement was added. Assertions are unchanged.
