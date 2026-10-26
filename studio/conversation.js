/* One attended local conversation turn. Raw captured audio is never played. */
(function(){
  'use strict';
  const MAX_WAV=256044,PAUSE_MS=45000;
  async function readJSON(response,limit=400000){
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Local reply exceeded its limit.');}chunks.push(value);}}
    finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function decodeReply(value){
    if(!value||!Number.isInteger(value.card)||value.card<0||value.card>=20||typeof value.text!=='string'||value.text.length>180||typeof value.audio!=='string'||value.audio.length>341392||!/^[A-Za-z0-9+/]*={0,2}$/.test(value.audio))throw Error('Invalid local reply. Nothing was played.');
    const binary=atob(value.audio);if(binary.length<=44||binary.length>MAX_WAV)throw Error('Invalid local audio. Nothing was played.');
    return {text:value.text,clip:new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type:'audio/wav'})};
  }
  class Conversation{
    constructor({repeat,captureFactory,gateFactory,encode,request,onChange=()=>{},onLevel=()=>{},visible=()=>!document.hidden,now=()=>Date.now(),setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}){
      Object.assign(this,{repeat,captureFactory,gateFactory,encode,request,onChange,onLevel,visible,now,setTimer,clearTimer});
      this.generation=0;this.active=false;this.phase='idle';this.message='Check the local engine, then choose Talk.';this.capture=this.gate=this.abort=this.timer=null;this.cooldownUntil=0;this.replyText='';
    }
    get remaining(){return Math.max(0,Math.ceil((this.cooldownUntil-this.now())/1000));}
    say(phase,message){this.phase=phase;this.message=message;this.onChange(this);}
    releaseCapture(){const capture=this.capture;this.capture=this.gate=null;capture?.stop();this.onLevel(0,0,'off');}
    stop(message='Stopped. Microphone off; phrase and reply forgotten.'){
      ++this.generation;this.active=false;this.clearTimer(this.timer);this.timer=null;this.abort?.abort();this.abort=null;this.releaseCapture();this.repeat.stop();this.replyText='';this.say('idle',message);
    }
    async start(threshold=.025){
      if(this.active||this.remaining||!this.visible()||!['idle','ready','error'].includes(this.repeat.state))return;
      this.stop();this.gate=this.gateFactory(threshold);this.active=true;const generation=this.generation;
      this.say('requesting','Allow microphone access, then stay quiet for one second.');
      this.timer=this.setTimer(()=>this.stop('Microphone setup timed out. Nothing played.'),30000);
      let capture;
      try{
        capture=this.capture=this.captureFactory();
        const started=await capture.start(samples=>this.receive(samples,generation),error=>{if(generation===this.generation)this.stop(error.name==='NotAllowedError'?'Microphone permission denied.':error.message);},()=>this.onChange(this));
        if(generation!==this.generation){capture.stop();return;}if(!started){this.stop();return;}
        this.clearTimer(this.timer);this.timer=this.setTimer(()=>this.stop('No complete phrase within 30 seconds. Microphone off.'),30000);
        this.say('calibrating','Microphone ON. Stay quiet for one second, then speak and pause.');
      }catch(error){if(generation===this.generation)this.stop(error.name==='NotAllowedError'?'Microphone permission denied.':error.message);}
    }
    receive(samples,generation){
      if(!this.active||generation!==this.generation||!['calibrating','listening','capturing'].includes(this.phase))return;
      try{
        const result=this.gate.push(samples);this.onLevel(this.gate.level,this.gate.threshold,result.kind);
        if(result.kind==='waiting'&&this.phase!=='listening')this.say('listening','Listening. Ask for a joke, say hello, or tell Skelly your first name.');
        if(result.kind==='speech'&&this.phase!=='capturing')this.say('capturing','Capturing one phrase · maximum eight seconds.');
        if(result.kind!=='phrase')return;
        this.clearTimer(this.timer);this.timer=null;this.releaseCapture();
        void this.respond(this.encode(result.samples),generation);
      }catch(error){this.stop(error.message);}
    }
    async respond(clip,generation){
      this.say('thinking','Microphone OFF. Choosing a family Halloween reply locally…');
      const abort=this.abort=new AbortController();this.timer=this.setTimer(()=>this.stop('Local reply timed out. Nothing played.'),45000);
      try{
        const value=await this.request(clip,abort.signal);
        if(generation!==this.generation||!this.active||!this.visible())return;
        const reply=decodeReply(value);this.clearTimer(this.timer);this.timer=null;this.abort=null;
        this.replyText=reply.text;this.repeat.clip=reply.clip;this.repeat.say('ready','Approved local reply ready.');
        // Preserve a conservative pause even if Stop interrupts playback.
        this.cooldownUntil=this.now()+15000+PAUSE_MS;
        this.say('playing','Speaking an approved Halloween reply. Microphone OFF.');void this.repeat.play();
      }catch(error){if(generation===this.generation)this.stop(error.message||'Could not get the local reply. Nothing played.');}
    }
    changed(){
      if(!this.active)return;
      if(this.repeat.state==='error'){this.stop(this.repeat.message);return;}
      if(this.phase!=='playing'||this.repeat.state!=='ready')return;
      this.active=false;this.cooldownUntil=this.now()+PAUSE_MS;this.repeat.stop();this.say('idle','Reply finished. Microphone off. Choose Talk again after the pause.');
    }
  }
  const api={Conversation,decodeReply,readJSON,MAX_WAV,PAUSE_MS};
  if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.SkellyConversation=api;
})();
