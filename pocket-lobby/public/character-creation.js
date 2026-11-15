import {clothingCatalog,normalizeWardrobe,outfitAppearance} from './wardrobe.js';
import {hairStyles,faceStyles,skinTones} from './character-look.js';
export function createCharacter({renderer,initial={},save}){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.className='game-window character-creation';dialog.setAttribute('aria-labelledby','creationTitle');
  dialog.innerHTML=`<div class="eyebrow">YOUR STORY STARTS HERE</div><h2 id="creationTitle">Create your adventurer</h2><p class="creation-goal">Your aim: become the richest and most powerful player in the game.</p><form id="creationForm"><div class="creation-layout"><div class="creation-preview"><canvas width="300" height="300" aria-label="Your character preview"></canvas><button type="button" id="creationTurn">Turn character</button><p>Your first outfit · All choices are free</p></div><div class="creation-options"><label for="creationName">What should we call you?</label><input id="creationName" maxlength="20" required autocomplete="nickname" placeholder="Choose your character name"><label for="creationGender">Character</label><select id="creationGender"><option value="male">Male</option><option value="female">Female</option></select><label for="creationHair">Hair colour</label><select id="creationHair"></select><label for="creationJacket">Top / dress</label><select id="creationJacket"></select><label for="creationTrousers">Trousers</label><select id="creationTrousers"></select><label for="creationBoots">Boots</label><select id="creationBoots"></select></div></div><p id="creationStatus" role="status">You can change your look later in Wardrobe.</p><button class="primary" type="submit">Begin my adventure</button></form>`;
  document.body.append(dialog);const find=id=>dialog.querySelector('#'+id),wardrobe=normalizeWardrobe(undefined,{outfit:0});let hair=initial.hair??0,gender=initial.gender??"male",view=0,busy=false;
  const name=find('creationName');name.value=initial.name==='Guest'?'':initial.name??'';
  const look={hairStyle:initial.hairStyle??(gender==='female'?'long':'short'),faceStyle:initial.faceStyle??(gender==='female'?'soft':'classic'),skinTone:initial.skinTone??0},edited=new Set();
  const genderSelect=find('creationGender');genderSelect.value=gender;genderSelect.onchange=()=>{
    gender=genderSelect.value;
    for(const [key,value] of [['hairStyle',gender==='female'?'long':'short'],['faceStyle',gender==='female'?'soft':'classic']]){
      if(!edited.has(key)){look[key]=value;find('creation-'+key).value=value;}
    }
  };
  for(const [key,label,options] of [['hairStyle','Hairstyle',hairStyles],['faceStyle','Face',faceStyles],['skinTone','Skin tone',Object.fromEntries(skinTones.map((label,i)=>[i,label]))]]){
    const field=document.createElement('label'),select=document.createElement('select');select.id='creation-'+key;
    field.htmlFor=select.id;field.textContent=label;
    for(const [value,text] of Object.entries(options)){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
    select.value=look[key];select.onchange=()=>{edited.add(key);look[key]=key==='skinTone'?Number(select.value):select.value;};
    genderSelect.after(field,select);
  }
  const hairSelect=find('creationHair');['Chestnut','Midnight','Copper','Honey','Violet'].forEach((label,index)=>{const option=document.createElement('option');option.value=index;option.textContent=label;hairSelect.append(option);});hairSelect.value=hair;
  for(const [slot,id] of [['jacket','creationJacket'],['trousers','creationTrousers'],['boots','creationBoots']]){
   const select=find(id);for(const [key,item] of Object.entries(clothingCatalog)){if(item.slot!==slot||!wardrobe.owned.includes(key))continue;const option=document.createElement('option');option.value=key;option.textContent=item.name;select.append(option);}select.value=wardrobe.outfits[0][slot];select.onchange=()=>{wardrobe.outfits[0][slot]=select.value;find('creationTrousers').disabled=clothingCatalog[wardrobe.outfits[0].jacket].dress===true;};
  }
  hairSelect.onchange=()=>{hair=Number(hairSelect.value);};find('creationTurn').onclick=()=>{view=(view+1)%4;};
  const options=dialog.querySelector('.creation-options');
  for(const label of [...options.querySelectorAll('label')]){
    const control=find(label.htmlFor),field=document.createElement('div');field.className='creation-field';
    if(control===name)field.classList.add('creation-name');
    options.insertBefore(field,label);field.append(label,control);
  }
  const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function draw(time){if(!dialog.open)return;ctx.clearRect(0,0,300,300);ctx.fillStyle='#22334a';ctx.beginPath();ctx.ellipse(150,265,60,13,0,0,Math.PI*2);ctx.fill();ctx.save();ctx.scale(5,5);renderer.draw(ctx,30,53,outfitAppearance(wardrobe,{hair,gender,...look}),{direction:view===0||view===3?'right':'left',back:view>=2,time,reduced});ctx.restore();requestAnimationFrame(draw);}
  dialog.oncancel=event=>event.preventDefault();
  find('creationForm').onsubmit=async event=>{event.preventDefault();if(busy)return;const trimmed=name.value.trim();if(!trimmed){name.setCustomValidity('Please choose a name.');name.reportValidity();return;}name.setCustomValidity('');busy=true;const controls=[...dialog.querySelectorAll('input,select,button')];controls.forEach(control=>control.disabled=true);find('creationStatus').textContent='Saving your character…';try{await save({avatar:outfitAppearance(wardrobe,{name:trimmed,hair,gender,...look}),wardrobe});dialog.close();dialog.remove();resolve();}catch(error){find('creationStatus').textContent=error.message;controls.forEach(control=>control.disabled=false);busy=false;}};
  name.oninput=()=>name.setCustomValidity('');dialog.showModal();requestAnimationFrame(draw);name.focus();
 });
}
