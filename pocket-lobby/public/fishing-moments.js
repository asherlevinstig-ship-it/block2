'use strict';
const fishingMoments=(()=>{
  const CAST_MS=450,BITE_MS=1800,LAND_MS=900;
  function create(now,duration,random=Math.random){
    const wait=duration*(.85+random()*.30);
    const biteAt=now+CAST_MS+wait;
    return {started:now,castEnds:now+CAST_MS,biteAt,landAt:biteAt+BITE_MS,bonus:0,stage:'casting',fishId:null};
  }
  function phase(session,now){
    if(now<session.castEnds)return 'casting';
    if(now<session.biteAt-400)return 'waiting';
    if(now<session.biteAt)return 'twitch';
    if(now<session.landAt)return 'bite';
    if(now<session.landAt+LAND_MS)return 'landing';
    return 'complete';
  }
  function reel(session,now){
    if(phase(session,now)!=='bite'||session.bonus)return false;
    session.bonus=5;session.landAt=now;
    return true;
  }
  function drawFish(ctx,x,y,species,quality,scale=1){
    const ink=species.startsWith('trout')?'#b9b4dd':species.startsWith('perch')?'#a7be8f':'#a7d8db';
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(scale,scale);
    ctx.fillStyle='#34435b';ctx.fillRect(-7,-3,13,6);
    ctx.fillStyle=ink;ctx.fillRect(-6,-2,11,4);ctx.fillRect(-3,-3,5,6);
    ctx.beginPath();ctx.moveTo(-6,0);ctx.lineTo(-11,-4);ctx.lineTo(-11,4);ctx.closePath();ctx.fill();
    ctx.fillStyle='#edf3d9';ctx.fillRect(1,1,3,1);ctx.fillRect(2,-2,2,1);
    ctx.fillStyle='#273344';ctx.fillRect(4,-1,1,1);
    if(quality!=='common'){
      ctx.fillStyle=quality==='rare'?'#e2b6ef':'#f7dc9b';
      ctx.fillRect(-4,-2,1,1);ctx.fillRect(-1,0,1,1);
    }
    ctx.restore();
  }
  function drawShoal(ctx,x,y,time,reduced){
    ctx.save();
    ctx.beginPath();ctx.ellipse(x,y,15,6,0,0,Math.PI*2);
    ctx.fillStyle='#55e5d32e';ctx.fill();
    ctx.strokeStyle='#96eee7';ctx.lineWidth=1.2;ctx.stroke();
    for(let i=0;i<3;i++){
      const wave=reduced?(i+1)/4:(time/1900+i/3)%1;
      ctx.globalAlpha=.75*(1-wave);
      ctx.beginPath();ctx.ellipse(x,y,13+wave*17,5+wave*8,0,0,Math.PI*2);
      ctx.strokeStyle=i===0?'#ffdf97':'#91f3e7';ctx.stroke();
    }
    const leap=reduced?.45:time%2600/650;
    if(leap<1){
      ctx.globalAlpha=1;
      drawFish(ctx,x-9+leap*18,y-Math.sin(leap*Math.PI)*13-2,'silverfin','fine',.7);
    }
    ctx.restore();
  }
  let audio=null,enabled=false;
  function enable(value){
    enabled=value;
    if(!enabled)return;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;
      if(!Audio)return;
      audio??=new Audio();
      audio.resume().catch(()=>{});
    }catch{audio=null;}
  }
  function sound(kind){
    if(!enabled||!audio||audio.state!=='running'||document.hidden)return;
    const notes={cast:[480,280],splash:[220,150,100],bite:[620,820],reel:[360,440,540],catch:[520,660,780],rare:[660,880,1100],level:[440,660,880,1100]};
    try{
      if(kind==='splash'){
        const buffer=audio.createBuffer(1,Math.floor(audio.sampleRate*.18),audio.sampleRate);
        const data=buffer.getChannelData(0);
        for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);
        const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();
        source.buffer=buffer;filter.type='lowpass';filter.frequency.value=1200;gain.gain.value=.08;
        source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start();
        return;
      }
      (notes[kind]??notes.catch).forEach((frequency,index)=>{
        const oscillator=audio.createOscillator(),gain=audio.createGain();
        const when=audio.currentTime+index*.065;
        oscillator.type=kind==='splash'?'triangle':'sine';
        oscillator.frequency.setValueAtTime(frequency,when);
        oscillator.frequency.exponentialRampToValueAtTime(frequency*.75,when+.13);
        gain.gain.setValueAtTime(.0001,when);
        gain.gain.exponentialRampToValueAtTime(.045,when+.012);
        gain.gain.exponentialRampToValueAtTime(.0001,when+.19);
        oscillator.connect(gain);gain.connect(audio.destination);
        oscillator.start(when);oscillator.stop(when+.21);
      });
    }catch{}
  }
  return {create,phase,reel,drawFish,drawShoal,enable,sound,CAST_MS,BITE_MS,LAND_MS};
})();
