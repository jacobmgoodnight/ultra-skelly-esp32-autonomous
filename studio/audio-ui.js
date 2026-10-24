/* Small adapter for optional direct-to-Skelly preparation. Routine edits never send settings. */
(function(){
  'use strict';if(typeof document==='undefined')return;
  document.addEventListener('DOMContentLoaded',()=>{
    const a=window.SkellyAudio,g=window.SkellyStudioGenerator,el=id=>document.getElementById(id);
    let prepared=null,selected='',lastConnected=false;const guards=new Map();
    const key=f=>f.serial+':'+f.cluster+':'+f.name;
    const snapshots=new Map();
    window.SkellyAudioCheck=scenes=>{for(const scene of scenes){const ref=scene.audio,c=scene.config;if(c.jawEnabled&&c.eyeJawMode===3&&ref&&snapshots.has(c.bleName.trim())&&a.identityChanged(ref,snapshots.get(c.bleName.trim()),c.bleName.trim()))throw Error('Audio file numbers changed. Reselect '+ref.name+' on Skelly, use it in the routine, then update the saved scene before sending.');}};
    function remember(){if(session.connected)snapshots.set(session.name,session.files.map(f=>({...f})));}

    const session=new a.Session(navigator.bluetooth,{onChange:render});
    window.SkellyAudioConnection=()=>session.connected||session.busy;
    function say(message,error=false){el('audioMessage').textContent=message;el('audioMessage').dataset.state=error?'error':'info';}
    function markCustom(){for(const button of document.querySelectorAll('.preset'))button.classList.remove('chosen');}
    function clipSettings(){return {action:(el('audioHead').checked?1:0)|(el('audioArm').checked?2:0)|(el('audioTorso').checked?4:0),eye:Number(el('audioEye').value),lights:['Torso','Head'].map(channel=>({color:el('audio'+channel+'Color').value,cycle:el('audio'+channel+'Cycle').checked,brightness:Number(el('audio'+channel+'Brightness').value),mode:Number(el('audio'+channel+'Effect').value),speed:Number(el('audio'+channel+'Speed').value)}))};}
    function current(){return session.files.find(f=>key(f)===selected);}
    function render(){
      const connected=session.connected,busy=session.busy;
      if(lastConnected&&!connected){guards.clear();selected='';el('audioGuard').value='';}lastConnected=connected;
      el('audioConnection').textContent=connected?'Connected · '+session.name:busy?'Connecting…':'Not connected';
      el('audioConnect').disabled=!navigator.bluetooth||connected||busy;
      el('audioDisconnect').disabled=!connected||busy;el('audioRefresh').disabled=!connected||busy;
      el('audioUpload').disabled=!connected||busy||!prepared;el('audioCancel').disabled=!busy;
      const picker=el('audioFileSelect'),previous=selected;picker.replaceChildren();
      if(!session.files.length){const option=document.createElement('option');option.value='';option.textContent=connected?'No files reported':'Connect to read files';picker.append(option);selected='';}
      for(const file of session.files){const option=document.createElement('option');option.value=key(file);option.textContent=file.name+' · #'+file.serial;picker.append(option);}
      if(session.files.length)selected=session.files.some(f=>key(f)===previous)?previous:key(session.files[0]);
      picker.value=selected;picker.disabled=!connected||busy||!session.files.length;
      el('audioEdit').hidden=!current();el('audioEdit').disabled=!current()||busy;
      const c=g.readConfig(),active=c.jawEnabled&&c.eyeJawMode===3;
      el('audioSceneSummary').textContent=active?'On · file #'+c.jawFile+' · '+c.jawMin+'–'+c.jawMax+' second requests':'Upload a clip, choose its look, then schedule it';
      const ref=g.readAudioReference?.(c),files=snapshots.get(c.bleName.trim());
      el('audioIdentity').textContent=!active?'':ref&&files&&a.identityChanged(ref,files,c.bleName.trim())?'File list changed: '+ref.name+' no longer matches #'+ref.serial+'. Reselect and use the correct clip; Studio will not remap it automatically.':ref?'Routine clip: '+ref.name+' · #'+ref.serial+'. Name is a saved label; refresh the list after changing stored files.':'Routine clip #'+c.jawFile+' has no saved name. Connect and reselect it to add a label.';
      if(ref)el('audioSceneSummary').textContent='On · '+ref.name+' · experimental';
      el('audioOff').hidden=!active;document.dispatchEvent(new CustomEvent('skelly-audio-connection'));
    }
    function load(file,preserveGuard=false){
      if(!file)return;selected=key(file);el('audioFileSelect').value=selected;
      el('audioSelectedName').textContent=file.name;el('audioSelectedNumber').textContent='Read from Skelly · file #'+file.serial;
      for(const [id,mask] of [['audioHead',1],['audioArm',2],['audioTorso',4]])el(id).checked=!!(file.action&mask);
      el('audioEye').value=file.eye;el('audioEyePreview').src='./images/eyes/eye_icon_'+file.eye+'.png';
      for(const [i,channel] of ['Torso','Head'].entries()){const l=file.lights[i];el('audio'+channel+'Cycle').checked=!!l.cycle;el('audio'+channel+'Color').value=l.color;el('audio'+channel+'Brightness').value=l.brightness;el('audio'+channel+'Effect').value=[1,2,3].includes(l.mode)?l.mode:1;el('audio'+channel+'Speed').value=l.speed===255?254:254-l.speed;}
      el('audioGuard').value=guards.get(selected)??(preserveGuard?el('audioGuard').value:'');render();
    }
    async function perform(operation,success){try{const value=await operation();if(success)say(typeof success==='function'?success(value):success);return value;}catch(error){say(error.message,true);}finally{render();}}
    el('audioConnect').onclick=()=>{
      if(window.SkellyControllerPortOpen?.()){say('Close the ESP32 USB session and unplug ESP32 power before connecting directly to Skelly.',true);return;}
      say('Choose Ultra Skelly. Keep the ESP32 powered off and other controllers disconnected.');
      void perform(async()=>{await session.connect(g.readConfig().bleName);remember();load(session.files[0]);},'Connected directly to Skelly. Files read; no playback has started.');
    };
    el('audioDisconnect').onclick=()=>{session.disconnect();say('Skelly disconnected. Power the ESP32 again to return to autonomous control.');};
    el('audioCancel').onclick=()=>{session.cancel();say('Cancelled and disconnected. Refresh files after reconnecting; a partial upload may remain.');};
    el('audioRefresh').onclick=()=>void perform(async()=>{const previous=selected;await session.refresh();remember();load(current(),selected===previous);},'Files refreshed from Skelly.');
    el('audioFileSelect').onchange=()=>{selected=el('audioFileSelect').value;load(current());};
    function acceptPrepared(bytes,info,name){prepared={bytes,info};el('audioUploadName').value=(name.replace(/\.[^.]+$/,'').replace(/[^A-Za-z0-9_-]/g,'-').slice(0,18)||'Audio')+'_'+Date.now().toString(36)+'.mp3';el('audioFileInfo').textContent=info.duration.toFixed(1)+' seconds · padded estimate '+info.guard+' seconds · ready to upload.';render();}
    document.addEventListener('skelly-audio-prepared',event=>{try{const bytes=event.detail.bytes,info=a.inspectMp3(bytes);acceptPrepared(bytes,info,event.detail.name);el('audioUploadPanel').open=true;say('Prepared MP3 ready below. Choose Upload new file to send it.');}catch(error){say(error.message,true);}});
    let fileGeneration=0;
    el('audioUploadFile').onchange=async()=>{
      const generation=++fileGeneration,file=el('audioUploadFile').files[0];prepared=null;render();
      if(!file){el('audioFileInfo').textContent='Choose a prepared MP3.';return;}
      try{if(file.size>1048576)throw Error('Choose an MP3 smaller than 1 MiB.');const bytes=new Uint8Array(await file.arrayBuffer()),info=a.inspectMp3(bytes);if(generation!==fileGeneration)return;
        acceptPrepared(bytes,info,file.name);
      }catch(error){if(generation===fileGeneration)el('audioFileInfo').textContent=error.message;}render();
    };
    el('audioUpload').onclick=()=>{
      if(!prepared)return;const pending=prepared,name=el('audioUploadName').value.trim();say('Uploading to Skelly. Keep this tab open…');el('audioProgress').hidden=false;el('audioProgress').value=0;el('audioPercent').hidden=false;el('audioPercent').textContent='0%';
      void perform(async()=>{const file=await session.upload(pending.bytes,name,p=>{el('audioProgress').value=p;el('audioPercent').textContent=p+'%';});remember();guards.set(key(file),file.guard);load(file);return file;},'Upload confirmed and file found on Skelly. Review its saved movements and appearance before scheduling.');
    };
    el('audioEye').onchange=()=>el('audioEyePreview').src='./images/eyes/eye_icon_'+el('audioEye').value+'.png';
    el('audioCopyLook').onclick=()=>{
      const c=g.readConfig();el('audioEye').value=c.eyeChoices[0]??1;el('audioEye').onchange();
      for(const channel of ['Torso','Head']){const part=channel.toLowerCase();el('audio'+channel+'Cycle').checked=false;el('audio'+channel+'Color').value=c.lightRotation?c['palette'+(c.lightPalettes[0]??0)+channel]:c[part+'Color'];el('audio'+channel+'Brightness').value=c[part+'Brightness'];el('audio'+channel+'Effect').value=c[part+'Effect'];el('audio'+channel+'Speed').value=c[part+'Speed'];}
      say('Current eyes and lighting copied into the clip form. Save clip look to send them.');
    };
    el('audioSaveLook').onclick=()=>{
      const file=current();if(!file)return;
      const value=clipSettings();
      say('Saving this clip’s movements and appearance…');void perform(async()=>{const saved=await session.save(file,value);remember();load(saved,true);},'Clip settings saved · read-back verified. Physical playback still needs your attended check.');
    };
    el('audioUse').onclick=()=>{
      try{const file=current();if(!file)throw Error('Connect and select a file read from Skelly.');if(!a.sameSettings(file,a.settings(clipSettings()))){el('audioClipLook').open=true;throw Error('Save clip look to Skelly and verify read-back before using this clip in a routine.');}if(g.readConfig().bleName.trim()!==session.name)throw Error('The routine Bluetooth name changed. Reconnect to the intended Skelly before using its file number.');const guard=Number(el('audioGuard').value);
        if(guards.has(selected)&&guard<guards.get(selected))throw Error('Keep at least the measured, padded clip estimate.');
        const config=a.audioRoutine(g.readConfig(),file,guard,Number(el('audioMin').value),Number(el('audioMax').value)),errors=g.validate(config);if(errors.length)throw Error(errors.join('\n'));
        markCustom();g.writeAudioReference?.({name:file.name,serial:file.serial,cluster:file.cluster,device:session.name});g.writeConfig(config);el('mouth').open=false;say('Audio scene added to the editor. Disconnect Skelly, power the ESP32 again, then Save routine or update and Save scenes.');
      }catch(error){say(error.message,true);}
    };
    el('audioOff').onclick=()=>{markCustom();g.writeConfig(window.SkellyExperience.withoutMouth(g.readConfig()));say('Audio scene turned off in the editor. Save to your ESP32 when ready.');};
    document.addEventListener('skelly-config-changed',render);window.addEventListener('pagehide',()=>session.cancel());
    if(!navigator.bluetooth)say('This browser cannot connect directly over Bluetooth. You can still configure routines and use a compatible Web Bluetooth browser for audio preparation.');
    render();
  });
})();
