export function createCombatSound({contextFactory=()=>{const Audio=globalThis.AudioContext??globalThis.webkitAudioContext;return Audio?new Audio():null;},isHidden=()=>globalThis.document?.hidden===true}={}){
 let audio=null,enabled=false;
 return {
  enable(value){enabled=value;if(!value)return;try{audio??=contextFactory();if(audio?.state==='suspended')audio.resume().catch(()=>{});}catch{}},
  play(kind){if(!enabled||!audio||audio.state!=='running'||isHidden())return;try{
   const notes=kind==='stagger'?[180,95,740]:kind==='mirror'?[360,580]:[520];
   notes.forEach((frequency,index)=>{const oscillator=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+index*.035;oscillator.type=index===2?'sine':'triangle';oscillator.frequency.setValueAtTime(frequency,at);oscillator.frequency.exponentialRampToValueAtTime(frequency*.55,at+.16);gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.045,at+.012);gain.gain.exponentialRampToValueAtTime(.0001,at+.21);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(at);oscillator.stop(at+.23);});
  }catch{}}
 };
}
