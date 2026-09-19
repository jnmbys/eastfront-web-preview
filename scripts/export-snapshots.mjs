import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { svgMarkup, makePath } from '../dist/app/render/svg.js';
import { initialSelectedUnitId, reachableHexes } from '../dist/app/model/prototypeData.js';

await mkdir('screenshots', { recursive: true });
const path = makePath(initialSelectedUnitId, reachableHexes[reachableHexes.length - 2]);
const fullCss = await readFile('styles.css','utf8');
const mapStart = fullCss.indexOf('/* Terrain:');
const mapEnd = fullCss.indexOf('\nfooter{');
if(mapStart<0||mapEnd<0) throw new Error('Could not isolate renderer CSS from styles.css');
const css = fullCss.slice(mapStart,mapEnd)
  .replace(/transition:[^;]+;/g,'')
  .replace(/filter:url\([^;]+;/g,'')
  .replace(/filter:drop-shadow\([^;]+;/g,'');

function standalone(debug,width,height){
  let svg = svgMarkup({ selectedUnitId: initialSelectedUnitId, plannedPath: path, debug });
  const match = svg.match(/viewBox="([^"]+)"/);
  if(!match) throw new Error('viewBox missing');
  const [x,y,w,h] = match[1].split(' ').map(Number);
  svg = svg.replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" `);
  svg = svg.replace('>', `><style type="text/css"><![CDATA[${css}]]></style><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#bbb393"/>`);
  return svg;
}

const snapshots = [
  ['normal.svg', false, 1366, 1024],
  ['debug.svg', true, 1366, 1024],
  ['normal-ipad-landscape.svg', false, 1194, 834],
  ['normal-1180x820.svg', false, 1180, 820],
  ['normal-1024x768.svg', false, 1024, 768],
];
for(const [name,debug,width,height] of snapshots){
  await writeFile(`screenshots/${name}`, standalone(debug,width,height));
}
console.log('Exported responsive SVG snapshots from compiled svgMarkup().');
