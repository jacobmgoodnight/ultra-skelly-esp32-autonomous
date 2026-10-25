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
  function preferences(value){
    if(!value||value.version!==1)return {version:1,ultra:{favorites:[],names:{}},skelly12:{favorites:[],names:{}}};
    const result=preferences(null);
    for(const device of ['ultra','skelly12']){
      const input=value[device],limit=device==='ultra'?18:20;if(!input)continue;
      if(Array.isArray(input.favorites))result[device].favorites=[...new Set(input.favorites.filter(n=>Number.isInteger(n)&&n>=1&&n<=limit))];
      if(input.names&&typeof input.names==='object')for(const [key,name] of Object.entries(input.names))if(/^\d+$/.test(key)&&Number(key)>=1&&Number(key)<=limit&&typeof name==='string'&&name.trim().length<=24&&!/[\x00-\x1f]/.test(name))result[device].names[key]=name.trim();
    }
    return result;
  }
  const api={appearance,eyeName,previewPeriod,preferences,EYE_KEYS,LIGHT_KEYS};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window==='undefined')return;window.SkellyLooks=api;
  document.addEventListener('DOMContentLoaded',()=>{
    const g=window.SkellyStudioGenerator,el=id=>document.getElementById(id);
    if(!el('lookWorkspace'))return;
    let prefs=preferences(null),playing=true,previewEye=1;
    const preferenceKey='SkellyStudio-eye-preferences-v1',reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    try{prefs=preferences(JSON.parse(localStorage.getItem(preferenceKey)));}catch(_){}
    function savePreferences(){try{localStorage.setItem(preferenceKey,JSON.stringify(prefs));el('eyePreferencesStatus').textContent='Names and favorites saved in this browser.';}catch(_){el('eyePreferencesStatus').textContent='Names and favorites are session only; browser storage is unavailable.';}}
    function name(id,c){return prefs[c.deviceId??'ultra'].names[id]||eyeName(id,c.deviceId);}
    function renderGallery(c){
      const device=c.deviceId??'ultra',limit=g.DEVICE_PROFILES[device].eyes;
      for(const card of document.querySelectorAll('.eye-card')){
        const input=card.querySelector('input'),id=Number(input.value),favorite=prefs[device].favorites.includes(id);
        card.hidden=id>limit||(el('eyeFilter').value==='favorites'&&!favorite);
        const label=card.querySelector('.eye-tile-number');if(label)label.textContent=name(id,c)+' · #'+id;
        input.setAttribute('aria-label','Choose '+name(id,c)+' · eye '+id);
        const star=card.querySelector('.eye-favorite');if(star){star.setAttribute('aria-pressed',String(favorite));star.setAttribute('aria-label',(favorite?'Unfavorite ':'Favorite ')+name(id,c)+' · eye '+id);star.textContent=favorite?'★':'☆';}
      }
      el('eyeFavoritesEmpty').hidden=el('eyeFilter').value!=='favorites'||prefs[device].favorites.length>0;
      el('eyePreviewLabel').textContent=name(previewEye,c)+' · eye #'+previewEye;
      if(document.activeElement!==el('eyeNickname'))el('eyeNickname').value=prefs[device].names[previewEye]??'';
    }
    for(const card of document.querySelectorAll('.eye-card')){
      const input=card.querySelector('input'),id=Number(input.value),star=document.createElement('button');
      star.type='button';star.className='eye-favorite';star.textContent='☆';
      star.onclick=()=>{const c=g.readConfig(),p=prefs[c.deviceId??'ultra'];p.favorites=p.favorites.includes(id)?p.favorites.filter(n=>n!==id):[...p.favorites,id];savePreferences();renderGallery(c);};
      card.append(star);
      input.addEventListener('input',()=>{previewEye=id;renderGallery(g.readConfig());});
      card.querySelector('.eye-zoom')?.addEventListener('click',()=>{previewEye=id;renderGallery(g.readConfig());});
    }
    el('eyeFilter').onchange=()=>renderGallery(g.readConfig());
    el('eyeNickname').oninput=()=>{
      const c=g.readConfig(),value=el('eyeNickname').value.trim();
      if(value.length>24||/[\x00-\x1f]/.test(value))return;
      if(value)prefs[c.deviceId??'ultra'].names[previewEye]=value;else delete prefs[c.deviceId??'ultra'].names[previewEye];savePreferences();renderGallery(c);
    };
    function render(){
      const c=g.readConfig(),experimental=c.deviceId==='skelly12';
      const moving=c.lightsEnabled&&(c.torsoEffect!==1||(!experimental&&c.headEffect!==1));
      const active=playing&&!document.hidden&&!reduced.matches&&moving;
      el('effectPreviewToggle').disabled=reduced.matches;
      el('effectPreviewToggle').textContent=playing?'Pause effect preview':'Resume effect preview';
      el('effectPreviewToggle').setAttribute('aria-pressed',String(playing&&!reduced.matches));
      el('effectPreviewStatus').textContent=reduced.matches?'Still preview · reduced motion':!moving?'Static preview':document.hidden?'Preview paused while this tab is hidden':active?'Playing an illustrative effect sample':'Effect preview paused';
      el('effectPreviewHint').textContent=[c.torsoEffect,c.headEffect].includes(2)?'Strobe preview is limited to 2 flashes/sec. Prop speed may differ.':'Effect timing and LED appearance are illustrative; higher speed makes the preview faster.';
      const first=c.lightPalettes[0]??0;
      for(const part of ['torso','head'])for(const swatch of el('lookPreview').querySelectorAll('[data-look-swatch="'+part+'"]')){
        const color=c.lightRotation?c['palette'+first+(part==='torso'?'Torso':'Head')]:c[part+'Color'];
        swatch.style.setProperty('--swatch-color',color);swatch.style.setProperty('--swatch-brightness',c[part+'Brightness']/255);
        swatch.style.setProperty('--effect-period',previewPeriod(c[part+'Effect'],c[part+'Speed'])+'s');
        swatch.dataset.effect=String(c[part+'Effect']);swatch.classList.toggle('is-animating',active);swatch.classList.toggle('is-stored',!c.lightsEnabled);
      }
      const id=c.eyeChoices[0]??1,url=g.eyeImageUrl(id);
      el('lookEyeImage').hidden=!c.eyesEnabled||!url;if(url)el('lookEyeImage').src=url;else el('lookEyeImage').removeAttribute('src');
      el('lookEyeImage').alt=name(id,c)+' · eye '+id;
      el('lookEyeLabel').textContent=!c.eyesEnabled?'Use Skelly’s stored eyes':c.eyeChoices.length>1?c.eyeChoices.length+' selected expressions · sample #'+id:name(id,c)+' · fixed';
      el('lookTorsoLabel').textContent=experimental?'Chest':'Torso';el('lookHeadRow').hidden=experimental;
      el('lookLightLabel').textContent=!c.lightsEnabled?'Use Skelly’s stored lighting':c.lightRotation?'Starts with '+c['palette'+first+'Name']:'Selected colors';
      el('lookMovement').textContent=window.SkellySceneModel.sceneSummary(c).motors;
      renderGallery(c);
    }
    el('effectPreviewToggle').onclick=()=>{playing=!playing;render();};
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
