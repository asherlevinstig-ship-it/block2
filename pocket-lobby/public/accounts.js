'use strict';
(()=>{
  const $=id=>document.getElementById(id);
  let account=null,mode='register',busy=false,reloadOnClose=false,liveweave={enabled:false,linked:false,passwordLogin:true};
  async function request(path,body){
    const response=await fetch('/api/account/'+path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
    const data=await response.json();if(!response.ok)throw new Error(data.error??'Please try again.');return data;
  }
  async function refresh(){const data=await request('status');account=data.account;liveweave=data.liveweave??{enabled:false,linked:false,passwordLogin:true};$('accountOpen').textContent=account?account.username:'Save account';$('accountOpen').setAttribute('aria-label',account?'Manage account for '+account.username:'Create an account or sign in to save your adventure');return data;}
  function render(){
    $('accountForm').hidden=!!account;$('accountSettings').hidden=!account;$('accountTabs').hidden=!!account;
    $('accountHeading').textContent=account?'Your account':mode==='register'?'Keep your adventure.':mode==='login'?'Welcome back.':'Recover your account.';
    $('accountIntro').textContent=account?'Signed in as '+account.username+'. Your character is available on your other devices.':mode==='register'?'Create an account to keep this character, inventory and progress across devices.':mode==='login'?'Sign in to open your saved account character. Your current guest character is not merged.':'Use your saved recovery code to choose a new password.';
    $('accountNewGuest').hidden=!!account||!window.towerAuthRequired;
    $('accountRecoveryField').hidden=mode!=='recover';
    $('accountRecoveryInput').required=mode==='recover';
    $('accountConfirmField').hidden=mode==='login';$('accountConfirmPassword').required=mode!=='login';
    $('accountPassword').minLength=mode==='login'?1:15;
    $('accountPasswordLabel').textContent=mode==='login'?'Password':mode==='recover'?'New password · at least 15 characters':'Password · at least 15 characters';
    $('accountFormHint').hidden=mode!=='register';
    $('accountPassword').value='';$('accountConfirmPassword').value='';
    $('accountPassword').autocomplete=mode==='login'?'current-password':'new-password';
    $('accountSubmit').textContent=mode==='register'?'Create account & keep progress':mode==='login'?'Sign in':'Reset password';
    for(const button of $('accountTabs').querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
    $('accountMessage').textContent='';
    $('accountLiveweave').hidden=!liveweave.enabled;
    $('accountLiveweaveButton').hidden=liveweave.linked;
    $('accountLiveweaveButton').textContent=account?'Link this character to LiveWeave':'Continue with LiveWeave';
    $('accountLiveweaveTitle').textContent=liveweave.linked?'Connected to LiveWeave':'Use your school account';
    $('accountLiveweaveHint').textContent=liveweave.linked?'Sign in with LiveWeave on any device to return to this character. Manage your school password on LiveWeave.':account?'Keep this character and connect it to your LiveWeave student or teacher account.':'Sign in on LiveWeave, then return here. Your current character is kept on your first link. If already linked, your saved character opens.';
    $('accountPasswordSecurity').hidden=!!account&&!liveweave.passwordLogin;
    $('accountRecoverySecurity').hidden=!!account&&!liveweave.passwordLogin;
  }
  async function open(next){
    if(busy)return;mode=next??(window.towerAuthRequired?'login':mode);$('accountRecoveryResult').hidden=true;reloadOnClose=false;
    let message='';try{await refresh();}catch(error){message=error.message;}
    render();$('accountMessage').textContent=message;if(!$('accountDialog').open)$('accountDialog').showModal();
  }
  async function prepare(){
    if(window.playerCloud?.prepareAccountChange)return window.playerCloud.prepareAccountChange();
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
  $('cloudAccount').onclick=()=>open();
  $('accountLiveweaveButton').onclick=async()=>{
    if(busy)return;busy=true;$('accountLiveweaveButton').disabled=true;$('accountMessage').textContent='Opening LiveWeave sign-in…';
    try{await prepare();const data=await request('liveweave/start',{});clearCharacterCache();location.assign(data.url);}
    catch(error){$('accountMessage').textContent=error.message;window.towerMultiplayer?.reconnect();busy=false;$('accountLiveweaveButton').disabled=false;}
  };
  for(const button of $('accountTabs').querySelectorAll('button'))button.onclick=()=>{if(busy)return;mode=button.dataset.mode;render();};
  $('accountForm').onsubmit=async event=>{
    event.preventDefault();if(busy)return;busy=true;$('accountSubmit').disabled=true;$('accountMessage').textContent='Working…';
    try{
      if(mode!=='login'&&$('accountPassword').value!==$('accountConfirmPassword').value)throw new Error('The passwords do not match. Please check both fields.');
      await prepare();
      const data=await request(mode,{username:$('accountUsername').value.trim(),password:$('accountPassword').value,recoveryCode:mode==='recover'?$('accountRecoveryInput').value:undefined});
      clearCharacterCache();$('accountPassword').value='';$('accountRecoveryInput').value='';
      if(data.recoveryCode){account=data.account;showRecovery(data.recoveryCode);}else location.reload();
    }catch(error){$('accountMessage').textContent=error.message;window.towerMultiplayer?.reconnect();}
    finally{busy=false;$('accountSubmit').disabled=false;}
  };
  $('accountPasswordForm').onsubmit=async event=>{
    event.preventDefault();if(busy)return;busy=true;$('accountChangePassword').disabled=true;$('accountMessage').textContent='Saving password…';
    try{
      if($('accountNewPassword').value!==$('accountNewConfirm').value)throw new Error('The new passwords do not match.');
      await prepare();await request('password',{password:$('accountOldPassword').value,newPassword:$('accountNewPassword').value});
      for(const id of ['accountOldPassword','accountNewPassword','accountNewConfirm'])$(id).value='';
      $('accountMessage').textContent='Password updated. Your other devices have been signed out.';window.towerMultiplayer?.reconnect();
    }catch(error){$('accountMessage').textContent=error.message;window.towerMultiplayer?.reconnect();}
    finally{busy=false;$('accountChangePassword').disabled=false;}
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
  $('accountDialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  $('accountDialog').querySelector('.close').onclick=()=>{if(!busy)$('accountDialog').close();};
  window.towerAccounts={open,refresh};refresh().catch(()=>{});
})();
