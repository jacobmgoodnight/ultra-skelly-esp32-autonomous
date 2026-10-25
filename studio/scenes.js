/* Scene cards, recoverable editor drafts and explicit browser/device saving. */
(function(){
  'use strict';
  const m=typeof module!=='undefined'?require('./scene-model.js'):window.SkellySceneModel;
  if(typeof module!=='undefined')module.exports={validateLibrary:m.validateLibrary,minutesToSeconds:m.minutesToSeconds};
  if(typeof window==='undefined')return;
  const api={};window.SkellyScenes=api;
  document.addEventListener('DOMContentLoaded',()=>{
    const g=window.SkellyStudioGenerator,el=id=>document.getElementById(id),KEY='SkellyStudio-scenes-v1',DRAFT='SkellyStudio-draft-v1';
    let library=new m.SceneLibrary(g),libraryStored=true,baseline=null,pendingNew=false,loading=false,draftTimer=null,recovery=null,draftStored=false,verified=null,usbPort=null,previewName=null;
    const message=text=>el('sceneMessage').textContent=text;
    const same=(a,b)=>m.editorKey(a)===m.editorKey(b);
    const entry=()=>({name:el('sceneName').value.trim(),seconds:m.minutesToSeconds(Number(el('sceneMinutes').value)),profile:JSON.parse(g.createProfile(g.readConfig(),g.readLibrary()))});
    function edited(){try{return !same(entry(),baseline);}catch(_){return true;}}
    function dirty(){return pendingNew||edited();}
    function persist(){try{localStorage.setItem(KEY,JSON.stringify(library.snapshot()));libraryStored=true;return true;}catch(_){libraryStored=false;message('Scene library is available this session only. Export a copy.');return false;}}
    function clearDraft(){clearTimeout(draftTimer);draftTimer=null;draftStored=false;if(!recovery)try{localStorage.removeItem(DRAFT);}catch(_){} }
    function saveDraft(){
      if(recovery||loading||!dirty())return;
      try{
        const index=library.editing,draft={app:'SkellyDraft',version:1,current:entry(),baseline,pendingNew,editing:index,sceneKey:index===null?null:m.editorKey(library.value.scenes[index])};
        localStorage.setItem(DRAFT,JSON.stringify(m.parseDraft(JSON.stringify(draft),g)));draftStored=true;el('draftStatus').textContent='Draft saved on this browser.';
      }catch(_){draftStored=false;el('draftStatus').textContent='Draft needs valid settings and browser storage. Export working settings before closing.';}
    }
    function checkpoint(){baseline=entry();clearDraft();renderEditor();}
    function ask(text){
      const dialog=el('sceneConfirmDialog');if(dialog.open)return Promise.resolve(false);el('sceneConfirmText').textContent=text;dialog.returnValue='';dialog.showModal();
      return new Promise(resolve=>{const close=()=>{dialog.removeEventListener('close',close);resolve(dialog.returnValue==='continue');};dialog.addEventListener('close',close);});
    }
    async function confirmReplace(label){return !dirty()||await ask(label+' Discard the current unsaved editor changes? Saved scenes are unchanged.');}
    function applyEditor(scene,index=null){
      const changedModel=(g.readConfig().deviceId??'ultra')!==(scene.profile.config.deviceId??'ultra');
      loading=true;library.editing=index;previewName=index===null?previewName:scene.name;pendingNew=index===null;el('sceneName').value=scene.name;el('sceneMinutes').value=Number((scene.seconds/60).toFixed(4));
      g.writeLibrary(scene.profile.clips,scene.profile.audio);g.writeConfig({...scene.profile.config,deviceId:scene.profile.config.deviceId??'ultra'});for(const b of document.querySelectorAll('.preset')){b.classList.remove('chosen');b.setAttribute('aria-pressed','false');}loading=false;checkpoint();renderLibrary();el('sceneName').focus();
      if(changedModel)message('Warning: loaded settings change the selected device model to '+(scene.profile.config.deviceId==='skelly12'?'2026 12-foot — Experimental / Not Hardware Tested.':'6.5-foot Ultra Skelly v2.'));
    }
    function wireKey(program){return JSON.stringify(window.SkellyRuntime.encode(program.scenes,program.rotate,g.validate,program.random));}
    function renderDevice(){
      let text=!usbPort?'ESP32 · connect and read to compare':'ESP32 · read saved settings to compare';
      let tone='info';
      if(verified){
        try{
          const matches=verified.kind==='routine'?wireKey({...verified.program,scenes:[{...verified.program.scenes[0],config:g.readConfig()}]})===verified.key:wireKey(library.program())===verified.key;
          text=matches?(verified.kind==='routine'?'ESP32 · current routine matches verified settings':'ESP32 · scene library matches verified settings'):'ESP32 · changes have not been sent';
          if(matches&&verified.kind!=='routine'&&dirty())text='ESP32 · library verified; editor changes are not in it';
          tone=matches&&(verified.kind==='routine'||!dirty())?'ready':'changed';
        }catch(_){text='ESP32 · editor changes have not been sent';tone='changed';}
      }
      const node=el('deviceSaveStatus');if(node.textContent!==text)node.textContent=text;node.dataset.state=tone;
      if(!verified&&el('sceneMessage').textContent==='ESP32 settings read-back verified. See the comparison above.')message('ESP32 comparison cleared. Read or save settings to verify again.');
    }
    function renderEditor(){
      if(loading||!baseline)return;const changed=dirty(),index=library.editing;
      el('editorStatus').textContent=(index===null?'New scene · not saved to library':'Editing '+library.value.scenes[index].name)+(changed?' · Unsaved changes':index===null?'':' · No unsaved changes');
      el('sceneUpdate').disabled=index===null||!edited();el('sceneRevert').disabled=!edited();el('sceneSave').disabled=library.value.scenes.length>=4;
      el('browserSaveStatus').textContent='Browser library · '+library.value.scenes.length+' of 4 scenes'+(libraryStored?'':' · session only; export a copy');
      if(!changed){el('draftStatus').textContent=recovery?'A previous draft is available below.':'Edits stay here until saved as a scene or sent to the ESP32.';clearTimeout(draftTimer);draftTimer=null;}
      else if(!recovery){draftStored=false;el('draftStatus').textContent='Saving editor draft…';clearTimeout(draftTimer);draftTimer=setTimeout(saveDraft,400);}
      for(const row of document.querySelectorAll('[data-scene-index]'))row.classList.toggle('is-editing',Number(row.dataset.sceneIndex)===index);
      renderDevice();
    }
    const make=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
    function action(text,label,fn,disabled=false){const b=make('button',text);b.type='button';b.setAttribute('aria-label',label);b.disabled=disabled;b.onclick=()=>{try{const result=fn();return result?.catch?.(e=>message(e.message));}catch(e){message(e.message);}};return b;}
    function renderLibrary(){
      const value=library.value,list=el('sceneList');list.replaceChildren();
      if(value.scenes.length&&el('sceneMessage').textContent==='No custom scenes saved.')message(value.scenes.length+' scenes loaded from this browser.');
      value.scenes.forEach((s,index)=>{
        const row=make('article',undefined,'scene-card');row.dataset.sceneIndex=String(index);row.classList.toggle('is-editing',index===library.editing);
        const header=make('div',undefined,'scene-card-head');header.append(make('strong',s.name),make('span',Number((s.seconds/60).toFixed(2))+' min','scene-duration'));
        if(index===0)header.append(make('small','Starts here','scene-first'));row.append(header);
        const c=s.profile.config,summary=m.sceneSummary(c,s.profile.audio),look=make('div',undefined,'scene-look');
        if(c.eyesEnabled){const img=make('img');img.src='./images/eyes/eye_icon_'+c.eyeChoices[0]+'.png';img.alt=summary.eyes;img.width=28;img.height=28;look.append(img);}
        const colors=make('span',undefined,'scene-colors');if(c.lightsEnabled){const p=c.lightPalettes[0]??0;for(const part of ['torso','head']){const dot=make('i');dot.style.background=c.lightRotation?c['palette'+p+(part==='torso'?'Torso':'Head')]:c[part+'Color'];colors.append(dot);}}look.append(colors,make('span',summary.motors+' · '+summary.eyes+' · '+summary.lights));row.append(look);
        header.append(action('Edit','Edit scene '+s.name,async()=>{if(await confirmReplace('Edit '+s.name+'?')){applyEditor(s,index);message('Editing '+s.name+'. Update this scene after changing the controls above.');}}));
        const notes=m.timingNotes(c,s.seconds),more=make('details',undefined,'scene-more'),moreTitle=make('summary','More options'+(notes.length?' · timing note':''));moreTitle.setAttribute('aria-label','More options for scene '+s.name+(notes.length?' · timing note':''));more.append(moreTitle);
        for(const note of notes)more.append(make('p',note,'scene-timing-note'));
        const buttons=make('div',undefined,'scene-card-actions');
        buttons.append(action('Duplicate','Duplicate scene '+s.name,()=>{library.duplicate(index);persist();renderLibrary();el('sceneList').querySelectorAll('.scene-card')[index+1].querySelector('button').focus();message('Scene duplicated in this browser.');},value.scenes.length>=4),
          action('Rename','Rename scene '+s.name,()=>openRename(index)),
          action('↑','Move scene '+s.name+' up',()=>move(index,-1),index===0),action('↓','Move scene '+s.name+' down',()=>move(index,1),index===value.scenes.length-1),
          action('Delete','Delete scene '+s.name,()=>{const wasEditing=library.editing===index;library.remove(index);if(wasEditing)pendingNew=true;persist();renderLibrary();el('sceneUndo').focus();message('Deleted '+s.name+'. Use Undo to restore it.');}));more.append(buttons);row.append(more);list.append(row);
      });
      el('sceneRotate').checked=value.rotate;el('sceneOrder').value=value.random?'random':'ordered';el('sceneOrder').disabled=!value.rotate;
      el('sceneDownload').disabled=!value.scenes.length;el('sceneExport').disabled=!value.scenes.length;el('sceneUndo').disabled=!library.undoEntry;
      const compare=el('sceneComparisonRows'),showAudio=value.scenes.some(s=>s.profile.config.jawEnabled);compare.replaceChildren();el('sceneAudioColumn').hidden=!showAudio;
      for(const cells of m.comparisonRows(value)){const row=make('tr');cells.forEach((cell,i)=>{const node=make(i===0?'th':'td',cell);if(i===5)node.hidden=!showAudio;if(i===0)node.setAttribute('scope','row');row.append(node);});compare.append(row);}
      if(!value.scenes.length){const row=make('tr'),cell=make('td','Save a scene to compare it here.');cell.colSpan=6;row.append(cell);compare.append(row);}
      const sequence=el('sceneSequence');sequence.replaceChildren();
      const labels={head:'Head',arm:'Arm',torso:'Torso',compound:'Combined',eyes:'Eyes',lights:'Lighting',jaw:'Jaw'};
      const previews=m.routinePreview(value,g),picker=el('scenePreviewSelect');picker.replaceChildren();picker.disabled=!previews.length;
      for(const s of previews){const option=make('option',s.name+' · '+Number((s.seconds/60).toFixed(2))+' min');option.value=s.name;picker.append(option);}
      if(!previews.some(s=>s.name===previewName))previewName=previews[library.editing??0]?.name??null;
      picker.value=previewName??'';
      for(const s of previews.filter(s=>s.name===previewName)){
        const preview=make('article',undefined,'routine-scene'+(s.inactive?' is-inactive':''));
        const title=make('div',undefined,'routine-scene-title');title.append(make('strong',s.name),make('span',Number((s.seconds/60).toFixed(2))+' min · '+s.position));preview.append(title);
        for(const lane of s.lanes){
          const row=make('div',undefined,'routine-lane');row.append(make('span',(lane.label??labels[lane.kind])+' · '+lane.min+(lane.min===lane.max?'':'–'+lane.max)+' sec'));
          const track=make('div',undefined,'routine-track');track.setAttribute('aria-hidden','true');
          for(const time of lane.ticks){const tick=make('i',undefined,'routine-tick '+lane.kind);tick.style.left=(time/s.seconds*100)+'%';track.append(tick);}row.append(track);preview.append(row);
          if(!lane.ticks.length)preview.append(make('small','No '+(lane.label??labels[lane.kind]).toLowerCase()+' request in this sample.','routine-empty'));
        }
        if(!s.lanes.length)preview.append(make('small','No recurring requests in this scene.','routine-empty'));
        const axis=make('div',undefined,'routine-axis');axis.append(make('span','0'),make('span',Number((s.seconds/60).toFixed(2))+' min'));preview.append(axis);sequence.append(preview);
      }
      el('sceneSequenceNote').textContent=!value.scenes.length?'Save your first scene using the controls above.':!value.rotate?'Switching off · only the first scene runs.':value.scenes.length===1?'One saved scene · add another to switch scenes.':value.random?'Random · starts with the first scene, then chooses another without immediate repeats.':Number((value.scenes.reduce((n,s)=>n+s.seconds,0)/60).toFixed(2))+' minutes of scene holds per loop, plus completion and reconnect time.';
      renderEditor();document.dispatchEvent(new CustomEvent('skelly-scenes-changed'));
    }
    function move(index,delta){if(library.move(index,delta)){persist();renderLibrary();el('sceneList').querySelectorAll('.scene-card')[index+delta].querySelector('button').focus();}}
    let renaming=null;
    function openRename(index){renaming=index;el('sceneRenameInput').value=library.value.scenes[index].name;el('sceneRenameError').textContent='';el('sceneRenameDialog').showModal();el('sceneRenameInput').focus();}
    el('sceneRenameForm').onsubmit=e=>{e.preventDefault();try{const name=el('sceneRenameInput').value.trim(),index=renaming,oldName=library.value.scenes[index].name;library.rename(index,name);if(previewName===oldName)previewName=name;if(library.editing===index){if(el('sceneName').value.trim()===baseline.name)el('sceneName').value=name;baseline={...baseline,name};}persist();renderLibrary();el('sceneRenameDialog').close();el('sceneList').querySelectorAll('.scene-card')[index].querySelector('button').focus();message('Scene renamed.');}catch(err){el('sceneRenameError').textContent=err.message;}};
    el('sceneRenameCancel').onclick=()=>el('sceneRenameDialog').close();
    function previewImport(value,label){
      const parsed=m.validateLibrary(value,g),dialog=el('sceneImportDialog'),preview=el('sceneImportPreview');preview.replaceChildren();
      el('sceneImportTitle').textContent=label;el('sceneImportNotice').textContent='Replace '+library.value.scenes.length+' browser scene(s) with '+parsed.scenes.length+' imported scene(s).'+(dirty()?' Current unsaved editor changes will also be replaced.':'')+' Nothing is sent to the ESP32.';
      if(parsed.scenes.some(s=>(s.profile.config.deviceId??'ultra')!==(g.readConfig().deviceId??'ultra')))el('sceneImportNotice').textContent+=' Warning: imported scenes change the device model. 12-foot scenes are Experimental — Not Hardware Tested.';
      for(const s of parsed.scenes)preview.append(make('li',s.name+' · '+Number((s.seconds/60).toFixed(2))+' min · '+m.sceneSummary(s.profile.config).motors));
      dialog.returnValue='';dialog.showModal();return new Promise(resolve=>{const close=()=>{dialog.removeEventListener('close',close);resolve(dialog.returnValue==='replace'?parsed:null);};dialog.addEventListener('close',close);});
    }
    function replaceLibrary(value){library.commit(value,null,'Replace library');if(library.value.scenes.length)applyEditor(library.value.scenes[0],0);else applyEditor({name:'My spooky Skelly',seconds:600,profile:JSON.parse(g.createProfile(g.DEFAULTS,{}))});persist();renderLibrary();}
    Object.assign(api,{snapshot:()=>library.snapshot(),program:()=>library.program(),duration:()=>{try{return entry().seconds;}catch(_){return 600;}},confirmReplace,
      confirmSendScenes:async()=>!dirty()||await ask('Current editor changes are not in the saved scene library. Continue by sending only the saved scenes?'),
      usbState:port=>{if(port!==usbPort){usbPort=port;verified=null;renderDevice();}},
      recordController:(program,kind)=>{verified=program?{program:JSON.parse(JSON.stringify(program)),kind,key:wireKey(program)}:null;renderDevice();if(program)message('ESP32 settings read-back verified. See the comparison above.');},
      loadProfile:async profile=>{if(!await confirmReplace('Load this profile?'))return false;applyEditor({name:'Imported routine',seconds:600,profile});return true;},
      loadProgram:async program=>{
        const value=m.validateLibrary({app:'SkellyScenes',version:1,rotate:program.rotate,random:program.random??false,scenes:program.scenes.map(s=>({name:s.name,seconds:s.seconds,profile:JSON.parse(g.createProfile(s.config,{}))}))},g);
        const parsed=library.value.scenes.length||dirty()?await previewImport(value,'Read settings from ESP32'):value;if(!parsed)return false;replaceLibrary(parsed);return true;
      }
    });
    try{const stored=localStorage.getItem(KEY);if(stored)library=new m.SceneLibrary(g,JSON.parse(stored));}catch(_){message('Saved scenes could not be read. Import an exported copy to recover.');}
    baseline=entry();
    try{const saved=localStorage.getItem(DRAFT);if(saved)recovery=m.parseDraft(saved,g);}catch(_){message('An unreadable draft was ignored. Saved scenes are unchanged.');}
    el('draftRecovery').hidden=!recovery;el('draftTopNotice').hidden=!recovery;
    el('draftReview').onclick=()=>{el('scenes').open=true;el('draftRestore').focus();};
    el('draftRestore').onclick=async()=>{if(!await confirmReplace('Restore the previous draft?'))return;const saved=recovery;recovery=null;el('draftRecovery').hidden=true;el('draftTopNotice').hidden=true;applyEditor(saved.current,null);baseline=saved.baseline;pendingNew=saved.pendingNew;
      if(saved.editing!==null&&m.editorKey(library.value.scenes[saved.editing])===saved.sceneKey)library.editing=saved.editing;renderLibrary();saveDraft();message('Editor draft restored. Saved scenes and ESP32 settings are unchanged.');};
    el('draftDiscard').onclick=()=>{recovery=null;el('draftRecovery').hidden=true;el('draftTopNotice').hidden=true;clearDraft();renderEditor();};
    el('sceneSave').onclick=()=>{try{library.add(entry());previewName=library.value.scenes[library.editing].name;const saved=persist();pendingNew=false;checkpoint();renderLibrary();message(saved?'New scene saved in this browser. Use Save scenes below to send it to the ESP32.':'New scene is available this session only. Export a copy before closing.');}catch(e){message(e.message);}};
    el('sceneUpdate').onclick=()=>{try{library.update(entry());previewName=library.value.scenes[library.editing].name;const saved=persist();pendingNew=false;checkpoint();renderLibrary();message(saved?'Scene updated in this browser. It has not been sent to the ESP32.':'Scene updated for this session only. Export a copy before closing.');}catch(e){message(e.message);}};
    el('sceneRevert').onclick=async()=>{if(await confirmReplace('Revert editor changes?')){const pending=pendingNew;applyEditor(baseline,library.editing);pendingNew=pending;renderEditor();}};
    el('sceneUndo').onclick=()=>{if(library.undo()){pendingNew=library.editing===null;if(library.editing!==null)baseline=library.value.scenes[library.editing];persist();renderLibrary();message('Last library change undone. The ESP32 is unchanged.');}};
    for(const button of document.querySelectorAll('[data-scene-starter]'))button.onclick=async()=>{if(await confirmReplace('Start a new '+m.starter(button.dataset.sceneStarter,g).name+' scene?')){try{applyEditor(m.starter(button.dataset.sceneStarter,g,g.readConfig()));message('Starting point loaded. Customize above, then Save as new.');}catch(e){message(e.message);}}};
    el('sceneRotate').onchange=()=>{const next=library.snapshot();next.rotate=el('sceneRotate').checked;library.commit(next);persist();renderLibrary();};
    el('scenePreviewSelect').onchange=()=>{previewName=el('scenePreviewSelect').value;renderLibrary();};
    el('sceneOrder').onchange=()=>{const next=library.snapshot();next.random=el('sceneOrder').value==='random';library.commit(next);persist();renderLibrary();};
    el('sceneExport').onclick=()=>g.downloadText(JSON.stringify(library.snapshot(),null,2),'Skelly-scenes.json','application/json');
    el('sceneImport').onclick=()=>el('sceneFile').click();el('sceneFile').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>262144)throw Error('Choose a scene library smaller than 256 KB.');const parsed=await previewImport(JSON.parse(await f.text()),'Import scene library');if(parsed){replaceLibrary(parsed);message('Scene library imported into this browser.');}}catch(err){message(err.message);}finally{e.target.value='';}};
    el('sceneDownload').onclick=()=>{try{const p=library.program();g.downloadText(g.generateRuntimeSketch(p.scenes,p.rotate,p.random),'SkellyScenes.ino','text/plain');message('Scene routine downloaded. Existing saved USB settings take priority until reset.');}catch(e){message(e.message);}};
    document.addEventListener('skelly-config-changed',renderEditor);
    window.addEventListener('beforeunload',e=>{saveDraft();if((dirty()&&!draftStored)||(library.value.scenes.length&&!libraryStored)){e.preventDefault();e.returnValue='';}});
    window.addEventListener('pagehide',saveDraft);renderLibrary();
  });
})();
