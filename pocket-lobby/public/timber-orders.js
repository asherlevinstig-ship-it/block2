export function initializeTimberOrders(api,doc=document){
  const shop=doc.getElementById('tradingPost'),dialog=doc.getElementById('merchantDialog');
  const style=doc.createElement('link');style.rel='stylesheet';style.href='timber-orders.css';doc.head.append(style);
  const instant=doc.createElement('div');instant.append(...shop.childNodes);
  const board=doc.createElement('section');board.className='timber-board';board.hidden=true;
  const navigation=doc.createElement('nav');navigation.className='timber-nav';navigation.setAttribute('aria-label','Trading Post services');
  const button=(text,fn)=>{
    const node=doc.createElement('button');node.type='button';node.textContent=text;node.onclick=fn;return node;
  };
  const trader=button('Sell to trader',()=>show(false)),players=button('Player orders',()=>show(true));
  navigation.append(trader,players);shop.append(navigation,instant,board);
  board.innerHTML=`
    <header class="timber-board-head">
      <div><h3>Timber orders</h3><p>Sell timber to other players, or place an order for your next project.</p></div>
      <button type="button" data-market="refresh">Refresh</button>
    </header>
    <p class="timber-balances" data-market="balances"></p>
    <p class="timber-status" role="status" data-market="status"></p>
    <div class="timber-columns">
      <section aria-label="Orders from other players"><h4>Buyers looking for timber</h4><div class="timber-list" data-market="offers"></div></section>
      <section aria-label="Your timber orders"><h4>Your orders</h4>
        <form class="timber-post" data-market="post">
          <label>Timber wanted<input name="quantity" type="number" min="1" max="200" value="20" required></label>
          <label>Gold per timber<input name="price" type="number" min="1" max="1000" value="6" required></label>
          <small data-market="cost"></small>
          <button type="submit" class="primary">Post buy order</button>
          <small data-market="post-note">Unused gold is refunded when you cancel. Collect delivered timber here.</small>
        </form>
        <div class="timber-list" data-market="own"></div>
      </section>
    </div>`;
  const field=name=>board.querySelector('[data-market="'+name+'"]');
  const form=field('post'),quantity=form.elements.namedItem('quantity'),price=form.elements.namedItem('price');
  const status=field('status'),refreshButton=field('refresh'),format=new Intl.NumberFormat();
  const gold=amount=>format.format(amount)+' gold';
  let data=null,busy=false;

  function show(open){
    instant.hidden=open;board.hidden=!open;
    trader.setAttribute('aria-pressed',String(!open));players.setAttribute('aria-pressed',String(open));
    if(open){status.textContent='';load();}
  }
  function controls(){
    const {credits,timber}=api.balances();
    field('balances').textContent=format.format(timber)+' timber in bag · '+gold(credits)+' in wallet · '+gold(data?.heldGold??0)+' held';
    const cost=quantity.valueAsNumber*price.valueAsNumber,valid=quantity.validity.valid&&price.validity.valid;
    field('cost').textContent=valid?gold(cost)+' held when posted'+(cost>credits?' · Need '+gold(cost-credits)+' more':''):'Enter a whole quantity and price.';
    const full=data&&data.own.length>=data.limit;
    field('post-note').textContent=full?'Collect or cancel one of your '+data.limit+' orders to post again.':'Unused gold is refunded when you cancel. Collect delivered timber here.';
    form.querySelector('button').disabled=busy||!data||!valid||cost>credits||!!full;
  }
  function line(text,tag='p'){
    const element=doc.createElement(tag);element.textContent=text;return element;
  }
  function render(){
    controls();
    const offers=field('offers'),own=field('own');
    offers.replaceChildren();own.replaceChildren();
    if(!data)return;
    const {timber}=api.balances();
    if(!data.orders.length)offers.append(line('No open timber orders from other players.'));
    for(const order of data.orders){
      const card=doc.createElement('article');card.className='timber-order';
      card.append(line(order.buyer,'b'),line(gold(order.price)+' each · '+order.remaining+' timber wanted'));
      const maximum=Math.min(timber,order.remaining);
      if(!maximum){card.append(line('Bring timber to fill this order.','small'));offers.append(card);continue;}
      const sale=doc.createElement('form'),label=doc.createElement('label'),amount=doc.createElement('input'),sell=doc.createElement('button');
      label.textContent='Quantity';amount.type='number';amount.min='1';amount.max=String(maximum);amount.value=String(maximum);amount.required=true;
      label.append(amount);sell.type='submit';sale.className='timber-fill';sale.append(label,sell);card.append(sale);
      const quote=()=>{sell.textContent=amount.validity.valid?'Sell · '+gold(amount.valueAsNumber*order.price):'Sell timber';sell.disabled=!amount.validity.valid;};
      amount.oninput=quote;quote();
      sale.onsubmit=event=>{event.preventDefault();if(amount.validity.valid)change({kind:'fill',id:order.id,quantity:amount.valueAsNumber});};
      offers.append(card);
    }
    if(data.orders.length===30)offers.append(line('Showing the 30 highest-paying orders.','small'));
    if(!data.own.length)own.append(line('You have no open orders or pickups.'));
    for(const order of data.own){
      const card=doc.createElement('article'),actions=doc.createElement('div');
      card.className='timber-order';actions.className='timber-order-actions';
      card.append(line(order.quantity+' timber at '+gold(order.price)+' each','b'),
        line(order.remaining+' still wanted · '+order.ready+' ready for pickup'));
      if(order.ready)actions.append(button('Collect '+order.ready,()=>change({kind:'collect',id:order.id})));
      if(order.remaining)actions.append(button('Cancel · refund '+gold(order.remaining*order.price),()=>change({kind:'cancel',id:order.id})));
      card.append(actions);own.append(card);
    }
  }
  async function load(){
    if(busy)return;
    busy=true;refreshButton.disabled=true;controls();
    if(!data)status.textContent='Loading timber orders…';
    try{data=await api.read();status.textContent='';render();}
    catch(error){status.textContent=error.message;}
    finally{busy=false;refreshButton.disabled=false;controls();}
  }
  async function change(body){
    if(busy)return;
    busy=true;refreshButton.disabled=true;controls();
    status.textContent='Updating your order…';
    try{
      const {board:next,state,receipt}=await api.change(body);
      api.apply(state,receipt);
      data=next;
      status.textContent=receipt?({
        post:()=> 'Order posted. '+gold(-receipt.gold)+' held at the Trading Post.',
        fill:()=> 'Sold '+receipt.quantity+' timber for '+gold(receipt.gold)+'.',
        cancel:()=> 'Order cancelled. '+gold(receipt.gold)+' returned to your wallet.',
        collect:()=> 'Collected '+receipt.quantity+' timber.'
      })[receipt.kind]():'Order updated.';
    }catch(error){
      status.textContent=error.message;
      try{data=await api.read();}catch{}
    }finally{busy=false;refreshButton.disabled=false;render();}
  }
  refreshButton.onclick=load;
  form.oninput=controls;
  form.onsubmit=event=>{
    event.preventDefault();
    if(form.checkValidity())change({kind:'post',quantity:quantity.valueAsNumber,price:price.valueAsNumber});
  };
  dialog.addEventListener('close',()=>show(false));
  show(false);
}
