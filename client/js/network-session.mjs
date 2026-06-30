export function createNetworkSession({
  createController,
  Client,
  endpoint,
  sessionStorage,
  attachRoom,
  unavailable,
  interrupted,
  reconnectAttempt,
  restored,
  failure,
  getPlayerName,
  beforeConnect,
}) {
  const controller=createController({
    Client,
    endpoint,
    roomName:'blockcraft',
    sessionStorage,
    tokenKey:'bc_reconnect_token',
    onAttach:attachRoom,
    onUnavailable:unavailable,
    onInterrupted:interrupted,
    onReconnectAttempt:reconnectAttempt,
    onRestored:restored,
    onFailure:failure,
  });
  const state=controller.state;

  function connect(){
    const name=String(getPlayerName()||'Hunter').slice(0,16);
    try{
      localStorage.removeItem('bc_token');
      localStorage.setItem('bc_name',name);
    }catch(e){}
    beforeConnect();
    controller.connect(name);
  }

  return Object.freeze({controller,state,connect});
}

