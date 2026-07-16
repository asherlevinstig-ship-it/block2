const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'client', 'assets');
const outPath = path.join(outDir, 'splash-cinematic.png');
const WIDTH = 1600;
const HEIGHT = 900;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#071019}
canvas{display:block;width:${WIDTH}px;height:${HEIGHT}px}
</style></head><body><canvas id="c" width="${WIDTH}" height="${HEIGHT}"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const cx = W * 0.5;
const cy = H * 0.48;
const tw = 46;
const th = 24;
const zH = 30;

function grad(x0,y0,x1,y1,stops){
  const g = ctx.createLinearGradient(x0,y0,x1,y1);
  for (const [p,c] of stops) g.addColorStop(p,c);
  return g;
}
function poly(points, fill, stroke, width=1){
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function iso(x,z,y=0){
  return [cx + (x - z) * tw, cy + (x + z) * th - y * zH];
}
function shade(hex, amt){
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
}
function block(x,z,h,color){
  const a = iso(x,z,h), b = iso(x+1,z,h), c = iso(x+1,z+1,h), d = iso(x,z+1,h);
  const ab = iso(x,z,0), bb = iso(x+1,z,0), cb = iso(x+1,z+1,0), db = iso(x,z+1,0);
  poly([a,b,c,d], shade(color,18), 'rgba(255,255,255,.04)');
  poly([d,c,cb,db], shade(color,-34), 'rgba(0,0,0,.08)');
  poly([b,c,cb,bb], shade(color,-52), 'rgba(0,0,0,.08)');
}
function box(x,z,y,sx,sz,sy,color){
  const a = iso(x,z,y+sy), b = iso(x+sx,z,y+sy), c = iso(x+sx,z+sz,y+sy), d = iso(x,z+sz,y+sy);
  const bb = iso(x+sx,z,y), cb = iso(x+sx,z+sz,y), db = iso(x,z+sz,y);
  poly([a,b,c,d], shade(color,20), 'rgba(255,255,255,.05)');
  poly([d,c,cb,db], shade(color,-30), 'rgba(0,0,0,.12)');
  poly([b,c,cb,bb], shade(color,-50), 'rgba(0,0,0,.12)');
}
function roof(x,z,y,sx,sz,sy,color){
  const a = iso(x,z,y), b = iso(x+sx,z,y), c = iso(x+sx,z+sz,y), d = iso(x,z+sz,y);
  const p = iso(x+sx/2,z+sz/2,y+sy);
  poly([a,b,p], shade(color,18), 'rgba(0,0,0,.12)');
  poly([b,c,p], color, 'rgba(0,0,0,.12)');
  poly([c,d,p], shade(color,-24), 'rgba(0,0,0,.12)');
  poly([d,a,p], shade(color,-8), 'rgba(0,0,0,.12)');
}
function glow(x,y,r,color){
  const g = ctx.createRadialGradient(x,y,0,x,y,r);
  g.addColorStop(0,color);
  g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
}

ctx.fillStyle = grad(0,0,0,H,[[0,'#0b1629'],[.35,'#173e5a'],[.68,'#102318'],[1,'#03070a']]);
ctx.fillRect(0,0,W,H);
glow(W*0.72,H*0.15,210,'rgba(255,211,107,.22)');
ctx.fillStyle = '#f5d46c';
ctx.beginPath(); ctx.arc(W*0.72,H*0.15,62,0,Math.PI*2); ctx.fill();
for(let i=0;i<120;i++){
  const x = (i*97)%W, y = 24 + (i*53)%240, r = 0.8 + (i%3)*0.5;
  ctx.fillStyle = 'rgba(210,245,255,' + (0.25 + (i%5)*0.12) + ')';
  ctx.fillRect(x,y,r,r);
}
for (const m of [[-40,350,210,250], [130,315,360,300], [420,280,690,350], [760,300,1040,360], [1080,285,1370,355], [1300,330,1660,380]]) {
  poly([[m[0],m[2]],[m[1],m[3]-250],[m[2],m[2]],[m[2],460],[m[0],460]], '#132b35');
}

const tiles = [];
for(let x=-14;x<=14;x++){
  for(let z=-13;z<=13;z++){
    const path = Math.abs(x + z * .26) < 1.25 && z > -12;
    const water = x < -11 && z > 3;
    const h = water ? -0.08 : Math.max(0, Math.sin(x*.8+z*.5)*.06 + Math.cos(z*.7)*.05);
    tiles.push({x,z,h,color: path ? '#b6a06d' : water ? '#2e9fd0' : ((x+z)%4 ? '#3f8f3f' : '#327f3a')});
  }
}
tiles.sort((a,b)=>(a.x+a.z)-(b.x+b.z)).forEach(t => block(t.x,t.z,t.h,t.color));

function tree(x,z,s=1){
  box(x+.28,z+.28,0,.42*s,.42*s,1.25*s,'#6a4228');
  box(x-.35,z-.25,1.16*s,1.4*s,1.25*s,.55*s,'#2f9a4f');
  box(x-.12,z-.05,1.72*s,1.0*s,.9*s,.48*s,'#238041');
  box(x-.5,z+.15,1.36*s,1.0*s,1.0*s,.42*s,'#3aa85a');
}
[[-11,-1,1.2],[-13,5,1.0],[-8,6,.85],[-5,-7,.9],[9,4,1.2],[12,-2,.9],[14,-8,.8]].forEach(v=>tree(...v));

function house(x,z,s=1){
  box(x,z,0,1.9*s,1.7*s,1.1*s,'#70442a');
  roof(x-.2*s,z-.2*s,1.1*s,2.3*s,2.1*s,.9*s,'#8d2f28');
  box(x+.75*s,z+1.62*s,.02,.42*s,.1*s,.75*s,'#16100d');
  box(x+.18*s,z+1.64*s,.52,.36*s,.08*s,.32*s,'#ffd77a');
}
house(-9,-2,1.08); house(-12,2,.85); house(-6.6,1.3,.72);

function portal(x,z){
  const p = iso(x,z,0);
  glow(p[0],p[1]-120,210,'rgba(79,216,255,.28)');
  ctx.save();
  ctx.translate(p[0], p[1]-105);
  ctx.scale(1.0,.72);
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#4fd8ff';
  ctx.shadowColor = '#4fd8ff';
  ctx.shadowBlur = 28;
  ctx.beginPath(); ctx.arc(0,0,74,Math.PI*.08,Math.PI*1.92); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = grad(0,-75,0,75,[[0,'#84efff'],[.4,'#2f8ccb'],[1,'#102646']]);
  ctx.beginPath(); ctx.arc(0,0,59,0,Math.PI*2); ctx.fill();
  ctx.restore();
  box(x-1.5,z-.45,0,3.2,.9,.32,'#56606a');
  for(let i=0;i<6;i++){
    const a = i / 6 * Math.PI * 2;
    glow(p[0] + Math.cos(a)*115, p[1]-105 + Math.sin(a)*75, 18, 'rgba(154,215,255,.8)');
  }
}
portal(6,-5);

box(1.1,4.4,0,.65,.65,.9,'#2f486c');
box(1.08,4.35,.9,.7,.7,.55,'#e1c08b');
box(1.2,5.0,0,.18,.22,.55,'#202532');
box(1.62,5.0,0,.18,.22,.55,'#202532');
const sp = iso(2.0,4.7,1.2);
ctx.strokeStyle = '#c8e8ff'; ctx.lineWidth = 7; ctx.shadowColor = '#c8e8ff'; ctx.shadowBlur = 12;
ctx.beginPath(); ctx.moveTo(sp[0],sp[1]); ctx.lineTo(sp[0]+58,sp[1]+110); ctx.stroke(); ctx.shadowBlur = 0;

const chest = iso(8,1,0);
box(7.5,.7,0,1.25,1.0,.55,'#a56b2a');
box(7.5,.7,.55,1.25,1.0,.32,'#c99437');
glow(chest[0],chest[1]-34,58,'rgba(255,210,74,.32)');

function dragon(){
  const x = W * .56, y = H * .19;
  glow(x,y,150,'rgba(154,210,107,.14)');
  ctx.save(); ctx.translate(x,y); ctx.rotate(-0.12);
  ctx.fillStyle = '#172534';
  ctx.strokeStyle = '#89d7ff';
  ctx.lineWidth = 2;
  poly([[-36,8],[-150,-44],[-68,-6],[-155,58],[-28,28]], '#20364c', 'rgba(137,215,255,.24)');
  poly([[36,8],[150,-58],[64,-8],[152,52],[28,28]], '#20364c', 'rgba(137,215,255,.24)');
  ctx.fillStyle = '#192939';
  ctx.beginPath(); ctx.ellipse(0,8,54,24,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(64,-2,34,18,-.25,0,Math.PI*2); ctx.fill();
  poly([[91,-13],[130,-28],[108,-4]], '#192939');
  poly([[-48,12],[-138,26],[-52,30]], '#192939');
  poly([[92,-20],[105,-49],[112,-17]], '#89d7ff');
  poly([[78,-20],[74,-52],[92,-21]], '#89d7ff');
  ctx.restore();
}
dragon();

ctx.fillStyle = grad(0,0,0,H,[[0,'rgba(0,0,0,0)'],[.58,'rgba(0,0,0,.1)'],[1,'rgba(0,0,0,.56)']]);
ctx.fillRect(0,0,W,H);
const vg = ctx.createRadialGradient(W*.52,H*.48,H*.1,W*.52,H*.48,H*.76);
vg.addColorStop(0,'rgba(0,0,0,0)');
vg.addColorStop(.72,'rgba(0,0,0,.18)');
vg.addColorStop(1,'rgba(0,0,0,.72)');
ctx.fillStyle = vg;
ctx.fillRect(0,0,W,H);
window.__READY__ = true;
</script></body></html>`;

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 15_000 });
    const dataUrl = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
    fs.writeFileSync(outPath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  } finally {
    await browser.close();
  }
  console.log(`Rendered ${path.relative(root, outPath)}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
