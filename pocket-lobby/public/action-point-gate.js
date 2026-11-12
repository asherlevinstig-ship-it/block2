export function createActionPointGate({gate,text,button,title,stop,apply,status,reconnect}){
 return {suspend(packet){
  stop();apply(packet);
  status('Home · Disconnected · Out of Action Points');
  if(title)title.textContent='Out of Action Points';
  gate.dataset.reason='action-points';
  text.textContent='Your earned items and gold are saved, and your character is safely at home. Action Points refill by 1 per minute while Auto is off. Auto will not restart while you are disconnected.';
  button.hidden=false;button.textContent='Return to game';button.disabled=false;
  button.onclick=async()=>{
   if(button.disabled)return;button.disabled=true;
   try{await reconnect();delete gate.dataset.reason;gate.close();}
   catch(error){text.textContent=error.message;}
   finally{button.disabled=false;}
  };
  gate.oncancel=event=>event.preventDefault();
  if(!gate.open)gate.showModal();
 }};
}
