'use strict';
(()=>{
  const $=id=>document.getElementById(id);
  let account=null,mode='register',busy=false,reloadOnClose=false;
  async function request(path,body){
    const response=await fetch('/api/account/'+path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error??'Please try again.');return data;
  }
  async function refresh(){const data=await request('status');account=data.account;$('accountOpen').textContent=account?account.username:'Account';return data;}
  function render(){
    $('accountForm').hidden=!!account;$('accountSettings').hidden=!account;$('accountTabs').hidden=!!account;
    $('accountHeading').textContent=account?'Your account':mode==='register'?'Keep your adventure.':mode==='login'?'Welcome back.':'Recover your account.';
    $('accountIntro').textContent=account?'Signed in as '+account.username+'. Your character is available on your other devices.':mode==='register'?'Create an account to keep this character, inventory and progress across devices.':mode==='login'?'Sign in to open your saved account character. Your current guest character is not merged.':'Use your saved recovery code to choose a new password.';
    $('accountNewGuest').hidden=!!account||!window.towerAuthRequired;
    $('accountRecoveryField').hidden=mode!=='recover';
    $('accountPassword').autocomplete=mode==='login'?'current-password':'new-password';
    $('accountSubmit').textContent=mode==='register'?'Create account & keep progress':mode==='login'?'Sign in':'Reset password';
    for(const button of $('accountTabs').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
    $('accountMessage').textContent='';
  }
  async function open(next){
    mode=next??mode;$('accountRecoveryResult').hidden=true;reloadOnClose=false;
    try{await refresh();}catch(error){$('accountMessage').textContent=error.message;}
    render();if(!$('accountDialog').open)$('accountDialog').showModal();
  }
  async function prepare(){
    window.towerPauseForAccount?.();window.towerSaveNow?.();
    if(window.playerCloud)await window.playerCloud.flush();
    window.towerMultiplayer?.disconnect();
  }
  function clearCharacterCache(){
    for(const key of ['player-state','avatar','room','cloud-pending','cloud-conflict'])try{localStorage.removeItem('pocket-lobby:'+key);}catch{}
  }
  function showRecovery(code){
    $('accountRecoveryCode').value=code;$('accountRecoveryResult').hidden=false;
    $('accountForm').hidden=true;$('accountSettings').hidden=true;$('accountTabs').hidden=true;
    $('accountIntro').textContent='Save this recovery code somewhere safe. It can reset your password if you lose access. A new code replaces the previous one.';
    $('accountMessage').textContent='Your saved character is ready.';reloadOnClose=true;
  }
  $('accountOpen').onclick=()=>open();
  for(const button of $('accountTabs').querySelectorAll('button'))button.onclick=()=>{mode=button.dataset.mode;render();};
  $('accountForm').onsubmit=async event=>{
    event.preventDefault();if(busy)return;busy=true;$('accountSubmit').disabled=true;$('accountMessage').textContent='Working…';
    try{
      await prepare();
      const data=await request(mode,{username:$('accountUsername').value.trim(),password:$('accountPassword').value,recoveryCode:mode==='recover'?$('accountRecoveryInput').value:undefined});
      clearCharacterCache();$('accountPassword').value='';$('accountRecoveryInput').value='';
      if(data.recoveryCode){account=data.account;showRecovery(data.recoveryCode);}else location.reload();
    }catch(error){$('accountMessage').textContent=error.message;window.towerMultiplayer?.reconnect();}
    finally{busy=false;$('accountSubmit').disabled=false;}
  };
  $('accountRotateForm').onsubmit=async event=>{
    event.preventDefault();if(busy)return;busy=true;$('accountRotate').disabled=true;
    try{const data=await request('recovery-code',{password:$('accountCurrentPassword').value});$('accountCurrentPassword').value='';showRecovery(data.recoveryCode);}
    catch(error){$('accountMessage').textContent=error.message;}
    finally{busy=false;$('accountRotate').disabled=false;}
  };
  $('accountLogout').onclick=async()=>{
    if(busy)return;busy=true;
    try{await prepare();await request('logout',{});clearCharacterCache();location.reload();}
    catch(error){$('accountMessage').textContent=error.message;window.towerMultiplayer?.reconnect();}
    finally{busy=false;}
  };
  $('accountNewGuest').onclick=async()=>{try{await prepare();await request('logout',{});location.reload();}catch(error){$('accountMessage').textContent=error.message;}};
  $('accountCopyCode').onclick=async()=>{try{await navigator.clipboard.writeText($('accountRecoveryCode').value);$('accountMessage').textContent='Recovery code copied.';}catch{$('accountRecoveryCode').select();$('accountMessage').textContent='Select and copy your recovery code.';}};
  $('accountContinue').onclick=()=>location.reload();
  $('accountDialog').addEventListener('close',()=>{if(reloadOnClose)location.reload();});
  $('accountDialog').querySelector('.close').onclick=()=>$('accountDialog').close();
  window.towerAccounts={open,refresh};refresh().catch(()=>{});
})();
