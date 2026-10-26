/* Appearance editing and illustrative browser previews. No device I/O. */
(function(){
  'use strict';
  const EYE_KEYS=['eyesEnabled','eyeChoices','eyesMin','eyesMax'];
  const LIGHT_KEYS=['lightsEnabled','torsoColor','headColor','torsoBrightness','headBrightness','lightRotation','lightInterval','lightPalettes','torsoEffect','headEffect','torsoSpeed','headSpeed',...Array.from({length:4},(_,i)=>['Name','Torso','Head'].map(p=>'palette'+i+p)).flat()];
  const NAMES=['Blue iris','Hazel iris','Green iris','Amber iris','Red iris','Silver iris','Yellow reptile','Orange reptile','Rainbow spiral','Flames','Star','Skull and crossbones','Blue vortex','American flag','Heart','Shamrock','Snowflake','Confetti'];
  const MAPPING=[14,15,16,17,0,0,18,1,2,3,4,5,6,7,8,9,10,11,12,13];
  const clone=v=>JSON.parse(JSON.stringify(v));
  function appearance(current,source,scope='appearance'){
    const keys=scope==='eyes'?EYE_KEYS:scope==='lights'?LIGHT_KEYS:scope==='appearance'?[...EYE_KEYS,...LIGHT_KEYS]:null;
    if(!keys)throw Error('Choose eyes, lighting or both.');
    if((current.deviceId??'ultra')!==(source.deviceId??'ultra'))throw Error('Copy a look from the same Skelly model.');
    return {...clone(current),...Object.fromEntries(keys.filter(k=>Object.hasOwn(source,k)).map(k=>[k,clone(source[k])]))};
  }
  function eyeName(id,device='ultra'){
    const image=device==='skelly12'?MAPPING[id-1]:id;
    return NAMES[image-1]??'Design '+id+' · preview unavailable';
  }
  function previewPeriod(effect,speed){
    const fraction=Math.max(0,Math.min(254,Number(speed)||0))/254;
    // Deliberately illustrative: no measured physical effect-period mapping exists.
    // Browser strobe samples never exceed two flashes per second.
    return effect===2?1.6-1.1*fraction:4.5-3.7*fraction;
  }
  const api={appearance,eyeName,previewPeriod,EYE_KEYS,LIGHT_KEYS};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window==='undefined')return;window.SkellyLooks=api;
  document.addEventListener('DOMContentLoaded',()=>{
    const g=window.SkellyStudioGenerator,el=id=>document.getElementById(id);
    if(!el('expressions'))return;
    let previewEye=1,paused=false;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const name=(id,c)=>eyeName(id,c.deviceId);
    function renderGallery(c){
      const device=c.deviceId??'ultra',limit=g.DEVICE_PROFILES[device].eyes;
      for(const card of document.querySelectorAll('.eye-card')){
        const input=card.querySelector('input'),id=Number(input.value);
        card.hidden=id>limit;
        const label=card.querySelector('.eye-tile-number');if(label)label.textContent=name(id,c);
        input.setAttribute('aria-label','Choose '+name(id,c)+' · eye '+id);
      }
      el('eyePreviewLabel').textContent=name(previewEye,c)+' · eye #'+previewEye;
    }
    for(const card of document.querySelectorAll('.eye-card')){
      const input=card.querySelector('input'),id=Number(input.value);
      input.addEventListener('input',()=>{previewEye=id;renderGallery(g.readConfig());});
      card.querySelector('.eye-zoom')?.addEventListener('click',()=>{previewEye=id;renderGallery(g.readConfig());});
    }
    function render(){
      const c=g.readConfig(),experimental=c.deviceId==='skelly12';
      const moving=c.lightsEnabled&&(c.torsoEffect!==1||(!experimental&&c.headEffect!==1));
      const active=!document.hidden&&!reduced.matches&&!paused;
      const first=c.lightPalettes[0]??0;
      el('lightingPreview').hidden=!c.lightsEnabled;
      for(const part of ['torso','head'])for(const swatch of el('lightingPreview').querySelectorAll('[data-light-swatch="'+part+'"]')){
        const color=c.lightRotation?c['palette'+first+(part==='torso'?'Torso':'Head')]:c[part+'Color'];
        swatch.style.setProperty('--swatch-color',color);swatch.style.setProperty('--swatch-brightness',c[part+'Brightness']/255);
        swatch.style.setProperty('--effect-period',previewPeriod(c[part+'Effect'],c[part+'Speed'])+'s');
        swatch.dataset.effect=String(c[part+'Effect']);swatch.classList.toggle('is-animating',active&&c.lightsEnabled&&c[part+'Effect']!==1&&!(experimental&&part==='head'));
        swatch.setAttribute('aria-label',(part==='torso'&&experimental?'Chest':part==='torso'?'Torso':'Head')+' '+color+' · '+({1:'Static',2:'Strobe',3:'Pulsing'}[c[part+'Effect']])+' · '+Math.round(c[part+'Brightness']/255*100)+'% brightness');
      }
      el('previewTorsoLabel').textContent=experimental?'Chest':'Torso';el('previewHeadRow').hidden=experimental;
      el('lightingPreviewNote').textContent=(c.lightRotation?'Starts with '+c['palette'+first+'Name']+' · ':'')+'Illustration · hardware timing varies';
      el('lightingPreviewPause').hidden=!moving||reduced.matches;
      el('lightingPreviewPause').textContent=paused?'Resume':'Pause';
      el('lightingPreviewPause').setAttribute('aria-label',(paused?'Resume':'Pause')+' lighting preview');
      el('lightingPreviewPause').setAttribute('aria-pressed',String(paused));
      const eye=c.eyeChoices[0]??1;
      el('eyeSummary').textContent=!c.eyesEnabled?'Off · stored eyes':c.eyeChoices.length===1?name(eye,c)+' · fixed':c.eyeChoices.length+' expressions · '+c.eyesMin+'–'+c.eyesMax+' sec';
      el('summaryEyeImage').alt=c.eyesEnabled?name(eye,c):'';
      renderGallery(c);
    }
    el('lightingPreviewPause').onclick=()=>{paused=!paused;render();};
    document.addEventListener('visibilitychange',render);reduced.addEventListener('change',render);
    function renderSources(){
      const selected=el('appearanceCopySource').value;el('appearanceCopySource').replaceChildren();
      for(const [index,scene] of (window.SkellyScenes.snapshot?.().scenes??[]).entries()){
        const option=document.createElement('option');option.value=index;option.textContent=scene.name;el('appearanceCopySource').append(option);
      }
      if([...el('appearanceCopySource').options].some(o=>o.value===selected))el('appearanceCopySource').value=selected;
      const empty=!el('appearanceCopySource').options.length;el('appearanceCopySource').disabled=empty;el('appearanceCopyApply').disabled=empty;
    }
    el('appearanceCopyApply').onclick=()=>{
      try{
        const source=window.SkellyScenes.snapshot().scenes[Number(el('appearanceCopySource').value)];if(!source)throw Error('Save a scene to copy its appearance.');
        const config=appearance(g.readConfig(),source.profile.config,el('appearanceCopyScope').value),errors=g.validate(config);
        if(errors.length)throw Error(errors.join(' '));g.writeConfig(config);el('appearanceCopyStatus').textContent='Copied '+el('appearanceCopyScope').selectedOptions[0].textContent.toLowerCase()+' from '+source.name+'. Update the current scene to keep it.';
      }catch(error){el('appearanceCopyStatus').textContent=error.message;}
    };
    document.addEventListener('skelly-config-changed',()=>{const c=g.readConfig();if(!c.eyeChoices.includes(previewEye))previewEye=c.eyeChoices[0]??1;render();});
    document.addEventListener('skelly-scenes-changed',renderSources);
    renderSources();render();
  });
})();
