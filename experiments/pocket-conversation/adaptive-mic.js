/* Conversation-only adaptation. No playback, storage or automatic rearming. */
(function(){
  'use strict';
  const RATE=16000,MAX=RATE*8;
  function cleanSamples(input,limit=MAX){
    if(!(input instanceof Float32Array)||!input.length||input.length>limit)throw Error('Invalid audio block.');
    let peak=1,missing=0;for(const value of input){if(Number.isFinite(value))peak=Math.max(peak,Math.abs(value));else missing++;}
    // Web Audio floats can exceed nominal full scale. Lower their gain instead
    // of treating microphone/AGC overshoot as corrupt audio. Repair isolated
    // non-finite glitches; the gate separately stops persistent device failure.
    const scale=peak>1?.98/peak:1;
    return {samples:Float32Array.from(input,value=>Number.isFinite(value)?value*scale:0),missing,adjusted:peak>1};
  }
  class AdaptiveSpeechGate{
    constructor(sensitivity=.025){
      if(!Number.isFinite(sensitivity)||sensitivity<.005||sensitivity>.1)throw Error('Invalid sensitivity.');
      this.floor=Math.max(.006,sensitivity*.4);this.threshold=this.floor;this.noise=0;this.level=0;
      this.calibration=0;this.levels=[];this.pre=[];this.preSamples=0;this.attack=0;this.chunks=[];this.samples=0;this.voiced=0;this.quiet=0;this.speaking=false;this.badSamples=0;this.adjustedBlocks=0;
    }
    ambient(rms){
      this.levels.push(rms);if(this.levels.length>48)this.levels.shift();
      const sorted=[...this.levels].sort((a,b)=>a-b),estimate=sorted[Math.floor((sorted.length-1)*.25)];
      this.noise=this.calibration<RATE?estimate:this.noise+(estimate-this.noise)*(estimate<this.noise?.16:.05);
      this.threshold=Math.min(.8,Math.max(this.floor,this.noise*1.7+.004));
    }
    push(input){
      const cleaned=cleanSamples(input,2048);input=cleaned.samples;
      this.badSamples=cleaned.missing>input.length*.05?this.badSamples+input.length:0;
      if(this.badSamples>=RATE*.5)throw Error('The microphone is not supplying usable audio. Stop and reconnect or select the microphone again.');
      if(cleaned.adjusted)this.adjustedBlocks=Math.min(1000000,this.adjustedBlocks+1);
      let power=0,mean=0;for(const value of input)mean+=value;
      mean/=input.length;for(const value of input)power+=(value-mean)**2;
      const rms=this.level=Math.sqrt(power/input.length);
      if(this.calibration<RATE){this.ambient(rms);this.calibration+=input.length;return {kind:'calibrating'};}
      if(!this.speaking){
        this.ambient(rms);
        this.pre.push(input.slice());this.preSamples+=input.length;
        while(this.preSamples>RATE/4){const excess=this.preSamples-RATE/4,first=this.pre[0];if(first.length<=excess){this.pre.shift();this.preSamples-=first.length;}else{this.pre[0]=first.slice(excess);this.preSamples-=excess;}}
        this.attack=rms>=this.threshold?this.attack+input.length:0;
        if(this.attack<RATE*.12)return {kind:'waiting'};
        this.speaking=true;this.release=Math.max(this.floor*.6,this.noise*1.25+.003);
        this.chunks=this.pre;this.samples=this.preSamples;this.voiced=this.attack;this.pre=[];this.preSamples=0;return {kind:'speech'};
      }
      const block=input.slice(0,MAX-this.samples);this.chunks.push(block);this.samples+=block.length;
      if(rms>=this.release){this.quiet=0;this.voiced+=block.length;}else this.quiet+=block.length;
      if(this.samples<MAX&&this.quiet<RATE*.8)return {kind:'speech'};
      if(this.voiced<RATE*.2){this.chunks=[];this.samples=this.attack=this.voiced=this.quiet=0;this.speaking=false;return {kind:'waiting'};}
      const end=Math.min(this.samples,this.samples-this.quiet+RATE*.15),samples=new Float32Array(end);let at=0;
      for(const chunk of this.chunks){const part=chunk.subarray(0,end-at);samples.set(part,at);at+=part.length;if(at>=end)break;}
      this.chunks=[];return {kind:'phrase',samples};
    }
  }
  function normalizePhrase(input){
    const cleaned=cleanSamples(input);if(cleaned.missing>input.length*.05)throw Error('The microphone did not capture a usable phrase. Try the microphone again.');input=cleaned.samples;
    let mean=0;for(const value of input)mean+=value;mean/=input.length;
    let peak=0,power=0;for(const value of input){const sample=value-mean;peak=Math.max(peak,Math.abs(sample));power+=sample*sample;}
    const rms=Math.sqrt(power/input.length),gain=rms>.0005?Math.min(4,.12/rms,.92/Math.max(peak,.0001)):1;
    return Float32Array.from(input,value=>Math.max(-.98,Math.min(.98,(value-mean)*gain)));
  }
  function gainManagedMedia(media){
    return {getUserMedia:constraints=>media.getUserMedia({...constraints,audio:{...constraints.audio,autoGainControl:true}})};
  }
  const api={AdaptiveSpeechGate,normalizePhrase,gainManagedMedia,cleanSamples};
  if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.SkellyAdaptiveMic=api;
})();
