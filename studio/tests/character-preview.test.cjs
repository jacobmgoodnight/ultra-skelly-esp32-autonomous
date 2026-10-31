const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('preview is explicit, cancels on hide, and only displays simulated cues',()=>{
 let next=0;const timers=new Map(),handlers={},select={value:'friendly',disabled:false,addEventListener(k,f){this[k]=f;}},button={disabled:false,addEventListener(k,f){this[k]=f;}},status={textContent:''};
 const root={querySelector(s){return s==='select'?select:s==='button'?button:status;}};
 const document={hidden:false,getElementById:()=>root,addEventListener(k,f){handlers[k]=f;}};
 const context={document,window:{SkellyCharacterDirector:require('../character-director.js')},setTimeout(fn){const id=++next;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../character-preview.js'),'utf8'),context);
 assert.match(status.textContent,/Watching/);assert.equal(timers.size,0);
 button.click();assert.match(status.textContent,/Greet/);assert.equal(timers.size,1);assert.equal(select.disabled,true);
 const late=[...timers.values()][0];document.hidden=true;handlers.visibilitychange();assert.equal(timers.size,0);assert.equal(select.disabled,false);assert.match(status.textContent,/Watching/);
 late();assert.match(status.textContent,/Watching/);assert.equal(timers.size,0);
 select.value='guardian';select.change();assert.match(status.textContent,/Haunted Guardian/);
});
