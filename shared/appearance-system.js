(function exposeAppearanceSystem(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.BlockcraftAppearanceSystem=api;
})(typeof globalThis!=='undefined'?globalThis:this,function appearanceSystemFactory(){
  'use strict';
  const PALETTES=Object.freeze({
    skin:Object.freeze(['#8a5a3c','#a96f46','#c98952','#e0ad76','#f0c997','#6b3f2c']),
    hair:Object.freeze(['#2b1b14','#5a3320','#8b5a2b','#e7d574','#d6d9e6','#7b3f63']),
    face:Object.freeze(['#185f68','#315f9f','#3b7f52','#6b4a9c','#7a3d38','#1f2937']),
    shirt:Object.freeze(['#26283f','#3a6ea8','#7d3155','#14532d','#7c2d12','#374151']),
    pants:Object.freeze(['#17182a','#24324a','#2f3326','#3a2a1e','#321f2c','#111827']),
    accent:Object.freeze(['#8f6aa7','#9bdcff','#ffd27a','#65d982','#ff9a42','#f472b6']),
  });
  const DEFAULT=Object.freeze({
    skin:PALETTES.skin[2],
    hair:PALETTES.hair[3],
    face:PALETTES.face[0],
    shirt:PALETTES.shirt[0],
    pants:PALETTES.pants[0],
    accent:PALETTES.accent[0],
  });
  function pick(key,value){
    const list=PALETTES[key]||[];
    const v=String(value||'').toLowerCase();
    return list.find(c=>c.toLowerCase()===v)||DEFAULT[key];
  }
  function sanitizeAppearance(input){
    const src=input&&typeof input==='object'?input:{};
    return {
      skin:pick('skin',src.skin),
      hair:pick('hair',src.hair),
      face:pick('face',src.face),
      shirt:pick('shirt',src.shirt),
      pants:pick('pants',src.pants),
      accent:pick('accent',src.accent),
    };
  }
  function sameAppearance(a,b){
    const x=sanitizeAppearance(a),y=sanitizeAppearance(b);
    return Object.keys(DEFAULT).every(k=>x[k]===y[k]);
  }
  return Object.freeze({PALETTES,DEFAULT,sanitizeAppearance,sameAppearance});
});
