/* Local, opt-in speech-energy pilot. No transcription, network or BLE access. */
(function(){
  'use strict';
  const RATE=16000,PHRASE_SAMPLES=RATE*8,SESSION_MS=120000,PAUSE_MS=45000,MAX_REPEATS=2;
  const WORKLET=`class SkellyCapture extends AudioWorkletProcessor{
    constructor(){super();this.buffer=new Float32Array(1024);this.at=0;this.pending=0;this.missed=0;this.port.onmessage=()=>{this.pending=Math.max(0,this.pending-1);};}
    process(inputs){const input=inputs[0]?.[0];if(input)for(const sample of input){
      this.buffer[this.at++]=sample;
      if(this.at===this.buffer.length){
        if(this.pending<4){this.port.postMessage({samples:this.buffer,missed:this.missed},[this.buffer.buffer]);this.pending++;this.missed=0;this.buffer=new Float32Array(1024);}
        else this.missed+=this.buffer.length;
        this.at=0;
      }
    }return true;}
  }registerProcessor('skelly-capture',SkellyCapture);`;

  class SpeechGate{
    constructor(threshold=.025){
      if(!Number.isFinite(threshold)||threshold<.005||threshold>.1)throw Error('Invalid sensitivity.');
      Object.assign(this,{threshold,calibration:0,power:0,pre:[],preSamples:0,chunks:[],samples:0,attack:0,voiced:0,quiet:0,speaking:false});
    }
    push(input){
      if(!(input instanceof Float32Array)||!input.length||input.length>2048)throw Error('Invalid audio block.');
      let power=0;for(const value of input){if(!Number.isFinite(value)||Math.abs(value)>1.01)throw Error('Invalid audio samples.');power+=value*value;}
      const rms=Math.sqrt(power/input.length);
      if(this.calibration<RATE){
        this.calibration+=input.length;this.power+=power;
        if(this.calibration>=RATE){const noise=Math.sqrt(this.power/this.calibration);if(noise>.06)throw Error('Background is too loud. Restart in a quieter position.');this.threshold=Math.max(this.threshold,noise*3);}
        return {kind:'calibrating'};
      }
      if(!this.speaking){
        this.pre.push(input.slice());this.preSamples+=input.length;
        while(this.preSamples>RATE/4){const excess=this.preSamples-RATE/4,first=this.pre[0];if(first.length<=excess){this.pre.shift();this.preSamples-=first.length;}else{this.pre[0]=first.slice(excess);this.preSamples-=excess;}}
        this.attack=rms>=this.threshold?this.attack+input.length:0;
        if(this.attack<RATE*.12)return {kind:'waiting'};
        this.speaking=true;this.chunks=this.pre;this.samples=this.preSamples;this.voiced=this.attack;this.pre=[];this.preSamples=0;
        return {kind:'speech'};
      }
      const block=input.slice(0,PHRASE_SAMPLES-this.samples);this.chunks.push(block);this.samples+=block.length;
      if(rms>=this.threshold*.65){this.quiet=0;this.voiced+=block.length;}else this.quiet+=block.length;
      if(this.samples<PHRASE_SAMPLES&&this.quiet<RATE*.8)return {kind:'speech'};
      if(this.voiced<RATE*.2){this.chunks=[];this.samples=this.attack=this.voiced=this.quiet=0;this.speaking=false;return {kind:'waiting'};}
      const end=Math.min(this.samples,this.samples-this.quiet+RATE*.15),samples=new Float32Array(end);let at=0;
      for(const chunk of this.chunks){const part=chunk.subarray(0,end-at);samples.set(part,at);at+=part.length;if(at>=end)break;}
      this.chunks=[];return {kind:'phrase',samples};
    }
  }
  function wav(samples){
    if(!(samples instanceof Float32Array)||!samples.length||samples.length>PHRASE_SAMPLES)throw Error('Phrase exceeded its limit.');
    const bytes=new ArrayBuffer(44+samples.length*2),view=new DataView(bytes),text=(at,value)=>{for(let i=0;i<value.length;i++)view.setUint8(at+i,value.charCodeAt(i));};
    text(0,'RIFF');view.setUint32(4,bytes.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
    view.setUint32(24,RATE,true);view.setUint32(28,RATE*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);
    samples.forEach((value,i)=>{if(!Number.isFinite(value))throw Error('Invalid phrase.');value=Math.max(-1,Math.min(1,value));view.setInt16(44+i*2,value<0?value*32768:value*32767,true);});
    return new Blob([bytes],{type:'audio/wav'});
  }

  class PcmCapture{
    constructor({media,Context,WorkletNode,urls=URL}){Object.assign(this,{media,Context,WorkletNode,urls});this.generation=0;this.stream=this.context=this.node=this.source=this.gain=null;this.url=null;this.onState=()=>{};}
    stop(){
      ++this.generation;const stream=this.stream,context=this.context;this.stream=this.context=null;
      if(this.node){this.node.port.onmessage=null;this.node.onprocessorerror=null;this.node.port.close();this.node.disconnect();}this.node=null;
      this.source?.disconnect();this.gain?.disconnect();this.source=this.gain=null;
      if(stream)for(const track of stream.getTracks()){track.onended=null;track.stop();}
      if(context){context.onstatechange=null;context.close().catch(()=>{});}
      if(this.url)this.urls.revokeObjectURL(this.url);this.url=null;this.onState();
    }
    async start(onChunk,onError,onState=()=>{}){
      this.stop();this.onState=onState;const generation=this.generation;
      try{
        const context=this.context=new this.Context({sampleRate:RATE});
        // Resume in the Start click, before awaiting a permission dialog.
        const resumed=context.resume();resumed.catch(()=>{});
        const stream=await this.media.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:false},video:false});
        if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return false;}
        this.stream=stream;this.onState();await resumed;
        if(generation!==this.generation)return false;
        if(context.sampleRate!==RATE||!context.audioWorklet)throw Error('This browser cannot provide the pilot audio capture. Use manual recording.');
        this.url=this.urls.createObjectURL(new Blob([WORKLET],{type:'text/javascript'}));await context.audioWorklet.addModule(this.url);
        if(generation!==this.generation)return false;
        this.urls.revokeObjectURL(this.url);this.url=null;
        const node=this.node=new this.WorkletNode(context,'skelly-capture',{channelCount:1,channelCountMode:'explicit'});
        node.port.onmessage=event=>{
          if(generation!==this.generation)return;
          try{if(event.data.missed)throw Error('Audio processing fell behind. Restart the pilot.');onChunk(event.data.samples);}
          catch(error){onError(error);}
          finally{if(generation===this.generation)node.port.postMessage('ack');}
        };
        node.onprocessorerror=()=>{if(generation===this.generation)onError(Error('Audio capture failed. Restart the pilot.'));};
        for(const track of stream.getAudioTracks())track.onended=()=>{if(generation===this.generation)onError(Error('Microphone disconnected.'));};
        this.source=context.createMediaStreamSource(stream);this.gain=context.createGain();this.gain.gain.value=0;
        this.source.connect(node);node.connect(this.gain);this.gain.connect(context.destination);
        context.onstatechange=()=>{if(generation===this.generation&&context.state!=='running')onError(Error('Audio capture was interrupted.'));};
        return true;
      }catch(error){if(generation===this.generation)this.stop();throw error;}
    }
  }

  class AutomaticRepeat{
    constructor({repeat,captureFactory,onChange=()=>{},visible=()=>!document.hidden,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}){
      Object.assign(this,{repeat,captureFactory,onChange,visible,setTimer,clearTimer});this.generation=0;this.active=false;this.phase='idle';this.message='Automatic pilot is off.';this.capture=null;this.gate=null;this.repeats=0;this.sessionTimer=this.phaseTimer=null;
    }
    say(phase,message){this.phase=phase;this.message=message;this.onChange(this);}
    stopCapture(){const capture=this.capture;this.capture=null;capture?.stop();this.gate=null;}
    stop(message='Automatic pilot stopped. Microphone off; audio discarded.'){
      ++this.generation;this.active=false;this.clearTimer(this.sessionTimer);this.clearTimer(this.phaseTimer);this.sessionTimer=this.phaseTimer=null;this.stopCapture();this.repeat.stop();this.say('idle',message);
    }
    async start(threshold=.025){
      if(this.active||!this.visible()||!['idle','ready','error'].includes(this.repeat.state))return;
      new SpeechGate(threshold);this.stop();this.threshold=threshold;this.repeats=0;this.active=true;const generation=this.generation;
      this.sessionTimer=this.setTimer(()=>this.stop('Two-minute pilot limit reached. Microphone off.'),SESSION_MS);
      await this.listen(generation);
    }
    async listen(generation){
      if(!this.active||generation!==this.generation||!this.visible()){if(generation===this.generation)this.stop();return;}
      this.gate=new SpeechGate(this.threshold);this.say('requesting','Allow microphone access, then stay quiet for one second.');
      let capture;this.phaseTimer=this.setTimer(()=>this.stop('Microphone setup timed out. Restart when ready.'),30000);
      try{
        capture=this.capture=this.captureFactory();
        const started=await capture.start(samples=>this.receive(samples,generation),error=>{if(generation===this.generation)this.stop(error.name==='NotAllowedError'?'Microphone permission denied.':error.message);},()=>this.onChange(this));
        if(generation!==this.generation){capture.stop();return;}if(!started){this.stop();return;}
        this.clearTimer(this.phaseTimer);this.phaseTimer=this.setTimer(()=>this.stop('No complete phrase within 30 seconds. Microphone off; restart when ready.'),30000);
        this.say('calibrating','Microphone ON. Stay quiet for one second to measure background noise.');
      }catch(error){if(generation===this.generation)this.stop(error.name==='NotAllowedError'?'Microphone permission denied.':error.message);}
    }
    receive(samples,generation){
      if(!this.active||generation!==this.generation||!['calibrating','listening','capturing'].includes(this.phase))return;
      try{
        const result=this.gate.push(samples);
        if(result.kind==='waiting'&&this.phase!=='listening')this.say('listening','Listening for a phrase. Sound level detection can also react to noise.');
        if(result.kind==='speech'&&this.phase!=='capturing')this.say('capturing','Capturing your phrase · maximum 8 seconds.');
        if(result.kind!=='phrase')return;
        this.clearTimer(this.phaseTimer);this.phaseTimer=null;this.say('preparing','Phrase captured. Turning microphone off before playback.');this.stopCapture();
        this.repeat.clip=wav(result.samples);this.repeat.say('ready','Automatic phrase ready. Microphone off.');
        this.repeats++;this.say('playing','Repeating phrase '+this.repeats+' of '+MAX_REPEATS+'. Microphone OFF.');void this.repeat.play();
      }catch(error){this.stop(error.message);}
    }
    changed(){
      if(!this.active)return;
      if(this.repeat.state==='error'){this.stop('Pilot stopped: '+this.repeat.message);return;}
      if(this.phase!=='playing'||this.repeat.state!=='ready')return;
      if(this.repeats>=MAX_REPEATS){this.stop('Pilot complete: two phrases repeated. Microphone off.');return;}
      this.say('cooldown','Microphone OFF. Pausing 45 seconds before listening for the second phrase.');this.repeat.stop();
      const generation=this.generation;this.phaseTimer=this.setTimer(()=>{this.phaseTimer=null;void this.listen(generation);},PAUSE_MS);
    }
  }
  const api={SpeechGate,PcmCapture,AutomaticRepeat,wav,RATE,PHRASE_SAMPLES,SESSION_MS,PAUSE_MS,MAX_REPEATS,WORKLET};
  if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.SkellyTalkbackAuto=api;
})();
