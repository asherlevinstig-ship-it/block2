// Explicit testing controls operate only on the current authenticated character.
'use strict';
const testingMode=document.getElementById('testingMode');
const resetTools=document.getElementById('testingResetTools');
const resetButton=document.getElementById('testingReset');
try{testingMode.checked=localStorage.getItem('pocket-lobby:testing-mode')==='true';}catch{}
resetTools.hidden=!testingMode.checked;
testingMode.onchange=()=>{resetTools.hidden=!testingMode.checked;try{localStorage.setItem('pocket-lobby:testing-mode',String(testingMode.checked));}catch{}};
resetButton.onclick=async()=>{
 if(!testingMode.checked||!window.playerCloud?.resetCharacter)return;
 if(!window.confirm('Reset this character to the beginning? Gold, items, stats, quests and home furniture will return to starter defaults. Your name and account stay.'))return;
 resetButton.disabled=true;testingMode.disabled=true;
 const status=document.getElementById('testingResetStatus');status.textContent='Resetting your character…';
 try{await window.playerCloud.resetCharacter();}
 catch(error){status.textContent=error.message;resetButton.disabled=false;testingMode.disabled=false;}
};
