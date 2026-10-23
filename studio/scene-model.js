/* Browser editing model. Export/USB scene formats stay version 1. */
(function(){
  'use strict';
  const clone=value=>JSON.parse(JSON.stringify(value));
  function validateLibrary(value,g){
    if(!value||value.app!=='SkellyScenes'||value.version!==1||typeof value.rotate!=='boolean'||!Array.isArray(value.scenes)||value.scenes.length>4)throw Error('Choose a supported scene library (up to four scenes).');
    if(value.random!==undefined&&typeof value.random!=='boolean')throw Error('Choose a supported scene order.');
    const names=new Set();
    const scenes=value.scenes.map(s=>{
      if(typeof s.name!=='string'||!s.name.trim()||s.name.length>32||/[\x00-\x1f]/.test(s.name)||names.has(s.name.trim()))throw Error('Scene names must be unique, with 1–32 characters.');
      if(!Number.isInteger(s.seconds)||s.seconds<60||s.seconds>3600)throw Error('Scene duration must be 60–3600 seconds.');names.add(s.name.trim());
      return {name:s.name.trim(),seconds:s.seconds,profile:g.parseProfile(JSON.stringify(s.profile))};
    });
    return {app:'SkellyScenes',version:1,rotate:value.rotate,random:value.random??false,scenes};
  }
  function minutesToSeconds(minutes){if(!Number.isFinite(minutes)||minutes<1||minutes>60)throw Error('Scene duration must be 1–60 minutes.');return Math.round(minutes*60);}
  class SceneLibrary {
    constructor(g,value={app:'SkellyScenes',version:1,rotate:false,random:false,scenes:[]}){this.g=g;this.value=validateLibrary(value,g);this.editing=null;this.undoEntry=null;}
    snapshot(){return clone(this.value);}
    commit(next,editing=this.editing,label='Change'){
      const valid=validateLibrary(next,this.g);this.undoEntry={value:this.snapshot(),editing:this.editing,label};this.value=valid;this.editing=editing;return this.snapshot();
    }
    add(scene){const next=this.snapshot();next.scenes.push(scene);this.commit(next,next.scenes.length-1,'Add scene');}
    update(scene){if(this.editing===null)throw Error('Choose a scene to edit first.');const next=this.snapshot();next.scenes[this.editing]=scene;this.commit(next,this.editing,'Update scene');}
    rename(index,name){const next=this.snapshot();if(!next.scenes[index])throw Error('Choose a saved scene.');next.scenes[index].name=name;this.commit(next,this.editing,'Rename scene');}
    duplicate(index){
      const next=this.snapshot(),scene=next.scenes[index];if(!scene)throw Error('Choose a saved scene.');
      let n=2,name;do{name=scene.name.slice(0,27)+' '+n++;}while(next.scenes.some(s=>s.name===name));
      next.scenes.splice(index+1,0,{...clone(scene),name});const editing=this.editing!==null&&this.editing>index?this.editing+1:this.editing;this.commit(next,editing,'Duplicate scene');
    }
    move(index,delta){
      const next=this.snapshot(),target=index+delta;if(!next.scenes[index]||target<0||target>=next.scenes.length)return false;
      [next.scenes[index],next.scenes[target]]=[next.scenes[target],next.scenes[index]];
      const editing=this.editing===index?target:this.editing===target?index:this.editing;this.commit(next,editing,'Reorder scenes');return true;
    }
    remove(index){const next=this.snapshot();if(!next.scenes[index])throw Error('Choose a saved scene.');next.scenes.splice(index,1);this.commit(next,this.editing===index?null:this.editing!==null&&this.editing>index?this.editing-1:this.editing,'Delete scene');}
    undo(){if(!this.undoEntry)return false;const saved=this.undoEntry;this.value=saved.value;this.editing=saved.editing;this.undoEntry=null;return true;}
    program(){return {scenes:this.value.scenes.map(s=>({name:s.name,seconds:s.seconds,config:clone(s.profile.config)})),rotate:this.value.rotate,random:this.value.random};}
  }
  function editorKey(value){return JSON.stringify(value);}
  function parseDraft(text,g){
    if(typeof text!=='string'||text.length>262144)throw Error('Draft is too large.');const d=JSON.parse(text);
    if(d?.app!=='SkellyDraft'||d.version!==1)throw Error('Unsupported draft.');
    function entry(v){
      if(!v||typeof v.name!=='string'||v.name.length>32||/[\x00-\x1f]/.test(v.name)||!Number.isInteger(v.seconds)||v.seconds<60||v.seconds>3600)throw Error('Invalid draft.');
      return {name:v.name,seconds:v.seconds,profile:g.parseProfile(JSON.stringify(v.profile))};
    }
    const current=entry(d.current),baseline=entry(d.baseline);
    const editing=Number.isInteger(d.editing)&&d.editing>=0&&d.editing<4?d.editing:null;
    return {app:'SkellyDraft',version:1,current,baseline,pendingNew:typeof d.pendingNew==='boolean'?d.pendingNew:editing===null,editing,sceneKey:typeof d.sceneKey==='string'&&d.sceneKey.length<65536?d.sceneKey:null};
  }
  function timingNotes(c,seconds){
    const notes=[];
    const parts=c.compoundEnabled&&!c.compoundAlongside?[]:['head','arm','torso'];
    if(c.compoundEnabled)parts.push('compound');
    for(const part of parts)if(c[part+'Enabled']&&c[part+'Max']>=seconds)notes.push((part==='compound'?'Combined':part[0].toUpperCase()+part.slice(1))+' may not run before this scene ends.');
    return notes;
  }
  function sceneSummary(c){
    const motors=['head','arm','torso'].filter(k=>c[k+'Enabled']).map(k=>k[0].toUpperCase()+k.slice(1));
    return {motors:(motors.join(' + ')||'No body movement')+(c.jawEnabled&&c.eyeJawMode===3?' · Audio #'+c.jawFile:''),eyes:c.eyesEnabled?(c.eyeChoices.length===1?'Fixed eye #'+c.eyeChoices[0]:c.eyeChoices.length+' random eyes'):'Stored eyes',lights:c.lightsEnabled?(c.lightRotation?c.lightPalettes.length+' rotating palettes':'Selected colors'):'Stored lights'};
  }
  function routinePreview(value,g){
    return value.scenes.map((scene,index)=>{
      const c=scene.profile.config,events=g.simulateSchedule(c,0x582A+index,scene.seconds),kinds=[];
      if(!c.compoundEnabled||c.compoundAlongside)for(const kind of ['head','arm','torso'])if(c[kind+'Enabled'])kinds.push(kind);
      if(c.compoundEnabled)kinds.push('compound');
      if(c.eyesEnabled&&c.eyeChoices.length>1)kinds.push('eyes');
      if(c.lightsEnabled&&c.lightRotation)kinds.push('lights');
      if(c.jawEnabled)kinds.push('jaw');
      return {name:scene.name,seconds:scene.seconds,inactive:!value.rotate&&index>0,
        position:index===0?'Starts here':!value.rotate?'Switching off':value.random?'Random choice':'Next in order',
        lanes:kinds.map(kind=>({kind,label:kind==='jaw'&&c.eyeJawMode===3?'Audio #'+c.jawFile:undefined,min:kind==='lights'?c.lightInterval:c[kind+'Min'],max:kind==='lights'?c.lightInterval:c[kind+'Max'],ticks:Array.from(events.filter(e=>e.kind===kind),e=>e.time)}))};
    });
  }
  function starter(key,g,connection={}){
    const looks={moonlit:{name:'Moonlit Watcher',preset:'subtle',palette:'moonlight',eyes:[8],effect:1},haunted:{name:'Haunted Porch',preset:'haunted',palette:'haunted',eyes:[1,2,3,4,5,6,7,8],effect:3},ember:{name:'Ember Glow',preset:'normal',palette:'ember',eyes:[4],effect:3}};
    const look=looks[key];if(!look)throw Error('Choose a scene starting point.');
    const target=Object.fromEntries(['bleName','scanRetrySec','startupRetrySec','startupWindowSec'].filter(k=>connection[k]!==undefined).map(k=>[k,connection[k]]));
    const config={...clone(g.DEFAULTS),...clone(g.PRESETS[look.preset]),...g.paletteSettings(look.palette),...target,eyesEnabled:true,eyeChoices:look.eyes,torsoEffect:look.effect,headEffect:look.effect,torsoBrightness:255,headBrightness:255,torsoSpeed:125,headSpeed:125,clockEnabled:false,restEnabled:false,jawEnabled:false};
    return {name:look.name,seconds:600,profile:JSON.parse(g.createProfile(config,{}))};
  }
  const api={SceneLibrary,validateLibrary,minutesToSeconds,editorKey,parseDraft,timingNotes,sceneSummary,routinePreview,starter};
  if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.SkellySceneModel=api;
})();
