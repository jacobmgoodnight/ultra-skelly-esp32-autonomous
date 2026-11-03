/* One attended local conversation turn. Raw captured audio is never played. */
(function(){
  'use strict';
  const MAX_WAV=256044,MAX_REPLY_WAV=352844,PAUSE_MS=45000;
  async function readJSON(response,limit=500000){
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Local reply exceeded its limit.');}chunks.push(value);}}
    finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function decodeReply(value){
    if(!value||!Number.isInteger(value.card)||value.card<0||value.card>=20||typeof value.text!=='string'||value.text.length>180||typeof value.audio!=='string'||value.audio.length>470460||!/^[A-Za-z0-9+/]*={0,2}$/.test(value.audio))throw Error('Invalid local reply. Nothing was played.');
    const binary=atob(value.audio);if(binary.length<=44||binary.length>MAX_REPLY_WAV)throw Error('Invalid local audio. Nothing was played.');
    return {text:value.text,clip:new Blob([Uint8Array.from(binary,c=>c.charCodeAt(0))],{type:'audio/wav'})};
  }
  function decodeCue(value){
    if(!value||typeof value.audio!=='string'||value.audio.length>117660||!/^[A-Za-z0-9+/]*={0,2}$/.test(value.audio))throw Error('Invalid thinking cue.');
    const binary=atob(value.audio),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    if(bytes.length<=44||bytes.length>88244)throw Error('Invalid thinking cue.');
    const view=new DataView(bytes.buffer),str=(at,n)=>String.fromCharCode(...bytes.slice(at,at+n));
    if(str(0,4)!=='RIFF'||str(8,4)!=='WAVE'||view.getUint32(4,true)+8!==bytes.length||str(12,4)!=='fmt '||view.getUint32(16,true)!==16||view.getUint16(20,true)!==1||view.getUint16(22,true)!==1||view.getUint32(24,true)!==22050||view.getUint32(28,true)!==44100||view.getUint16(32,true)!==2||view.getUint16(34,true)!==16||str(36,4)!=='data'||view.getUint32(40,true)!==bytes.length-44||(bytes.length-44)%2)throw Error('Invalid thinking cue.');
    return new Blob([bytes],{type:'audio/wav'});
  }
  // Cached, checked E-voice audio only. This player never opens a microphone.
  class ThinkingCue{
    constructor({audioFactory=()=>new Audio(),urls=URL,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}={}){
      Object.assign(this,{audioFactory,urls,setTimer,clearTimer});this.generation=0;this.finished=Promise.resolve();
    }
    stop(){
      ++this.generation;this.clearTimer(this.timer);this.timer=null;
      if(this.audio){this.audio.onended=this.audio.onerror=null;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio=null;}
      if(this.url)this.urls.revokeObjectURL(this.url);this.url=null;
      this.resolve?.();this.resolve=null;
    }
    play(clip,voice){
      this.stop();const generation=this.generation;
      this.finished=new Promise(resolve=>{this.resolve=resolve;});
      try{
        const audio=this.audio=this.audioFactory();audio.volume=.6;
        if(voice==='deep'){audio.preservesPitch=false;audio.defaultPlaybackRate=audio.playbackRate=.8;}
        this.url=this.urls.createObjectURL(clip);audio.src=this.url;
        audio.onended=audio.onerror=()=>{if(generation===this.generation)this.stop();};
        this.timer=this.setTimer(()=>{if(generation===this.generation)this.stop();},3000);
        Promise.resolve(audio.play()).then(()=>{if(generation!==this.generation){audio.pause();audio.removeAttribute('src');audio.load();}}).catch(()=>{if(generation===this.generation)this.stop();});
      }catch{this.stop();}
      return this.finished;
    }
  }
  class CueSchedule{
    constructor({random=()=>Math.random(),now=()=>Date.now()}={}){this.random=random;this.now=now;this.turns=0;this.lastTurn=-99;this.lastAt=-Infinity;this.lastIndex=-1;}
    choose(clips,enabled){
      ++this.turns;
      // Most turns stay silent. Never on consecutive turns, on the first turn,
      // or within 25 seconds of another scheduled cue, even in quick testing.
      if(!enabled||!clips.length||this.turns===1||this.turns-this.lastTurn<3||this.now()-this.lastAt<25000||this.random()>=.35)return null;
      const choices=clips.map((_,i)=>i).filter(i=>i!==this.lastIndex);
      const index=choices[Math.min(choices.length-1,Math.floor(this.random()*choices.length))];
      if(index===undefined)return null;
      this.lastTurn=this.turns;this.lastAt=this.now();this.lastIndex=index;return clips[index];
    }
  }
  class Conversation{
    constructor({repeat,captureFactory,gateFactory,encode,request,cue=null,onChange=()=>{},onLevel=()=>{},visible=()=>!document.hidden,now=()=>Date.now(),setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}){
      Object.assign(this,{repeat,captureFactory,gateFactory,encode,request,cue,onChange,onLevel,visible,now,setTimer,clearTimer});
      this.generation=0;this.active=false;this.phase='idle';this.message='Check connection to begin.';this.capture=this.gate=this.abort=this.timer=null;this.cooldownUntil=0;this.pauseForTurn=PAUSE_MS;this.replyText='';this.heardText='';this.completed=0;this.keepTalking=true;
    }
    get remaining(){return Math.max(0,Math.ceil((this.cooldownUntil-this.now())/1000));}
    say(phase,message){this.phase=phase;this.message=message;this.onChange(this);}
    releaseCapture(){const capture=this.capture;this.capture=this.gate=null;capture?.stop();this.onLevel(0,0,'off');}
    stop(message='Stopped. Microphone off; phrase and reply forgotten.'){
      ++this.generation;this.active=false;this.clearTimer(this.timer);this.clearTimer(this.cueTimer);this.timer=this.cueTimer=null;this.cue?.stop();this.thinkingClip=null;this.abort?.abort();this.abort=null;this.releaseCapture();this.repeat.stop();this.replyText=this.heardText='';this.keepTalking=true;this.say('idle',message);
    }
    async start(threshold=.025,{noPause=false,thinkingClip=null}={}){
      if(this.active||this.remaining||!this.visible()||!['idle','ready','error'].includes(this.repeat.state))return;
      this.stop();this.thinkingClip=thinkingClip;this.pauseForTurn=noPause===true?0:PAUSE_MS;this.gate=this.gateFactory(threshold);this.active=true;const generation=this.generation;
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
        if(result.kind==='waiting'&&this.phase!=='listening')this.say('listening','Listening. Ask a question, share a costume idea, or continue the conversation.');
        if(result.kind==='speech'&&this.phase!=='capturing')this.say('capturing','Capturing one phrase · maximum eight seconds.');
        if(result.kind!=='phrase')return;
        this.clearTimer(this.timer);this.timer=null;this.releaseCapture();
        void this.respond(this.encode(result.samples),generation);
      }catch(error){this.stop(error.message);}
    }
    async respond(clip,generation){
      this.say('thinking','Skelly is thinking…');
      const abort=this.abort=new AbortController();this.timer=this.setTimer(()=>this.stop('Local reply timed out. Nothing played.'),45000);
      if(this.cue&&this.thinkingClip)this.cueTimer=this.setTimer(()=>{
        this.cueTimer=null;if(generation!==this.generation||!this.active||!this.visible()||this.phase!=='thinking')return;
        this.cooldownUntil=this.now()+15000+this.pauseForTurn;
        void this.cue.play(this.thinkingClip,this.repeat.voice);
      },1100);
      try{
        const value=await this.request(clip,abort.signal);
        if(generation!==this.generation||!this.active||!this.visible())return;
        const reply=decodeReply(value);this.clearTimer(this.cueTimer);this.cueTimer=null;
        this.heardText=typeof value.heard==='string'?value.heard.slice(0,500):'';
        this.keepTalking=value.continueConversation!==false;
        // Let the brief cue finish; never overlap it with the actual reply.
        if(this.cue)await this.cue.finished;
        if(generation!==this.generation||!this.active||!this.visible())return;
        this.clearTimer(this.timer);this.timer=null;this.abort=null;
        this.replyText=reply.text;this.repeat.clip=reply.clip;this.repeat.say('ready','Checked local reply ready.');
        // Preserve a conservative pause even if Stop interrupts playback.
        this.cooldownUntil=this.now()+15000+this.pauseForTurn;
        this.say('playing','Skelly is replying. Microphone OFF.');void this.repeat.play();
      }catch(error){if(generation===this.generation)this.stop(error.message||'Could not get the local reply. Nothing played.');}
    }
    changed(){
      if(!this.active)return;
      if(this.repeat.state==='error'){this.stop(this.repeat.message);return;}
      if(this.phase!=='playing'||this.repeat.state!=='ready')return;
      this.active=false;this.completed++;this.cooldownUntil=this.now()+this.pauseForTurn;this.repeat.stop();this.say('idle',this.pauseForTurn?'Reply finished. Microphone off. Choose Talk again after the pause.':'Reply finished. Microphone off. Choose Talk again.');
    }
  }
  class ConversationSession{
    constructor({turn,startTurn,mayListen,onEnd,onChange=()=>{},now=()=>Date.now(),setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}){
      Object.assign(this,{turn,startTurn,mayListen,onEnd,onChange,now,setTimer,clearTimer});this.active=false;this.generation=0;this.count=0;this.starting=this.waiting=false;
    }
    stop(){this.active=false;++this.generation;this.clearTimer(this.limitTimer);this.clearTimer(this.nextTimer);this.limitTimer=this.nextTimer=null;this.waiting=this.starting=false;}
    finish(message,preserve=false){if(!this.active)return;this.stop();this.onEnd(message,preserve);}
    begin(){
      if(this.active||this.turn.active||this.turn.remaining||!this.mayListen())return;
      this.stop();this.active=true;this.count=0;this.seen=this.turn.completed;this.until=this.now()+180000;
      this.limitTimer=this.setTimer(()=>this.finish('Three-minute conversation limit reached. Microphone off; chat cleared.'),180000);
      void this.next();
    }
    async next(){
      if(!this.active)return;
      if(this.count>=6||this.now()>=this.until||!this.mayListen()||this.turn.remaining){this.finish('Conversation session finished. Microphone off; chat cleared.');return;}
      const generation=this.generation;this.waiting=false;this.starting=true;this.count++;
      try{await this.startTurn();}
      catch{if(generation===this.generation)this.finish('Conversation could not continue. Microphone off; choose Talk to try again.');}
      finally{if(generation===this.generation){this.starting=false;this.observe();this.onChange();}}
    }
    observe(){
      if(!this.active||this.starting||this.waiting||this.turn.active)return;
      if(this.turn.completed===this.seen){this.finish((this.turn.message||'Conversation stopped before a complete reply. Microphone off.')+' Session ended; choose Talk to try again.');return;}
      if(this.turn.phase!=='idle')return;
      this.seen=this.turn.completed;
      if(!this.turn.keepTalking){this.finish('Conversation finished. Microphone off; chat cleared.');return;}
      if(this.count>=6){this.finish('Six turns finished. Microphone off. Choose Start conversation to continue, or New visitor to clear chat.',true);return;}
      this.waiting=true;
      // The output has finished, then a two-second quiet gap and the existing
      // one-second calibration precede the next capture. Never listen over TTS.
      this.nextTimer=this.setTimer(()=>{this.nextTimer=null;void this.next();},2000);
      this.onChange();
    }
  }
  const api={Conversation,ConversationSession,ThinkingCue,CueSchedule,decodeCue,decodeReply,readJSON,MAX_WAV,MAX_REPLY_WAV,PAUSE_MS};
  if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.SkellyConversation=api;
})();
