/* Isolated, opt-in repeat-back experiment. No storage, upload or scheduler access. */
(function(){
  'use strict';
  const RECORD_MS=8000,MAX_BYTES=1024*1024;
  // Wrap Window timer functions so storing them on an engine cannot change their receiver.
  class RepeatBack {
    constructor({media,Recorder,audioFactory=()=>new Audio(),urls=URL,onChange=()=>{},visible=()=>!document.hidden,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}){
      Object.assign(this,{media,Recorder,audioFactory,urls,onChange,visible,setTimer,clearTimer});
      this.generation=0;this.state='idle';this.message='Ready for a short recording.';this.timer=null;this.stream=null;this.recorder=null;this.audio=null;this.clip=null;this.url=null;this.sink='';this.input='';this.voice='original';
    }
    say(state,message){this.state=state;this.message=message;this.onChange(this);}
    deadline(fn,ms){this.clearTimer(this.timer);this.timer=this.setTimer(fn,ms);}
    releaseMic(){const stream=this.stream;this.stream=null;if(stream)for(const track of stream.getTracks()){track.onended=null;track.stop();}}
    releaseAudio(){const audio=this.audio;this.audio=null;if(audio){audio.onended=audio.onerror=null;audio.pause();audio.removeAttribute('src');audio.load();}if(this.url)this.urls.revokeObjectURL(this.url);this.url=null;}
    stop(message='Stopped. Recording discarded; microphone released.'){
      ++this.generation;this.clearTimer(this.timer);this.timer=null;
      const recorder=this.recorder;this.recorder=null;
      if(recorder){recorder.ondataavailable=recorder.onstop=recorder.onerror=null;if(recorder.state!=='inactive')try{recorder.stop();}catch{}}
      this.releaseMic();this.releaseAudio();this.clip=null;this.say('idle',message);
    }
    fail(message){this.stop(message);this.say('error',message);}
    async record(){
      if(!['idle','ready','error'].includes(this.state))return;
      this.stop();const generation=this.generation;
      if(!this.visible())return;
      if(!this.media?.getUserMedia||!this.Recorder){this.fail('Recording needs HTTPS or localhost and a browser with microphone recording support.');return;}
      this.say('requesting','Allow microphone access. Nothing is sent to a server.');
      this.deadline(()=>this.fail('Microphone request timed out. Retry when ready.'),30000);
      try{
        const stream=await this.media.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,...(this.input?{deviceId:{exact:this.input}}:{})},video:false});
        if(generation!==this.generation||!this.visible()){stream.getTracks().forEach(t=>t.stop());if(generation===this.generation)this.stop();return;}
        this.clearTimer(this.timer);this.stream=stream;
        for(const track of stream.getAudioTracks())track.onended=()=>{if(generation===this.generation)this.fail('Microphone disconnected. Recording discarded.');};
        const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>this.Recorder.isTypeSupported?.(t));
        const recorder=new this.Recorder(stream,mime?{mimeType:mime}:undefined);this.recorder=recorder;
        const chunks=[];let bytes=0;
        recorder.ondataavailable=event=>{
          if(generation!==this.generation||!event.data?.size)return;
          bytes+=event.data.size;if(bytes>MAX_BYTES){this.fail('Recording exceeded the 1 MiB limit and was discarded.');return;}chunks.push(event.data);
        };
        recorder.onerror=()=>{if(generation===this.generation)this.fail('Microphone recording failed. Try again.');};
        recorder.onstop=()=>{
          if(generation!==this.generation)return;
          this.clearTimer(this.timer);this.timer=null;this.recorder=null;this.releaseMic();
          if(!bytes){this.fail('No audio was captured. Check your microphone and try again.');return;}
          this.clip=new Blob(chunks,{type:recorder.mimeType||chunks[0].type});
          this.say('ready','Recording ready. Microphone off. Choose Repeat to play it.');
        };
        recorder.start(250);this.say('recording','Recording · maximum 8 seconds. Stop recording when finished.');
        this.deadline(()=>this.finish(),RECORD_MS);
      }catch(error){if(generation===this.generation)this.fail(error.name==='NotAllowedError'?'Microphone permission denied. Allow access in your browser and retry.':this.input&&['NotFoundError','OverconstrainedError'].includes(error.name)?'Selected microphone unavailable. Choose microphone again; no other input was substituted.':'Could not start the microphone. Check the selected input and close other recording apps.');}
    }
    finish(){
      if(this.state!=='recording')return;
      this.clearTimer(this.timer);this.say('finishing','Finishing recording…');
      this.deadline(()=>this.fail('Recorder did not finish. Recording discarded.'),3000);
      try{this.recorder.stop();this.releaseMic();}catch{this.fail('Could not finish recording. Try again.');}
    }
    async play(){
      if(this.state!=='ready'||!this.clip||!this.visible())return;
      const generation=this.generation;this.releaseMic();this.releaseAudio();
      let audio;
      this.say('playing','Repeating through the selected computer audio output. Microphone off.');
      this.deadline(()=>{if(generation===this.generation)this.fail('Playback timed out. Check the audio output and record again.');},15000);
      try{
        audio=this.audioFactory();this.audio=audio;
        if(!['original','deep'].includes(this.voice)){this.fail('Choose an available playback voice.');return;}
        if(this.voice==='deep'){
          if(!('preservesPitch' in audio)){this.fail('Deep voice is unavailable in this browser. Choose Original voice.');return;}
          audio.preservesPitch=false;audio.defaultPlaybackRate=.8;
        }
        if(this.sink){if(!audio.setSinkId)throw Error('Output selection is unavailable.');await audio.setSinkId(this.sink);}
        if(generation!==this.generation||this.audio!==audio)return;
        this.url=this.urls.createObjectURL(this.clip);audio.src=this.url;
        if(this.voice==='deep')audio.playbackRate=.8;
        audio.onended=()=>{if(generation!==this.generation||this.audio!==audio)return;this.clearTimer(this.timer);this.releaseAudio();this.say('ready','Playback ended in the browser. Observe Skelly separately to confirm sound and jaw movement.');};
        audio.onerror=()=>{if(generation===this.generation&&this.audio===audio)this.fail('Playback failed. Check your audio output and record again.');};
        await audio.play();
        if(generation!==this.generation){audio.pause();audio.removeAttribute('src');audio.load();}
      }catch{if(generation===this.generation&&(!audio||this.audio===audio))this.fail('Could not play the recording. Check output selection and browser playback permission.');}
    }
  }

  // Only a one-shot live-audio enable command. Never files, motor masks or settings.
  class LiveLink {
    constructor(bluetooth,frame,{setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id),onChange=()=>{}}={}){Object.assign(this,{bluetooth,frame,setTimer,clearTimer,onChange});this.generation=0;this.device=null;this.busy=false;this.cancelWait=null;this.stage='idle';this.writeAttempted=false;this.writeCompleted=false;}
    progress(stage,message){this.stage=stage;this.onChange(message);}
    cancel(){++this.generation;this.cancelWait?.();const d=this.device;this.device=null;if(d?.gatt.connected)d.gatt.disconnect();}
    async bounded(promise,generation,ms=10000){
      if(generation!==this.generation)throw Error('Live setup cancelled.');let timer,cancel;
      try{return await Promise.race([promise,new Promise((_,reject)=>{cancel=()=>reject(Error('Live setup cancelled.'));this.cancelWait=cancel;timer=this.setTimer(()=>reject(Object.assign(Error('Live setup timed out. No automatic retry.'),{timedOut:true})),ms);})]);}
      finally{this.clearTimer(timer);if(this.cancelWait===cancel)this.cancelWait=null;}
    }
    async enable(name){
      if(this.busy)throw Error('Live setup is already running.');
      if(!this.bluetooth)throw Error('Use desktop Chrome/Edge with Web Bluetooth for live setup.');
      if(typeof name!=='string'||!name.trim()||name.length>48||/[\x00-\x1f]/.test(name)||/12\s*ft/i.test(name))throw Error('Use the advertised name of your 6.5-foot Ultra Skelly. The 12-foot model is excluded.');
      this.busy=true;this.writeAttempted=this.writeCompleted=false;
      const generation=++this.generation,check=()=>{if(generation!==this.generation)throw Error('Live setup cancelled.');};
      try{
        this.progress('chooser','Step 1 of 4: choose your Ultra Skelly in the browser’s Bluetooth chooser.');
        const device=await this.bounded(this.bluetooth.requestDevice({filters:[{name:name.trim()}],optionalServices:['0000ae00-0000-1000-8000-00805f9b34fb']}),generation,120000);check();this.device=device;
        this.progress('connection','Step 2 of 4: connecting to Skelly over BLE. No live-enable request has been sent.');
        const connecting=device.gatt.connect();connecting.then(server=>{if(generation!==this.generation&&server.connected)server.disconnect();}).catch(()=>{});
        const server=await this.bounded(connecting,generation);check();
        this.progress('service','Step 3 of 4: connected; finding Skelly’s control service. No live-enable request has been sent.');
        const service=await this.bounded(server.getPrimaryService('0000ae00-0000-1000-8000-00805f9b34fb'),generation);check();
        this.progress('writer','Step 3 of 4: finding Skelly’s write characteristic. No live-enable request has been sent.');
        const writer=await this.bounded(service.getCharacteristic('0000ae01-0000-1000-8000-00805f9b34fb'),generation);check();
        if(!server.connected)throw Error('Skelly disconnected before the request.');
        this.progress('write','Step 4 of 4: sending one live-audio enable request.');
        const bytes=this.frame(0xfd,[1]);this.writeAttempted=true;
        await this.bounded(writer.writeValueWithoutResponse(bytes),generation);this.writeCompleted=true;check();
        return 'Live-enable write completed'+(server.connected?'':'; Skelly disconnected afterward')+'. Speaker/jaw response is unverified. Pair the (Live) speaker through Windows Add a device. If asked for a PIN, try the documented default 1234, or your configured PIN if changed.';
      }catch(cause){
        const cancelled=generation!==this.generation;
        let message;
        if(this.writeAttempted)message='Live setup '+(cancelled?'was cancelled':cause.timedOut?'timed out':'failed')+' after a write was attempted. The live-enable request may have reached Skelly; sound and jaw response are unverified. Check the prop and power-cycle it before another setup attempt.';
        else if(cancelled)message='Live setup cancelled before the write. No live-enable request was sent.';
        else if(this.stage==='connection')message='BLE connection '+(cause.timedOut?'timed out':'failed')+' before live enable. No live-enable request was sent. Unplug the autonomous ESP32, including USB; close other Skelly apps/tabs; then power-cycle Skelly in Bluetooth mode before one manual retry.';
        else if(this.stage==='service'||this.stage==='writer')message='Connected, but '+(cause.timedOut?'timed out finding':'could not find')+' Skelly’s '+(this.stage==='service'?'control service':'write characteristic')+'. No live-enable request was sent. Confirm this is the 6.5-foot Ultra Skelly and power-cycle it before one manual retry.';
        else message='Bluetooth device selection '+(cause.timedOut?'timed out':'did not complete')+'. No live-enable request was sent. Choose your Ultra Skelly again when ready.';
        throw Object.assign(Error(message),{cause,stage:this.stage,writeAttempted:this.writeAttempted,writeCompleted:this.writeCompleted,cancelled});
      }finally{this.cancel();this.busy=false;}
    }
  }
  const api={RepeatBack,LiveLink,RECORD_MS,MAX_BYTES};
  if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.SkellyTalkback=api;
})();
