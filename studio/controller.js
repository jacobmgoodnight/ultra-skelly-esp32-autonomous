/* Studio USB operations are explicit and acknowledged; status is transport evidence. */
(function(){if(typeof document==='undefined')return;document.addEventListener('DOMContentLoaded',()=>{
  const g=window.SkellyStudioGenerator,r=window.SkellyRuntime,el=id=>document.getElementById(id);let capable=false,randomScenes=false,working=false,wasConnected=false;
  const message=(t,state='info')=>{el('controllerMessage').textContent=t;el('controllerMessage').dataset.state=state;};
  const session=new window.SkellySerial.Session(navigator.serial,update);
  function update(){
    if(wasConnected&&!session.port)message('USB disconnected. Reconnect and identify the firmware before reading or saving.','error');
    wasConnected=!!session.port;
    if(!session.port){capable=false;randomScenes=false;el('controllerDetails').replaceChildren();}
    el('controllerConnect').disabled=!navigator.serial||!!session.port||session.busy||working;
    el('controllerDisconnect').disabled=!session.port||working;el('controllerStatus').disabled=!session.port||working;
    el('controllerIdentify').disabled=!session.port||working;el('controllerLog').disabled=!session.capture.size;
    for(const id of ['controllerRead','controllerWrite','controllerScenes','controllerReset'])el(id).disabled=!session.port||!capable||working;
    const latest=[...session.messages].reverse().find(m=>m.text.startsWith('USB STATUS v2 '));if(latest){const data=Object.fromEntries(latest.text.slice(14).split(' ').filter(s=>s.includes('=')).map(s=>s.split('=')));const dl=el('controllerDetails');dl.replaceChildren();
      for(const [label,value] of [['Skelly Bluetooth',data.connected==='1'?'Connected':'Disconnected'],['Active scene',String(Number(data.scene)+1)],['Saved revision',data.sequence],['Pending settings',data.pending==='1'?'Waiting for active routines':'None'],['BLE write failures',data.failures],['Free heap',data.heap+' bytes'],['Clock',data.clock==='1'?'Set for this boot':'Not set']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);}}
  }
  async function run(fn){if(working)return;working=true;update();try{await fn();}catch(e){message(e.message,'error');}finally{working=false;update();}}
  function consent(){if(!el('controllerConsent').checked)throw Error('Confirm replacing the saved routine first.');}
  async function identify(){
    capable=false;randomScenes=false;update();
    const c=await session.capabilities({onAttempt:n=>message('USB port open · identifying firmware (attempt '+n+'). The ESP32 may restart; allow up to 45 seconds.','busy')});
    capable=/settings=1(?:\s|$)/.test(c.text);randomScenes=/randomScenes=1(?:\s|$)/.test(c.text);await session.status();
    message(capable?'Ready · universal firmware identified. Read saved settings, or save your Studio routine.':'USB connected · this sketch needs the universal firmware for editable settings. Follow first-time setup below.',capable?'ready':'info');
  }
  el('controllerConnect').onclick=()=>run(async()=>{message('Choose the ESP32 USB serial port, such as CP2102 or CH340.','busy');await session.connect();await identify();});
  el('controllerIdentify').onclick=()=>run(identify);
  el('controllerLog').onclick=()=>g.downloadText(session.capture.text,'Skelly-USB-log.txt','text/plain');
  el('controllerDisconnect').onclick=()=>run(async()=>{await session.disconnect();capable=false;message('USB disconnected. Saved routines keep running autonomously.');});
  el('controllerStatus').onclick=()=>run(async()=>{await session.status();message('Status refreshed. Connection and write counts do not confirm physical motion or lighting.');});
  async function write(program){consent();if(program.rotate&&program.random&&!randomScenes)throw Error('Random scene order needs the updated universal firmware. Download and upload it, then reconnect. Your existing saved routine is unchanged.');const words=r.encode(program.scenes,program.rotate,g.validate,program.random);await session.writeSettings(words,r.crc(words),p=>message(p==='waiting'?'Settings received. Waiting for current routines to finish…':'Sending settings: '+p+'%','busy'));const saved=await session.readSettings();if(r.crc(saved.words)!==saved.crc||saved.crc!==r.crc(words))throw Error('Read-back did not match. Read saved settings before trying again.');await session.status();message('Settings saved and read-back verified. Watch Skelly to confirm the physical result.','ready');}
  el('controllerWrite').onclick=()=>run(()=>write({scenes:[{name:'My routine',seconds:600,config:g.readConfig()}],rotate:false}));
  el('controllerScenes').onclick=()=>run(()=>write(window.SkellyScenes.program()));
  el('controllerRead').onclick=()=>run(async()=>{const saved=await session.readSettings();if(r.crc(saved.words)!==saved.crc)throw Error('Read-back checksum mismatch.');const program=r.decode(saved.words,g.DEFAULTS);for(const scene of program.scenes){const errors=g.validate(scene.config);if(errors.length)throw Error(errors.join('\n'));}window.SkellyScenes.loadProgram(program);g.writeLibrary({});g.writeConfig(program.scenes[0].config);for(const b of document.querySelectorAll('.preset'))b.classList.remove('chosen');await session.status();message('Read '+program.scenes.length+' saved scene(s). The first is loaded in Studio.');});
  el('controllerReset').onclick=()=>run(async()=>{consent();const id=(Date.now()%1000000000)+1,after=session.messageSerial;await session.configReply('SKELLY CFG RESET '+id,id,s=>s==='USB CFG QUEUED '+id);const done=await session.waitFor(s=>s.startsWith('USB CFG APPLIED '+id+' ')||s.startsWith('USB CFG ERROR '+id+' '),after,210000);if(done.text.startsWith('USB CFG ERROR'))throw Error(done.text);await session.status();message('Firmware defaults restored. Read settings to view them.');});
  el('universalDownload').onclick=()=>{try{g.downloadText(g.generateRuntimeSketch([{name:'Subtle',seconds:600,config:{...g.DEFAULTS,...g.PRESETS.subtle}}]),'SkellyUniversal.ino','text/plain');message('Next: open the downloaded .ino in Arduino IDE, compile/upload with ESP32 Dev Module and core 3.3.12, close Serial Monitor, then Connect ESP32 USB here. Existing saved USB settings survive firmware uploads.');}catch(e){message(e.message,'error');}};
  if(!navigator.serial)message('USB settings need desktop Chrome or Edge. Scene editing and sketch downloads work here.');update();
});})();
