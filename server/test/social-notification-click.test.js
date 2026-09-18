const test=require('node:test');
const assert=require('node:assert/strict');

test('gameplay class changes preserve invitation buttons through mouse-down and click',async()=>{
  const {createSocialNotifications}=await import('../../client/js/social-notifications.mjs');
  class Element {
    constructor(){this.children=[];this.events={};this.dataset={};this.classes=new Set();this.classList={toggle:(key,on)=>on?this.classes.add(key):this.classes.delete(key)};}
    set innerHTML(value){this.children=[];this.markup=value;}
    append(...nodes){this.children.push(...nodes);}
    appendChild(node){this.children.push(node);}
    setAttribute(){}
    addEventListener(type,handler){this.events[type]=handler;}
    querySelector(){return this.label||(this.label={textContent:''});}
    remove(){}
  }
  const body=new Element(),document={body,createElement:()=>new Element(),getElementById:()=>null},sent=[];
  const notifications=createSocialNotifications({document,storage:null,send:(type,data)=>sent.push({type,data})});
  try{
    notifications.friend({token:'friend',name:'A friend'});
    const stack=body.children[0],card=stack.children[0],button=card.children[2].children[0];
    for(let i=0;i<10;i++)notifications.render();
    assert.equal(stack.children[0],card,'unrelated gameplay refreshes must not replace the card');
    assert.equal(stack.children[0].children[2].children[0],button,'the pressed button survives until click');
    button.events.click({stopPropagation(){}});
    assert.deepEqual(sent,[{type:'friendRespond',data:{targetToken:'friend',accept:true}}]);
    notifications.trade({id:'trade',fromName:'Trader'});
    const trade=stack.children[0];
    notifications.render();
    assert.equal(stack.children[0],trade);
    assert.ok(stack.events.pointerdown&&stack.events.mousedown,'social surfaces isolate clicks from world controls');
  }finally{notifications.destroy();}
});
