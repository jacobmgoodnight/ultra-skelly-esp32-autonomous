const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const model=require('../scene-model.js'),runtime=require('../runtime.js'),root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const generatorContext=vm.createContext({window:{}});for(const f of ['template.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),generatorContext);const generator=generatorContext.window.SkellyStudioGenerator;
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();Object.assign(this,{value:'',textContent:'',children:[],dataset:{},style:{},disabled:false,hidden:false,open:false,checked:false,events:{},attrs:{}});this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name),remove:name=>this.classes.delete(name)};}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attrs[k]=v;}focus(){this.focused=true;}addEventListener(n,fn){(this.events[n]??=[]).push(fn);}removeEventListener(n,fn){this.events[n]=this.events[n].filter(f=>f!==fn);}
 showModal(){this.open=true;}close(value){if(value!==undefined)this.returnValue=value;this.open=false;for(const fn of [...this.events.close||[]])fn();}
 querySelectorAll(selector){const nodes=this.children.flatMap(n=>[n,...n.querySelectorAll(selector)]);return nodes.filter(n=>selector==='button'?n.tagName==='BUTTON':selector==='.scene-card'?n.className==='scene-card':false);}querySelector(s){return this.querySelectorAll(s)[0];}
}
function page({storage=new Map(),blocked=false}={}){
 const nodes={};for(const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const e=new Element(match[1]);e.value=/\bvalue="([^"]*)"/.exec(match[2])?.[1]||'';nodes[match[3]]=e;}
 const starters=['moonlit','haunted','ember'].map(key=>{const e=new Element('button');e.dataset.sceneStarter=key;e.textContent=key;return e;});
 const events={},windowEvents={},timers=new Map();let timerId=0,config={...generator.DEFAULTS},clips={},answer=true,confirmed=0;
 const document={getElementById:id=>{assert.ok(nodes[id],id);return nodes[id];},createElement:tag=>new Element(tag),querySelectorAll:s=>s==='[data-scene-starter]'?starters:s==='[data-scene-index]'?nodes.sceneList.children:[],addEventListener:(name,fn)=>(events[name]??=[]).push(fn),dispatchEvent:event=>{for(const fn of events[event.type]||[])fn(event);}};
 const g={...generator,readConfig:()=>config,readLibrary:()=>clips,writeLibrary:v=>clips=v,writeConfig:c=>{config={...config,...c};document.dispatchEvent({type:'skelly-config-changed'});},downloadText:()=>{}};
 nodes.sceneConfirmDialog.showModal=function(){this.open=true;confirmed++;Promise.resolve().then(()=>this.close(answer?'continue':'cancel'));};
 nodes.sceneStarterScope.value='complete';
 const window={SkellySceneModel:model,SkellyLooks:require('../looks.js'),SkellyStudioGenerator:g,SkellyRuntime:runtime,confirm:()=>{throw Error('Use the Studio confirmation dialog.');},addEventListener:(name,fn)=>windowEvents[name]=fn};
 const localStorage={getItem:key=>{if(blocked)throw Error('blocked');return storage.get(key)||null;},setItem:(key,value)=>{if(blocked)throw Error('blocked');storage.set(key,value);},removeItem:key=>{if(blocked)throw Error('blocked');storage.delete(key);}};
 const context=vm.createContext({window,document,localStorage,CustomEvent:class{constructor(type){this.type=type;}},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(fs.readFileSync(path.join(root,'scenes.js'),'utf8'),context);document.dispatchEvent({type:'DOMContentLoaded'});
 return {nodes,starters,api:window.SkellyScenes,storage,get config(){return config;},get confirmed(){return confirmed;},set answer(v){answer=v;},change(values){Object.assign(config,values);document.dispatchEvent({type:'skelly-config-changed'});},name(value){nodes.sceneName.value=value;document.dispatchEvent({type:'skelly-config-changed'});},click(label){const b=nodes.sceneList.querySelectorAll('button').find(b=>b.attrs['aria-label']===label);assert.ok(b,label);return b.onclick();},flush(){const pending=[...timers.values()];timers.clear();for(const fn of pending)fn();},beforeUnload(){let prevented=false;windowEvents.beforeunload({preventDefault(){prevented=true;}});return prevented;}};
}
test('scene cards explicitly add/update, reject duplicate names, and keep saved settings separate from edits',()=>{
 const p=page();p.nodes.sceneSave.onclick();assert.equal(p.api.snapshot().scenes.length,1);assert.match(p.nodes.editorStatus.textContent,/No unsaved/);
 p.change({headMin:40});assert.match(p.nodes.editorStatus.textContent,/Unsaved/);assert.equal(p.api.snapshot().scenes[0].profile.config.headMin,35);
 p.nodes.sceneSave.onclick();assert.match(p.nodes.sceneMessage.textContent,/unique/);assert.equal(p.api.snapshot().scenes.length,1);
 p.nodes.sceneUpdate.onclick();assert.equal(p.api.snapshot().scenes[0].profile.config.headMin,40);assert.match(p.nodes.sceneMessage.textContent,/not been sent/);
 p.change({headMin:1});p.nodes.sceneUpdate.onclick();assert.equal(p.api.snapshot().scenes[0].profile.config.headMin,40);assert.match(p.nodes.editorStatus.textContent,/Unsaved/);
});
test('new complete looks are recoverable drafts even before their first edit and loading another scene asks first',async()=>{
 const p=page();p.nodes.sceneSave.onclick();await p.starters[0].onclick();p.flush();assert.ok(p.storage.has('SkellyStudio-draft-v1'));assert.match(p.nodes.editorStatus.textContent,/Unsaved/);
 p.answer=false;await p.click('Edit scene My spooky Skelly');assert.equal(p.config.lightsEnabled,true);assert.equal(p.confirmed,1);
 p.answer=true;await p.click('Edit scene My spooky Skelly');assert.equal(p.config.lightsEnabled,false);assert.match(p.nodes.editorStatus.textContent,/No unsaved/);
});
test('appearance-only starters preserve the edited scene, timing, mouth and movement',async()=>{
 const p=page();p.nodes.sceneSave.onclick();p.nodes.sceneStarterScope.value='appearance';p.nodes.sceneMinutes.value='17';
 const before={...p.config};await p.starters[1].onclick();
 assert.equal(p.nodes.sceneName.value,'My spooky Skelly');assert.equal(p.nodes.sceneMinutes.value,'17');
 for(const key of ['headMin','headMax','armEnabled','torsoEnabled','compoundEnabled','jawEnabled','eyeJawMode','jawProtectBody','clockEnabled','restEnabled'])assert.equal(p.config[key],before[key],key);
 assert.equal(p.config.lightsEnabled,true);assert.equal(p.config.eyesEnabled,true);assert.equal(p.confirmed,0);
 assert.match(p.nodes.editorStatus.textContent,/Unsaved/);assert.equal(p.api.snapshot().scenes[0].profile.config.lightsEnabled,false);
 p.nodes.sceneUpdate.onclick();assert.equal(p.api.snapshot().scenes[0].seconds,1020);assert.equal(p.api.snapshot().scenes[0].profile.config.lightsEnabled,true);
});
test('sequence strip follows saved duration, order and starting scene without including drafts',()=>{
 const p=page();p.nodes.sceneSave.onclick();p.name('Late');p.nodes.sceneMinutes.value='12';p.nodes.sceneSave.onclick();
 assert.equal(p.nodes.sceneStrip.children.length,2);assert.match(p.nodes.sceneStrip.children[0].children[0].textContent,/Starts here/);assert.match(p.nodes.sceneStrip.children[1].children[0].textContent,/12 min/);
 p.nodes.sceneMinutes.value='20';p.change({headMin:40});assert.match(p.nodes.sceneStrip.children[1].children[0].textContent,/12 min/);
 p.nodes.sceneRotate.checked=true;p.nodes.sceneRotate.onchange();assert.match(p.nodes.sceneStripNote.textContent,/22 minutes/);
 p.nodes.sceneOrder.value='random';p.nodes.sceneOrder.onchange();assert.match(p.nodes.sceneStrip.children[1].children[0].textContent,/Random choice/);assert.doesNotMatch(p.nodes.sceneStripNote.textContent,/22 minutes/);
});
test('draft restore retains the saved scene baseline and invalid edits never replace a valid recovery snapshot',async()=>{
 const storage=new Map(),p=page({storage});p.nodes.sceneSave.onclick();p.change({headMin:40});p.flush();const valid=storage.get('SkellyStudio-draft-v1');p.change({headMin:1});p.flush();assert.equal(storage.get('SkellyStudio-draft-v1'),valid);assert.equal(p.beforeUnload(),true);
 const reopened=page({storage});assert.equal(reopened.nodes.draftRecovery.hidden,false);await reopened.nodes.draftRestore.onclick();assert.equal(reopened.config.headMin,40);assert.match(reopened.nodes.editorStatus.textContent,/Unsaved/);assert.equal(reopened.api.snapshot().scenes[0].profile.config.headMin,35);
 await reopened.nodes.sceneRevert.onclick();assert.equal(reopened.config.headMin,35);assert.match(reopened.nodes.editorStatus.textContent,/No unsaved/);
});
test('import preview cancellation including Escape cannot reuse an earlier Replace decision',async()=>{
 const p=page();p.nodes.sceneSave.onclick();const original=p.api.snapshot();const program={scenes:[{name:'From ESP32',seconds:600,config:{...p.config}}],rotate:false,random:false};
 const first=p.api.loadProgram(program);assert.equal(p.nodes.sceneImportDialog.open,true);assert.match(p.nodes.sceneImportNotice.textContent,/Replace 1/);p.nodes.sceneImportDialog.close('replace');assert.equal(await first,true);assert.equal(p.api.snapshot().scenes[0].name,'From ESP32');
 const second=p.api.loadProgram({...program,scenes:[{...program.scenes[0],name:'Other'}]});p.nodes.sceneImportDialog.close();assert.equal(await second,false);assert.equal(p.api.snapshot().scenes[0].name,'From ESP32');assert.equal(original.scenes[0].name,'My spooky Skelly');
});
test('rename, reorder, delete and Undo retain the selected scene and edited name',()=>{
 const p=page();p.nodes.sceneSave.onclick();p.name('Second');p.nodes.sceneSave.onclick();p.name('Unfinished name');p.click('Rename scene Second');p.nodes.sceneRenameInput.value='Renamed';p.nodes.sceneRenameForm.onsubmit({preventDefault(){}});assert.equal(p.nodes.sceneName.value,'Unfinished name');
 p.click('Move scene Renamed up');p.nodes.sceneUpdate.onclick();assert.equal(p.api.snapshot().scenes[0].name,'Unfinished name');p.click('Delete scene Unfinished name');assert.equal(p.api.snapshot().scenes.length,1);assert.equal(p.nodes.sceneUndo.focused,true);p.nodes.sceneUndo.onclick();assert.equal(p.api.snapshot().scenes.length,2);assert.equal(p.api.snapshot().scenes[0].name,'Unfinished name');
});
test('verified controller status compares only the acknowledged snapshot and disconnect clears comparison',async()=>{
 const p=page(),port={};p.nodes.sceneSave.onclick();p.api.usbState(port);p.api.recordController(p.api.program(),'scenes');assert.match(p.nodes.deviceSaveStatus.textContent,/library matches/);
 p.change({headMin:40});assert.match(p.nodes.deviceSaveStatus.textContent,/editor changes are not in it/);p.answer=false;assert.equal(await p.api.confirmSendScenes(),false);
 p.nodes.sceneUpdate.onclick();assert.match(p.nodes.deviceSaveStatus.textContent,/not been sent/);p.api.usbState(null);assert.match(p.nodes.deviceSaveStatus.textContent,/connect and read/);
});

test('USB comparison stays beside save controls and never implies an unobserved save',()=>{
 const p=page();assert.match(p.nodes.deviceSaveStatus.textContent,/connect and read/);assert.equal(p.nodes.deviceSaveStatus.dataset.state,'info');
 p.api.usbState({});const config={...p.config};p.api.recordController({scenes:[{name:'Routine',seconds:600,config}],rotate:false},'routine');
 assert.equal(p.nodes.deviceSaveStatus.dataset.state,'ready');assert.equal(p.nodes.routineSaveStatus,undefined);
 p.change({headMin:40});assert.equal(p.nodes.deviceSaveStatus.dataset.state,'changed');assert.match(p.nodes.deviceSaveStatus.textContent,/not been sent/);
 p.change({headMin:config.headMin});assert.equal(p.nodes.deviceSaveStatus.dataset.state,'ready');
 p.api.usbState(null);assert.equal(p.nodes.deviceSaveStatus.dataset.state,'info');assert.match(p.nodes.deviceSaveStatus.textContent,/connect and read/);
});
test('unavailable browser storage is visible and never claims a durable library or draft',()=>{
 const p=page({blocked:true});p.nodes.sceneSave.onclick();assert.match(p.nodes.browserSaveStatus.textContent,/session only/);assert.match(p.nodes.sceneMessage.textContent,/session only/);assert.equal(p.beforeUnload(),true);
 p.change({headMin:40});p.flush();assert.match(p.nodes.draftStatus.textContent,/needs valid settings and browser storage/);
});

test('reverting an initial unsaved edit returns to a clean new-scene baseline',async()=>{
 const p=page();p.change({headMin:40});await p.nodes.sceneRevert.onclick();assert.equal(p.config.headMin,35);assert.doesNotMatch(p.nodes.editorStatus.textContent,/Unsaved changes/);assert.equal(p.nodes.sceneRevert.disabled,true);
});

test('an empty imported library replaces an invalid editor with a valid new-scene baseline',async()=>{
 const p=page();p.nodes.sceneSave.onclick();p.change({headMin:1});const pending=p.api.loadProgram({scenes:[],rotate:false,random:false});p.nodes.sceneImportDialog.close('replace');assert.equal(await pending,true);assert.equal(p.api.snapshot().scenes.length,0);assert.equal(p.config.headMin,35);
});

test('routine preview follows saved scenes rather than unfinished editor changes',()=>{
 const p=page();p.nodes.sceneSave.onclick();const initial=p.nodes.sceneSequence.children[0];
 assert.equal(initial.children[0].children[0].textContent,'My spooky Skelly');assert.match(initial.children[1].children[0].textContent,/Head · 35–75/);
 p.change({headMin:80,headMax:90});assert.match(p.nodes.sceneSequence.children[0].children[1].children[0].textContent,/35–75/);
 p.nodes.sceneUpdate.onclick();assert.match(p.nodes.sceneSequence.children[0].children[1].children[0].textContent,/80–90/);
 p.name('Second');p.nodes.sceneSave.onclick();assert.match(p.nodes.sceneSequence.children[0].className,/is-inactive/);p.nodes.sceneRotate.checked=true;p.nodes.sceneRotate.onchange();p.nodes.sceneOrder.value='random';p.nodes.sceneOrder.onchange();assert.match(p.nodes.sceneSequence.children[0].children[0].children[1].textContent,/Random choice/);
});


test('compact preview selector preserves the library, unsaved editor and selection through rename/reorder/delete',()=>{
 const p=page();assert.equal(p.nodes.scenePreviewSelect.disabled,true);p.nodes.sceneSave.onclick();p.name('Second');p.nodes.sceneSave.onclick();
 assert.equal(p.nodes.sceneSequence.children.length,1);assert.equal(p.nodes.scenePreviewSelect.children.length,2);assert.equal(p.nodes.scenePreviewSelect.value,'Second');
 p.change({headMin:80,headMax:90});const before=JSON.stringify(p.api.snapshot());p.nodes.scenePreviewSelect.value='My spooky Skelly';p.nodes.scenePreviewSelect.onchange();
 assert.equal(JSON.stringify(p.api.snapshot()),before);assert.equal(p.config.headMin,80);assert.match(p.nodes.editorStatus.textContent,/Unsaved/);assert.equal(p.nodes.sceneSequence.children[0].children[0].children[0].textContent,'My spooky Skelly');
 p.click('Rename scene My spooky Skelly');p.nodes.sceneRenameInput.value='First';p.nodes.sceneRenameForm.onsubmit({preventDefault(){}});assert.equal(p.nodes.scenePreviewSelect.value,'First');
 p.click('Move scene First down');assert.equal(p.nodes.scenePreviewSelect.value,'First');p.click('Delete scene First');assert.equal(p.nodes.scenePreviewSelect.value,'Second');assert.equal(p.nodes.sceneSequence.children.length,1);
 const card=p.nodes.sceneList.children[0];assert.equal(card.children[0].querySelector('button').textContent,'Edit');assert.equal(card.children.at(-1).tagName,'DETAILS');assert.equal(card.children.at(-1).open,false);
 p.click('Delete scene Second');assert.equal(p.nodes.scenePreviewSelect.disabled,true);assert.equal(p.nodes.sceneSequence.children.length,0);p.nodes.sceneUndo.onclick();assert.equal(p.nodes.sceneSequence.children.length,1);
});
