/* Explicit controller actions and one shared USB session for setup and diagnostics. */
(function(){
  if(typeof document==='undefined')return;
  document.addEventListener('DOMContentLoaded',()=>{
    const g=window.SkellyStudioGenerator,r=window.SkellyRuntime,el=id=>document.getElementById(id);
    const session=new window.SkellySerial.Session(navigator.serial);
    const state=new window.SkellyControllerState.ControllerState(session,{onChange:render,hidden:()=>document.hidden});
    const text=(id,value)=>{const node=el(id),next=String(value);if(node.textContent!==next)node.textContent=next;};
    function render(){
      const view=window.SkellyControllerState.connectionView(state),port=!!session.port;
      window.SkellyScenes.usbState?.(session.port);
      text('controllerUsb',view.usb);el('controllerUsb').dataset.state=view.usbTone;
      text('controllerSkelly',view.skelly);el('controllerSkelly').dataset.state=view.skellyTone;
      text('controllerScene',view.scene);
      text('controllerMessage',state.message);el('controllerMessage').dataset.state=state.tone;
      el('controllerConnect').disabled=!navigator.serial||port||session.busy||state.busy;
      el('controllerDisconnect').disabled=!port||state.busy;
      el('controllerStatus').disabled=!port||!state.identified||state.busy;
      el('controllerIdentify').hidden=!port||state.identified||state.usb!=='unidentified';
      el('controllerIdentify').disabled=state.busy;
      for(const id of ['controllerRead','controllerWrite','controllerScenes','controllerReset'])el(id).disabled=!port||!state.capable||state.busy;
      el('controllerScenes').disabled||=!window.SkellyScenes.snapshot().scenes.length;
      el('controllerLog').disabled=!session.capture.size;
      if(state.usb==='unsupported')el('controllerSetup').open=true;
      el('controllerSkellyHelp').textContent=!port?'Connect USB to check Skelly.':state.stale?'Status may be out of date; USB remains connected.':state.data?.connected===0?'The ESP32 retries Bluetooth automatically. USB can still read and save settings.':'Bluetooth status comes from the ESP32; confirm movement on your Skelly.';
      el('controllerReceived').textContent=state.receivedAt===null?'No controller status received yet.':(state.stale?'Older status · last received ':'Status received ')+new Date(state.receivedAt).toLocaleTimeString()+'. Auto-refreshes every 5 seconds while idle.';
      const dl=el('controllerDetails');dl.replaceChildren();
      if(port&&state.data){
        const d=state.data;
        for(const [label,value] of [...window.SkellyControllerState.diagnosticView(d,state.stale),['Saved revision',d.sequence],['Pending settings',d.pending?'Waiting for current actions':'None'],['BLE write failures',d.failures],['Free heap',d.heap===undefined?'Unknown':d.heap+' bytes'],['Clock',d.clock===undefined?'Unknown':d.clock?'Set for this boot':'Not set for this boot']]){
          const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value??'Unknown';dl.append(dt,dd);
        }
      }
    }
    function consent(){if(!el('controllerConsent').checked)throw Error('Confirm replacing the controller’s saved routine first.');}
    el('controllerConnect').onclick=()=>state.run(async()=>{
      state.usb='choosing';state.say('Choose your ESP32 USB port, often CP2102 or CH340.','busy');
      try{await session.connect();}catch(error){state.usb='disconnected';throw error;}
      await state.identify();
    });
    el('controllerIdentify').onclick=()=>state.run(()=>state.identify());
    el('controllerDisconnect').onclick=()=>state.run(async()=>{await session.disconnect();state.say('USB disconnected. Your saved routine runs without the computer.');});
    el('controllerStatus').onclick=()=>state.run(async()=>{
      const ok=await state.refreshStatus();if(!session.port)return;
      state.say(ok?'Controller status refreshed.':'USB is connected, but status is unavailable. The last snapshot may be out of date.',ok?'info':'error');
    });
    el('controllerLog').onclick=()=>g.downloadText(session.capture.text,'Skelly-USB-log.txt','text/plain');
    async function write(program,kind='routine'){
      consent();
      if(program.rotate&&program.random&&!state.randomScenes)throw Error('Random scenes need the updated universal firmware. Open First-time setup, upload it, then reconnect.');
      const words=r.encode(program.scenes,program.rotate,g.validate,program.random);
      await session.writeSettings(words,r.crc(words),p=>state.say(p==='waiting'?'Received. Waiting for current actions and full cooldowns to finish…':'Sending settings · '+p+'%','busy'));
      state.say('Saved. Checking the controller’s read-back…','busy');
      const saved=await session.readSettings();
      if(r.crc(saved.words)!==saved.crc||saved.crc!==r.crc(words))throw Error('Read-back did not match. Read saved settings before trying again.');
      window.SkellyScenes.recordController?.(r.decode(saved.words,g.DEFAULTS),kind);
      state.say('Saved to ESP32 · read-back verified. Watch Skelly to confirm your changes.','ready');
      await state.refreshStatus();
    }
    el('controllerWrite').onclick=()=>state.run(()=>write({scenes:[{name:'My routine',seconds:600,config:g.readConfig()}],rotate:false}));
    el('controllerScenes').onclick=()=>state.run(async()=>{if(await window.SkellyScenes.confirmSendScenes?.()===false){state.say('No scenes sent. Update the scene or save as new first.');return;}await write(window.SkellyScenes.program(),'scenes');});
    el('controllerRead').onclick=()=>state.run(async()=>{
      state.say('Reading saved settings…','busy');const saved=await session.readSettings();
      if(r.crc(saved.words)!==saved.crc)throw Error('Read-back checksum mismatch.');
      const program=r.decode(saved.words,g.DEFAULTS);
      for(const scene of program.scenes){const errors=g.validate(scene.config);if(errors.length)throw Error(errors.join('\n'));}
      const loaded=await window.SkellyScenes.loadProgram(program);
      window.SkellyScenes.recordController?.(program,'scenes');
      if(loaded===false){state.say('Settings read and verified. Your browser library and editor were kept.');await state.refreshStatus();return;}
      g.writeLibrary({});g.writeConfig(program.scenes[0].config);
      for(const b of document.querySelectorAll('.preset'))b.classList.remove('chosen');
      state.say('Read '+program.scenes.length+' saved scene(s). The first is loaded in Studio.');await state.refreshStatus();
    });
    el('controllerReset').onclick=()=>state.run(async()=>{
      consent();const id=(Date.now()%1000000000)+1,after=session.messageSerial;
      state.say('Restoring firmware defaults after current actions finish…','busy');
      await session.configReply('SKELLY CFG RESET '+id,id,s=>s==='USB CFG QUEUED '+id);
      const done=await session.waitFor(s=>s.startsWith('USB CFG APPLIED '+id+' ')||s.startsWith('USB CFG ERROR '+id+' '),after,210000);
      if(done.text.startsWith('USB CFG ERROR'))throw Error(done.text);
      window.SkellyScenes.recordController?.(null);
      state.say('Firmware defaults restored. Read saved settings to load them in Studio.','ready');await state.refreshStatus();
    });
    el('universalDownload').onclick=()=>{
      try{
        g.downloadText(g.generateRuntimeSketch([{name:'Subtle',seconds:600,config:{...g.DEFAULTS,...g.PRESETS.subtle}}]),'SkellyUniversal.ino','text/plain');
        state.say('Open the downloaded .ino in Arduino IDE, compile/upload with ESP32 Dev Module and core 3.3.12, then close Serial Monitor and connect here.');
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
