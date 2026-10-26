/* Explicit controller actions and one shared USB session for setup and diagnostics. */
(function(){
  if(typeof document==='undefined')return;
  document.addEventListener('DOMContentLoaded',()=>{
    const g=window.SkellyStudioGenerator,r=window.SkellyRuntime,el=id=>document.getElementById(id);
    const session=new window.SkellySerial.Session(navigator.serial);
    // An explicit return from the model-specific installer keeps the firmware and editor aligned.
    if(window.location?.search&&new URLSearchParams(window.location.search).get('device')==='skelly12'){
      g.writeConfig(g.adaptDevice({...g.DEFAULTS,...g.PRESETS.subtle,bleName:'12ft Skelly'},'skelly12'));
    }
    const state=new window.SkellyControllerState.ControllerState(session,{onChange:render,hidden:()=>document.hidden});
    let previousUsb='disconnected',reviewedPort=null,verifiedSave=null,activeStep=null;
    const text=(id,value)=>{const node=el(id),next=String(value);if(node.textContent!==next)node.textContent=next;};
    function render(){
      const view=window.SkellyControllerState.connectionView(state),port=!!session.port;
      if(reviewedPort!==session.port){reviewedPort=null;verifiedSave=null;}
      window.SkellyScenes.usbState?.(session.port);
      text('controllerUsb',view.usb);el('controllerUsb').dataset.state=view.usbTone;
      text('controllerSkelly',view.skelly);el('controllerSkelly').dataset.state=view.skellyTone;
      text('controllerScene',view.scene);
      const release=window.SkellyRelease,firmware=release?.firmwareView(state.data,state.capable,state.identified,state.stale);
      text('controllerFirmware',firmware?.text??'Version not reported by this firmware.');
      text('controllerRelease',release?.VERSION??'See changelog');
      el('controllerFirmware').dataset.state=firmware?.update?'info':'ready';
      const activity=window.SkellyControllerState.diagnosticView(state.data,state.stale).find(row=>/activity \/ wait/.test(row[0]));
      text('controllerActivity',activity?.[1]??'');el('controllerActivity').hidden=!port||!activity;

      text('controllerMessage',state.message);el('controllerMessage').dataset.state=state.tone;
      el('controllerMessage').hidden=state.message==='Connect your ESP32 to read or save settings.';
      el('controllerConnect').disabled=!navigator.serial||port||session.busy||state.busy||!!window.SkellyAudioConnection?.();
      el('controllerDisconnect').disabled=!port||state.busy;
      el('controllerStatus').disabled=!port||!state.identified||state.busy;
      el('controllerIdentify').hidden=!port||state.identified||state.usb!=='unidentified';
      el('controllerIdentify').disabled=state.busy;
      for(const id of ['controllerRead','controllerWrite','controllerScenes','controllerReset'])el(id).disabled=!port||!state.capable||state.busy;
      // Invalid editor drafts must not block sending a valid saved scene collection.
      el('controllerWrite').disabled||=g.validate(g.readConfig()).length>0;
      el('controllerScenes').disabled||=!window.SkellyScenes.snapshot().scenes.length;
      let verified=false;
      if(verifiedSave)try{
        const program=verifiedSave.kind==='scenes'?window.SkellyScenes.program():{scenes:[{name:'My routine',seconds:600,config:g.readConfig()}],rotate:false};
        verified=JSON.stringify(r.encode(program.scenes,program.rotate,g.validate,program.random))===verifiedSave.words;
      }catch{/* An invalid draft cannot match the last verified save. */}
      const workflow=window.SkellyControllerState.workflowView(state,{supported:!!navigator.serial,reviewed:reviewedPort===session.port&&port,verified,valid:!g.validate(g.readConfig()).length,consent:el('controllerConsent').checked,activeStep});
      text('controllerNext',workflow.hint);
      el('controllerNext').hidden=state.busy||!navigator.serial;
      const steps=['Connect','Read','Save','Done'];
      for(const [index,step] of steps.entries()){
        const node=el('controllerStep'+step);node.dataset.state=index<steps.indexOf(workflow.step)?'complete':step===workflow.step?'current':'pending';
        if(step===workflow.step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');
      }
      for(const id of ['controllerConnect','controllerIdentify','controllerRead','controllerWrite'])el(id).dataset.recommended=String(id===workflow.action);
      el('controllerLog').disabled=!session.capture.size;
      if(state.usb==='unsupported')el('controllerSetup').open=true;
      else if(state.usb==='ready'&&previousUsb!=='ready'){el('controllerSetup').open=false;el('first-run').open=false;}
      previousUsb=state.usb;
      el('controllerSkellyHelp').textContent=!port?'USB is for settings; the ESP32 connects to Skelly over Bluetooth.':state.stale?'Bluetooth status may be out of date. USB can still read and save.':state.data?.connected===0?'Skelly is offline. USB can still read and save; Bluetooth retries automatically.':'Bluetooth status is reported by the ESP32. Watch Skelly to confirm movement.';
      el('controllerReceived').textContent=state.receivedAt===null?'No controller status received yet.':(state.stale?'Older status · last received ':'Status received ')+new Date(state.receivedAt).toLocaleTimeString()+'. Auto-refreshes every 5 seconds while idle.';
      const dl=el('controllerDetails');dl.replaceChildren();
      if(port&&state.data){
        const d=state.data;
        for(const [label,value] of [...window.SkellyControllerState.diagnosticView(d,state.stale),['Saved revision',d.sequence],['Pending settings',d.pending?'Waiting for current actions':'None'],['BLE write failures',d.failures],['Free heap',d.heap===undefined?'Unknown':d.heap+' bytes'],['Clock',d.clock===undefined?'Unknown':d.clock?'Set for this boot':'Not set for this boot']]){
          const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value??'Unknown';dl.append(dt,dd);
        }
      }
    }
    window.SkellyControllerPortOpen=()=>!!session.port||state.busy;
    function updateInstallerLinks(){
      const query=g.readConfig().deviceId==='skelly12'?'?device=skelly12':'';
      el('browserInstall').href='./install.html'+query;
      for(const link of document.querySelectorAll('a[data-browser-install]'))link.href='./install.html'+query;
      for(const link of document.querySelectorAll('a[data-usb-tools]'))link.href='./usb.html'+query;
    }
    document.addEventListener('skelly-config-changed',()=>{updateInstallerLinks();render();});
    updateInstallerLinks();
    document.addEventListener("skelly-audio-connection",render);
    el('controllerConsent').addEventListener('change',render);
    async function run(step,action){
      if(state.busy)return false;
      activeStep=step;
      try{return await state.run(action);}
      finally{
        activeStep=null;render();
        // Explicit results stay visible on phones; background status never scrolls.
        if(state.tone==='error'||state.tone==='ready'||step==='Read')el('controllerMessage').scrollIntoView({block:'nearest',behavior:'instant'});
      }
    }
    function consent(){if(!el('controllerConsent').checked)throw Error('Confirm replacing the controller’s saved routine first.');}
    el('controllerConnect').onclick=()=>run('Connect',async()=>{
      if(window.SkellyAudioConnection?.())throw Error('Disconnect direct Skelly audio Bluetooth before connecting the ESP32.');
      state.usb='choosing';state.say('Choose your ESP32 USB port, often CP2102 or CH340.','busy');
      try{await session.connect();}catch(error){
        state.usb='disconnected';
        if(error.name==='NotFoundError')throw Error('No USB port selected. Choose Connect ESP32 when ready. If your board is missing, check the USB data cable and try another socket.');
        if(error.name==='SecurityError')throw Error('USB access was blocked. Use desktop Chrome or Edge over HTTPS and allow USB access, then try Connect ESP32 again.');
        throw Error('Could not open ESP32 USB. Close Arduino Serial Monitor and other USB tabs, check your USB data cable, then try Connect ESP32 again. Details: '+error.message);
      }
      await state.identify();
    });
    el('controllerIdentify').onclick=()=>run('Connect',()=>state.identify());
    el('controllerDisconnect').onclick=()=>run('Connect',async()=>{await session.disconnect();state.say('USB disconnected. Your saved routine runs without the computer.');});
    el('controllerStatus').onclick=()=>run(null,async()=>{
      const ok=await state.refreshStatus();if(!session.port)return;
      state.say(ok?'Controller status refreshed.':'USB is connected, but status is unavailable. The last snapshot may be out of date.',ok?'info':'error');
    });
    el('controllerLog').onclick=()=>g.downloadText(session.capture.text,'Skelly-USB-log.txt','text/plain');
    async function write(program,kind='routine'){
      consent();
      window.SkellyAudioCheck?.(program.scenes);
      if(program.rotate&&program.random&&!state.randomScenes)throw Error('Random scenes need the updated universal firmware. Open First-time setup, upload it, then reconnect.');
      if(program.scenes.some(s=>s.config.eyeJawMode===3)&&!state.audioScenes){el('controllerSetup').open=true;throw Error('Audio scenes need updated universal firmware. Install it from First-time setup, then reconnect.');}
      const words=r.encode(program.scenes,program.rotate,g.validate,program.random);
      // A write may be applied even when its acknowledgment/read-back is lost.
      // Retire the previous comparison until a new read-back is verified.
      window.SkellyScenes.recordController?.(null);
      verifiedSave=null;
      try{
        await session.writeSettings(words,r.crc(words),p=>state.say(p==='waiting'?'Received. Waiting for current actions and full cooldowns to finish…':'Sending settings · '+p+'%','busy'));
        state.say('Received. Checking the controller’s read-back…','busy');
        const saved=await session.readSettings();
        if(r.crc(saved.words)!==saved.crc||saved.crc!==r.crc(words))throw Error('Read-back did not match. Read saved settings before trying again.');
        window.SkellyScenes.recordController?.(r.decode(saved.words,g.DEFAULTS),kind);
        reviewedPort=session.port;verifiedSave={kind,words:JSON.stringify(words)};
      }catch(error){throw Error('Save was not verified. Read saved settings before trying again. Details: '+error.message);}
      state.say('Saved to ESP32 · read-back verified. Watch Skelly to confirm your changes.','ready');
      await state.refreshStatus();
    }
    el('controllerWrite').onclick=()=>run('Save',()=>write({scenes:[{name:'My routine',seconds:600,config:g.readConfig(),audio:g.readAudioReference?.(g.readConfig())}],rotate:false}));
    el('controllerScenes').onclick=()=>run('Save',async()=>{if(await window.SkellyScenes.confirmSendScenes?.()===false){state.say('No scenes sent. Update the scene or save as new first.');return;}await write(window.SkellyScenes.program(),'scenes');});
    el('controllerRead').onclick=()=>run('Read',async()=>{
      state.say('Reading saved settings…','busy');const saved=await session.readSettings();
      if(r.crc(saved.words)!==saved.crc)throw Error('Read-back checksum mismatch.');
      const program=r.decode(saved.words,g.DEFAULTS);
      for(const scene of program.scenes){const errors=g.validate(scene.config);if(errors.length)throw Error(errors.join('\n'));}
      const loaded=await window.SkellyScenes.loadProgram(program);
      reviewedPort=session.port;verifiedSave=null;
      window.SkellyScenes.recordController?.(program,'scenes');
      if(loaded===false){state.say('Settings read and verified. Your browser library and editor were kept.');await state.refreshStatus();return;}
      g.writeLibrary({});g.writeConfig(program.scenes[0].config);
      for(const b of document.querySelectorAll('.preset')){b.classList.remove('chosen');b.setAttribute('aria-pressed','false');}
      state.say('Read '+program.scenes.length+' saved scene(s). The first is loaded in Studio.');await state.refreshStatus();
    });
    el('controllerReset').onclick=()=>run('Save',async()=>{
      consent();const id=(Date.now()%1000000000)+1,after=session.messageSerial;
      state.say('Restoring firmware defaults after current actions finish…','busy');
      await session.configReply('SKELLY CFG RESET '+id,id,s=>s==='USB CFG QUEUED '+id);
      const done=await session.waitFor(s=>s.startsWith('USB CFG APPLIED '+id+' ')||s.startsWith('USB CFG ERROR '+id+' '),after,210000);
      if(done.text.startsWith('USB CFG ERROR'))throw Error(done.text);
      window.SkellyScenes.recordController?.(null);
      verifiedSave=null;
      state.say('Firmware defaults restored. Read saved settings to load them in Studio.','ready');await state.refreshStatus();
    });
    el('universalDownload').onclick=()=>{
      try{
        const selected=g.readConfig(),experimental=selected.deviceId==='skelly12';
        const config=g.adaptDevice({...g.DEFAULTS,...g.PRESETS.subtle,...(experimental?{deviceId:'skelly12',bleName:selected.bleName}:{})});
        g.downloadText(g.generateRuntimeSketch([{name:'Subtle',seconds:600,config}]),(experimental?'Skelly12ExperimentalUniversal':'SkellyUniversal')+'-'+(window.SkellyRelease?.VERSION??'preview')+'.ino','text/plain');
        state.say((experimental?'Experimental 12-foot — Not Hardware Tested. ':'')+'Open the downloaded .ino in Arduino IDE, compile/upload with ESP32 Dev Module and core 3.3.12, then close Serial Monitor and connect here.');
      }catch(error){state.say(error.message,'error');}
    };
    document.addEventListener('skelly-scenes-changed',render);
    document.addEventListener('visibilitychange',()=>void state.visibilityChanged());
    window.addEventListener('pagehide',()=>{state.suspended=true;void state.pausePolling();});
    window.addEventListener('pageshow',()=>{state.suspended=false;void state.visibilityChanged();});
    if(!navigator.serial)state.say('USB needs desktop Chrome or Edge. You can still edit scenes and download sketches in this browser.');
    render();
  });
})();
