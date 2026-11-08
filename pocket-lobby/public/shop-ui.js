export function shopItemArt(id){
  const relic=['breakerSpear','duelistBlade','quickfang'].includes(id);id={breakerSpear:'huntingSpear',duelistBlade:'ironSword',quickfang:'quickDagger'}[id]??id;
  const rod=['reed','oak','silver','moon'].includes(id);
  const metal=id==='wardenSword'?'#d9e5bd':'#d6e4df';
  const tint={reed:'#bd9d72',oak:'#dfa877',silver:'#a7d8d4',moon:'#c3a4e4'}[id]??'#e9c185';
  const armour=['scoutLeather','towerPlate'].includes(id);
  const shape=armour?`<path d="M22 8l10 6 10-6 16 15-8 9-7-5v29H21V27l-7 5-8-9z" fill="${id==='towerPlate'?'#9eb5c7':'#a27a51'}" stroke="#27364a" stroke-width="2"/><path d="M24 19h16v27H24z" fill="${id==='towerPlate'?'#526c8a':'#5c4338'}"/><path d="M24 24h16v3H24zM24 35h16v3H24zM16 16l6 6M42 22l6-6" stroke="#e3c88f" stroke-width="3"/><path d="M29 25h6v12h-6z" fill="#d0d9dc"/>`:rod
    ?`<path d="M18 54l21-43 3 1-21 43z" fill="${tint}"/><path d="M41 12l10 9v24" fill="none" stroke="#c4ddd2"/><path d="M49 44h5v5h-5z" fill="#edaa8b"/><path d="M17 48l5 2-3 8-5-2z" fill="#674f5c"/><path d="M25 37h7v5h-7z" fill="#cad8c4"/>`
    :id==='huntingSpear'
      ?'<path d="M30 15h4v44h-4z" fill="#b98c66"/><path d="M32 3l8 14-8 7-8-7z" fill="#d6e4df"/><path d="M32 3v18l-8-4z" fill="#93aeb9"/><path d="M26 23h12v3H26z" fill="#e3bf82"/>'
      :id==='quickDagger'
        ?'<path d="M27 12l10 10-3 17h-7l-4-15z" fill="#d6e4df"/><path d="M27 12l3 26h-3l-4-14z" fill="#8cabb9"/><path d="M20 38h24v4H20z" fill="#91c9c6"/><path d="M29 42h6v14h-6z" fill="#8d6892"/><path d="M27 55h10v4H27z" fill="#ceb6ce"/>'
        :`<path d="M28 7l4-4 4 4v30h-8z" fill="${metal}"/><path d="M28 7l4-4v34h-4z" fill="#91aeb9"/><path d="M20 36h24v5H20z" fill="#e5be7b"/><path d="M29 41h6v14h-6z" fill="#977060"/><path d="M26 54h12v5H26z" fill="#e5be7b"/>`;
  const displayShape=relic?shape.replaceAll('#d6e4df','#e0ccff').replaceAll('#e5be7b','#ba98ea'):shape;
  return `<svg viewBox="0 0 64 64" aria-hidden="true" shape-rendering="crispEdges"><ellipse cx="32" cy="58" rx="18" ry="3" fill="#0d172a55"/>${displayShape}<path d="M48 8h2v6h-2zM46 10h6v2h-6z" fill="${tint}" opacity=".7"/></svg>`;
}
export function renderShopCard({document:doc=globalThis.document,id,name,category,price,owned,equipped,stats,deltas,requirements,reason,action,disabled,onBuy}){
  const card=doc.createElement('article');card.className='shop-item'+(equipped?' is-equipped':'')+(disabled&&!owned?' is-locked':'');card.dataset.item=id;card.tabIndex=-1;
  const art=doc.createElement('div');art.className='shop-item-art';art.innerHTML=shopItemArt(id);
  const badge=doc.createElement('span');badge.className='shop-item-badge';badge.textContent=equipped?'✓ Equipped':owned?'Owned':category;
  const cost=doc.createElement('span');cost.className='shop-item-price';cost.textContent=price===0?'FREE':price+' G';art.append(badge,cost);
  const body=doc.createElement('div');body.className='shop-item-body';
  const title=doc.createElement('h4');title.textContent=name;
  const metrics=doc.createElement('div');metrics.className='shop-item-metrics';
  for(const [label,value] of stats){const cell=doc.createElement('div'),valueNode=doc.createElement('b'),caption=doc.createElement('span');valueNode.textContent=value;caption.textContent=label;cell.append(valueNode,caption);metrics.append(cell);}
  const comparison=doc.createElement('div');comparison.className='shop-item-deltas';
  for(const {text,tone='neutral'} of deltas){const line=doc.createElement('span');line.className='delta-'+tone;line.textContent=text;comparison.append(line);}
  const requirement=doc.createElement('p');requirement.className='shop-item-requirements';requirement.textContent=requirements;
  const button=doc.createElement('button');button.className='shop-item-buy';button.textContent=action;button.disabled=disabled;button.onclick=()=>{const parent=card.parentElement;onBuy();parent?.querySelector('[data-item="'+id+'"]')?.focus({preventScroll:true});};
  button.setAttribute('aria-label',action+' · '+name+(price?' · '+price+' gold':''));
  const hint=doc.createElement('small');hint.className='shop-item-hint';hint.textContent=reason;
  body.append(title,metrics,comparison,requirement,button,hint);card.append(art,body);return card;
}
