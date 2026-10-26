/* One USB session; background status yields to explicit controller operations. */
(function(){
  'use strict';
  function parseStatus(text){
    if(!text.startsWith('USB STATUS v2 '))throw Error('Unsupported controller status.');
    const data={};
    for(const field of text.slice(14).trim().split(/\s+/)){
      const match=/^([A-Za-z]+)=(\d+)$/.exec(field);
      if(!match||Object.hasOwn(data,match[1]))throw Error('Malformed controller status.');
      const value=Number(match[2]);if(!Number.isSafeInteger(value)||value>0xffffffff)throw Error('Malformed controller status.');data[match[1]]=value;
    }
    for(const key of ['connected','scene','sequence','pending'])if(!Object.hasOwn(data,key))throw Error('Incomplete controller status.');
    for(const key of ['connected','pending','clock','window','runtime','accepted'])if(data[key]!==undefined&&![0,1].includes(data[key]))throw Error('Malformed controller status.');
    if(data.scene>3||data.wait!==undefined&&data.wait>8||data.accepted===1&&data.acceptedAge===undefined)throw Error('Malformed controller status.');return data;
  }
  class ControllerState {
    constructor(session,{onChange=()=>{},hidden=()=>false,now=()=>Date.now(),setTimer=(fn,delay)=>setTimeout(fn,delay),clearTimer=id=>clearTimeout(id)}={}){
      Object.assign(this,{session,onChange,hidden,now,setTimer,clearTimer});
      this.port=session.port;this.generation=0;this.identified=false;this.capable=false;this.randomScenes=this.audioScenes=false;
      this.usb='disconnected';this.busy=false;this.suspended=false;this.message='Connect your ESP32 to read or save settings.';this.tone='info';
      this.data=null;this.receivedAt=null;this.stale=false;this.timer=null;this.pollTask=null;this.pollAbort=null;
      session.onChange=()=>this.transportChanged();
    }
    notify(){this.onChange(this);}
    say(text,tone='info'){this.message=text;this.tone=tone;this.notify();}
    stopTimer(){if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;}
    transportChanged(){
      if(this.port!==this.session.port){
        const hadPort=!!this.port;this.port=this.session.port;++this.generation;
        this.stopTimer();this.pollAbort?.abort();this.data=null;this.receivedAt=null;this.stale=false;
        this.identified=this.capable=this.randomScenes=this.audioScenes=false;this.usb=this.port?'identifying':'disconnected';
        if(hadPort&&!this.port){this.message='USB disconnected. Reconnect to read or save settings.';this.tone=this.session.error?'error':'info';}
      }
      this.notify();
    }
    eligible(){return !!this.port&&this.port===this.session.port&&this.identified&&!this.busy&&!this.suspended&&!this.hidden()&&!this.session.operation&&!this.session.closing;}
    schedule(delay=5000){
      this.stopTimer();if(!this.eligible()||this.pollTask)return;
      this.timer=this.setTimer(()=>{this.timer=null;void this.poll();},delay);
    }
    async refreshStatus(signal){
      const generation=this.generation,port=this.port;
      try{
        const reply=await this.session.status({timeout:8000,signal});
        if(signal?.aborted||generation!==this.generation||!port||port!==this.session.port)return false;
        const data=parseStatus(reply.text);this.data=data;this.receivedAt=this.now();this.stale=false;this.notify();return true;
      }catch(error){
        if(error.name==='AbortError')return false;
        if(generation===this.generation&&this.port){this.stale=true;this.notify();}
        return false;
      }
    }
    poll(){
      if(!this.eligible()||this.pollTask)return this.pollTask;
      const abort=new AbortController();this.pollAbort=abort;
      const task=this.refreshStatus(abort.signal).finally(()=>{
        if(this.pollTask===task){this.pollTask=null;this.pollAbort=null;this.schedule();}
      });
      this.pollTask=task;return task;
    }
    async pausePolling(){this.stopTimer();this.pollAbort?.abort();if(this.pollTask)await this.pollTask;this.stopTimer();}
    async visibilityChanged(){await this.pausePolling();if(!this.hidden())this.schedule(0);}
    async run(action){
      if(this.busy)return false;this.busy=true;this.notify();
      try{await this.pausePolling();await action();return true;}
      catch(error){if(this.port&&!this.identified)this.usb='unidentified';this.say(error.message,'error');return false;}
      finally{this.busy=false;this.notify();this.schedule();}
    }
    async identify(){
      const generation=this.generation,port=this.port;
      this.identified=this.capable=this.randomScenes=this.audioScenes=false;this.usb='identifying';this.data=null;this.receivedAt=null;this.stale=false;
      const caps=await this.session.capabilities({onAttempt:n=>this.say('Identifying firmware · attempt '+n+'. The ESP32 may restart; allow up to 45 seconds.','busy')});
      if(!port||port!==this.session.port||generation!==this.generation)throw Error('USB disconnected. Reconnect to identify the firmware.');
      this.identified=true;this.capable=/settings=1(?:\s|$)/.test(caps.text);this.randomScenes=/randomScenes=1(?:\s|$)/.test(caps.text);
      this.audioScenes=/audioScenes=1(?:\s|$)/.test(caps.text);
      this.usb=this.capable?'ready':'unsupported';await this.refreshStatus();
      if(port!==this.session.port||generation!==this.generation)throw Error('USB disconnected. Reconnect to identify the firmware.');
      this.say(this.capable?'Ready. Read saved settings, or save your routine to the ESP32.':'USB connected. Install universal firmware using First-time setup to save settings here.',this.capable?'ready':'info');
    }
  }
  function connectionView(state){
    const usb={disconnected:'Not connected',choosing:'Choose a USB port',identifying:'Identifying firmware…',ready:'Ready',unsupported:'Universal firmware needed',unidentified:'Port open · retry identification'}[state.usb];
    const data=state.port?state.data:null;
    const skelly=!data?'Unknown':state.stale?'Last reported: '+(data.connected?'Connected':'Not connected'):data.connected?'Connected':'Not connected yet';
    return {usb,skelly,scene:data?'Scene '+(data.scene+1):'—',usbTone:state.usb==='ready'?'ready':'info',skellyTone:data&&!state.stale&&data.connected?'ready':'info'};
  }
  function workflowView(state,{supported=true,reviewed=false,verified=false,valid=true,consent=false,activeStep=null}={}){
    if(!supported)return {step:'Connect',action:null,hint:'Use desktop Chrome or Edge to connect USB. Editing and downloads still work here.'};
    if(state.busy)return {step:activeStep??(state.usb==='choosing'||state.usb==='identifying'?'Connect':reviewed?'Save':'Read'),action:null,hint:'Wait for the current operation to finish.'};
    if(!state.port)return {step:'Connect',action:'controllerConnect',hint:'Next: connect your ESP32 with a USB data cable.'};
    if(!state.identified)return {step:'Connect',action:'controllerIdentify',hint:'Next: retry identification. If it fails, open connection troubleshooting below.'};
    if(!state.capable)return {step:'Connect',action:null,hint:'Next: open First-time setup below to install compatible universal firmware.'};
    if(state.tone==='error'&&/updated universal firmware/.test(state.message))return {step:'Connect',action:null,hint:'Next: open First-time setup below to update universal firmware, then reconnect.'};
    if(state.tone==='error'&&/Save was not verified|checksum mismatch/.test(state.message)||/Firmware defaults restored/.test(state.message))return {step:'Read',action:'controllerRead',hint:'Next: read saved settings to check what is on the ESP32 before saving again.'};
    if(verified&&state.tone!=='error')return {step:'Done',action:null,hint:'You can disconnect USB. The ESP32 will keep running the saved program.'};
    if(!reviewed&&!consent)return {step:'Read',action:'controllerRead',hint:'Next: read saved settings before editing an existing setup. For a new routine, continue to Save below.'};
    return {step:'Save',action:valid?'controllerWrite':null,hint:!valid?'Fix the highlighted settings below before saving this routine.':consent?'Next: Save this routine to the ESP32.':'Next: check replacement consent, then Save this routine.'};
  }
  function diagnosticView(data,stale=false){
    if(!data)return [];
    const reasons=['Waiting for requested intervals','Waiting for Skelly Bluetooth','Estimated clip playback','Eye/light restoration or correction queued','Motor cooldown (modeled)','Idle break','Clock window closed / time not set','Jaw-first follow-up','Audio scene protected window (estimated)'];
    const rows=[];
    if(data.firmware!==undefined)rows.push(['Firmware','Revision '+data.firmware+(data.build===undefined?'':' · build '+data.build)]);
    if(data.wait!==undefined)rows.push([stale?'Last reported activity / wait':'Controller activity / wait',(data.pending?'Settings/scene change pending · ':'')+reasons[data.wait]]);
    if(data.jawMs!==undefined&&data.jawMs>0)rows.push([stale?'Last protected-time estimate':'Protected-time estimate',Math.ceil(data.jawMs/1000)+' seconds remaining (modeled)']);
    if(data.accepted!==undefined)rows.push([stale?'Last reported write age':'Last accepted BLE write',data.accepted?Math.floor(data.acceptedAge/1000)+' seconds before this snapshot':'None reported']);
    return rows;
  }
  const api={ControllerState,parseStatus,connectionView,workflowView,diagnosticView};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window!=='undefined')window.SkellyControllerState=api;
})();
