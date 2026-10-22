/* Saved scenes remain local; exporting is explicit. Sending to ESP32 is separate. */
(function(){
  const KEY='SkellyStudio-scenes-v1';let scenes=[],rotate=false;
  function validateLibrary(value,g){
    if(!value||value.app!=='SkellyScenes'||value.version!==1||typeof value.rotate!=='boolean'||!Array.isArray(value.scenes)||value.scenes.length>4)throw Error('Choose a supported scene library (up to four scenes).');
    const names=new Set();
    const entries=value.scenes.map(s=>{
      if(typeof s.name!=='string'||!s.name.trim()||s.name.length>32||/[\x00-\x1f]/.test(s.name)||names.has(s.name.trim()))throw Error('Scene names must be unique, with 1–32 characters.');
      if(!Number.isInteger(s.seconds)||s.seconds<60||s.seconds>3600)throw Error('Scene duration must be 60–3600 seconds.');names.add(s.name.trim());
      const profile=g.parseProfile(JSON.stringify(s.profile));return {name:s.name.trim(),seconds:s.seconds,profile};
    });
    return {app:'SkellyScenes',version:1,rotate:value.rotate,scenes:entries};
  }
  const api={validateLibrary,program:()=>({scenes:scenes.map(s=>({name:s.name,seconds:s.seconds,config:s.profile.config})),rotate}),snapshot:()=>JSON.parse(JSON.stringify({app:'SkellyScenes',version:1,rotate,scenes}))};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window==='undefined')return;window.SkellyScenes=api;
  document.addEventListener('DOMContentLoaded',()=>{
    const g=window.SkellyStudioGenerator,el=id=>document.getElementById(id),message=s=>el('sceneMessage').textContent=s;
    function persist(){try{localStorage.setItem(KEY,JSON.stringify(api.snapshot()));}catch(_){message('Scenes are available this session. Export a copy; browser storage is unavailable.');}}
    function render(){el('sceneRotate').checked=rotate;const list=el('sceneList');list.replaceChildren();
      for(const [index,s] of scenes.entries()){const row=document.createElement('div');row.className='saved-scene';const label=document.createElement('strong');label.textContent=s.name+' · '+s.seconds+' sec';
        const load=document.createElement('button');load.type='button';load.textContent='Load';load.setAttribute('aria-label','Load scene '+s.name);load.onclick=()=>{g.writeLibrary(s.profile.clips);g.writeConfig(s.profile.config);for(const b of document.querySelectorAll('.preset'))b.classList.remove('chosen');el('sceneName').value=s.name;el('sceneSeconds').value=s.seconds;message('Loaded '+s.name+'. Changes stay in Studio until you save to the controller.');};
        const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.setAttribute('aria-label','Remove scene '+s.name);remove.onclick=()=>{scenes.splice(index,1);persist();render();message('Scene removed from this browser.');};row.append(label,load,remove);list.append(row);}
      el('sceneDownload').disabled=!scenes.length;el('sceneExport').disabled=!scenes.length;
    }
    function importValue(v){const parsed=validateLibrary(v,g);scenes=parsed.scenes;rotate=parsed.rotate;render();}
    api.loadProgram=program=>{importValue({app:'SkellyScenes',version:1,rotate:program.rotate,scenes:program.scenes.map(s=>({name:s.name,seconds:s.seconds,profile:JSON.parse(g.createProfile(s.config,{}))}))});persist();};
    try{const stored=localStorage.getItem(KEY);if(stored){importValue(JSON.parse(stored));message(scenes.length+' saved scenes loaded.');}}catch(_){message('Saved scenes could not be read. You can import an exported copy.');}
    el('sceneSave').onclick=()=>{try{const name=el('sceneName').value.trim(),seconds=Number(el('sceneSeconds').value),profile=JSON.parse(g.createProfile(g.readConfig(),g.readLibrary()));const next=api.snapshot(),index=next.scenes.findIndex(s=>s.name===name);if(index<0)next.scenes.push({name,seconds,profile});else next.scenes[index]={name,seconds,profile};importValue(next);persist();message('Saved '+name+' in this browser.');}catch(e){message(e.message);}};
    el('sceneRotate').onchange=()=>{rotate=el('sceneRotate').checked;persist();};
    el('sceneExport').onclick=()=>g.downloadText(JSON.stringify(api.snapshot(),null,2),'Skelly-scenes.json','application/json');
    el('sceneImport').onclick=()=>el('sceneFile').click();el('sceneFile').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>262144)throw Error('Choose a scene library smaller than 256 KB.');importValue(JSON.parse(await f.text()));persist();message('Scene library imported.');}catch(err){message(err.message);}finally{e.target.value='';}};
    el('sceneDownload').onclick=()=>{try{const p=api.program();g.downloadText(g.generateRuntimeSketch(p.scenes,p.rotate),'SkellyScenes.ino','text/plain');message('Scene routine downloaded. Saved USB settings take priority until reset to firmware defaults.');}catch(e){message(e.message);}};
    render();
  });
})();
