import fs from 'node:fs';
fs.copyFileSync('docs/city-art-002-fix/runtime-fixture.html','.ai003-preview/city-art-002-runtime-fixture.html');
fs.copyFileSync('docs/city-art-002-fix/runtime-fixture.mjs','.ai003-preview/city-art-002-runtime-fixture.js');
console.log('Fixture copied into this worktree preview; open /city-art-002-runtime-fixture.html on its local server.');
