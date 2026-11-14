import {stallCatalog,stallLimits} from './market-stall-catalog.js';
import {vaultBagCount} from './vault.js';

export function initializeMarketStalls(api,doc=document){
  const shop=doc.getElementById('tradingPost');
  const dialog=doc.createElement('dialog');
  dialog.className='game-window market-stalls';
  dialog.setAttribute('aria-labelledby','marketStallsTitle');
  dialog.innerHTML=`
    <div class="modal-head"><h2 id="marketStallsTitle">Market stalls</h2>
      <form method="dialog"><button type="submit" aria-label="Close market stalls">×</button></form></div>
    <div class="market-stall-toolbar"><label>Find an item <select data-stall="filter"></select></label>
      <button type="button" data-stall="refresh">Refresh</button></div>
    <p data-stall="wallet"></p><p data-stall="status" role="status"></p>
    <div class="timber-columns">
      <section><h3>Listed by players</h3><div class="timber-list" data-stall="offers"></div></section>
      <section><h3>Your stall</h3><p data-stall="slots"></p><div data-stall="proceeds"></div>
        <form class="timber-post" data-stall="list">
          <label>Item from your bag <select name="item" required></select></label>
          <label>Quantity <input name="quantity" type="number" value="1" min="1" max="${stallLimits.quantity}" required></label>
          <label>Gold each <input name="price" type="number" value="5" min="1" max="${stallLimits.price}" required></label>
          <button class="primary" type="submit">List for ${stallLimits.hours} hours</button>
        </form>
        <div class="timber-list" data-stall="own"></div>
      </section>
    </div>`;
  const field=name=>dialog.querySelector('[data-stall="'+name+'"]');
  const filter=field('filter'),listingForm=field('list');
  const button=(label,fn)=>{
    const node=doc.createElement('button');node.type='button';node.textContent=label;node.onclick=fn;return node;
  };
  const option=(value,label)=>{
    const node=doc.createElement('option');node.value=value;node.textContent=label;return node;
  };
  const items=Object.entries(stallCatalog).sort(([,a],[,b])=>a.name.localeCompare(b.name));
  filter.append(option('','All items'),...items.map(([key,item])=>option(key,item.name)));
  let board=null,busy=false,appraisal=null;
  let appraisalUntil=0;
  function listing(entry,own){
    const card=doc.createElement('article'),title=doc.createElement('strong'),info=doc.createElement('p');
    title.textContent=stallCatalog[entry.item].name;
    const expiry=entry.expiresAt<=board.now?'Expired':'Ends '+new Date(entry.expiresAt).toLocaleString();
    info.textContent=entry.seller+' · '+entry.quantity+' available · '+entry.price.toLocaleString()+' gold each · '+expiry;
    card.append(title,info);
    if(entry.item.startsWith('ore:')&&api.state().styleAbilities?.learned?.includes('appraise')){
      const appraise=button('Appraise ore',()=>change({kind:'appraise',id:entry.id}));
      appraise.dataset.appraise='true';
      const seconds=Math.ceil(((api.state().styleAbilities.readyAt?.appraise??0)-Date.now())/1000);
      if(seconds>0){appraise.disabled=true;appraise.textContent='Appraise · '+seconds+'s';}
      card.append(appraise);
    }
    if(own){
      card.append(button(entry.expiresAt<=board.now?'Reclaim stock':'Cancel and reclaim',()=>change({kind:'reclaim',id:entry.id})));
    }else{
      const form=doc.createElement('form'),label=doc.createElement('label'),quantity=doc.createElement('input');
      quantity.type='number';quantity.min=1;quantity.max=entry.quantity;quantity.value=1;quantity.required=true;
      label.append('Quantity ',quantity);
      const buy=button('',null);buy.type='submit';
      const update=()=>{
        const cost=Number(quantity.value)*entry.price;
        buy.textContent='Buy · '+cost.toLocaleString()+' gold';
        buy.disabled=busy||!quantity.checkValidity()||cost>api.state().credits;
      };
      quantity.oninput=update;update();form.append(label,buy);
      form.onsubmit=event=>{event.preventDefault();change({kind:'buy',id:entry.id,price:entry.price,quantity:Number(quantity.value)});};
      card.append(form);
    }
    return card;
  }
  function render(){
    if(!board)return;
    dialog.querySelectorAll('.market-appraisal').forEach(el=>el.remove());
    for(const [key,empty] of [['offers','No listings match.'],['own','No items listed.']]){
      const target=field(key);
      if(board[key].length)target.replaceChildren(...board[key].map(entry=>listing(entry,key==='own')));
      else target.textContent=empty;
    }
    if(appraisal&&Date.now()<appraisalUntil){
      const report=appraisal,element=doc.createElement('p');element.className='market-appraisal';
      if(report.average===undefined)element.textContent='Not enough recent sales. '+report.trades+' completed trades · '+report.volume+' units over the last 7 days. At least 3 trades are needed.';
      else{
        const difference=Math.round((report.price/report.average-1)*100);
        element.textContent=stallCatalog[report.item].name+' · Typical price '+report.average.toFixed(1)+' gold per unit · '+report.low+'–'+report.high+' gold range · '+report.volume+' units across '+report.trades+' trades in the last 7 days. This listing is '+(difference===0?'at the typical price.':Math.abs(difference)+'% '+(difference>0?'above':'below')+' the typical price.');
      }
      field('status').after(element);
    }
    field('wallet').textContent=api.state().credits.toLocaleString()+' gold in wallet';
    field('slots').textContent=board.own.length+' / '+stallLimits.listings+' listing slots used';
    const collect=button('Collect '+board.claimable.toLocaleString()+' gold',()=>change({kind:'claim'}));
    collect.disabled=!board.claimable;
    field('proceeds').replaceChildren(collect);
    const select=listingForm.elements.namedItem('item'),previous=select.value;
    const owned=items.flatMap(([key,item])=>{
      const count=vaultBagCount(api.state(),key,stallCatalog);
      return count?[option(key,item.name+' ('+count+' in bag)')]:[];
    });
    select.replaceChildren(...(owned.length?owned:[option('','No eligible items in bag')]));
    if(owned.some(entry=>entry.value===previous))select.value=previous;
    updateListingQuantity();
    listingForm.querySelector('button').disabled=!owned.length||board.own.length>=stallLimits.listings;
  }
  async function run(action){
    if(busy)return;
    busy=true;field('status').textContent='';dialog.setAttribute('aria-busy','true');filter.disabled=true;
    try{await action();}
    catch(error){field('status').textContent=error.message;}
    finally{busy=false;filter.disabled=false;dialog.removeAttribute('aria-busy');render();}
  }
  const refresh=()=>run(async()=>{board=await api.read(filter.value);});
  const change=body=>run(async()=>{
    try{
      const packet=await api.change({...body,filter:filter.value});
      board=packet.board;api.apply(packet.state,packet.receipt);
      if(body.kind==='appraise'&&packet.receipt){appraisal=packet.receipt;appraisalUntil=Date.now()+60000;}
      field('status').textContent={list:'Item listed.',buy:'Items added to your bag.',reclaim:'Stock returned to your bag.',claim:'Gold collected.',appraise:'Ore appraised.'}[body.kind];
    }catch(error){
      board=await api.read(filter.value).catch(()=>board);
      throw error;
    }
  });
  function updateListingQuantity(){
    const select=listingForm.elements.namedItem('item'),quantity=listingForm.elements.namedItem('quantity');
    const cap=Math.min(stallLimits.quantity,vaultBagCount(api.state(),select.value,stallCatalog));
    quantity.max=Math.max(1,cap);
    if(Number(quantity.value)>cap)quantity.value=Math.max(1,cap);
  }
  listingForm.elements.namedItem('item').onchange=updateListingQuantity;
  filter.onchange=refresh;field('refresh').onclick=refresh;
  listingForm.onsubmit=event=>{
    event.preventDefault();
    const values=new FormData(listingForm);
    change({kind:'list',item:values.get('item'),quantity:Number(values.get('quantity')),price:Number(values.get('price'))});
  };
  const open=button('Market stalls',()=>{if(!dialog.open)dialog.showModal();refresh();});
  shop.querySelector('.timber-nav').append(open);
  doc.body.append(dialog);
  window.towerOpenMarketStalls=()=>{if(!dialog.open)dialog.showModal();refresh();};
  setInterval(()=>{
    if(!dialog.open)return;
    const seconds=Math.max(0,Math.ceil(((api.state().styleAbilities?.readyAt?.appraise??0)-Date.now())/1000));
    for(const button of dialog.querySelectorAll('[data-appraise]')){
      button.disabled=busy||seconds>0;button.textContent=seconds?'Appraise · '+seconds+'s':'Appraise ore';
    }
  },1000);
}
