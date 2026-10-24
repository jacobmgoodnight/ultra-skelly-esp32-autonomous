/* Local audio preparation. No upload, Bluetooth or playback side effects. */
(function(){
  'use strict';
  const RATE=8000,MAX_SECONDS=117,MAX_INPUT=12*1024*1024;
  function range(duration,start,end){
    if(!Number.isFinite(duration)||duration<=0||duration>600)throw Error('Choose audio up to 10 minutes long.');
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>duration+.001||end-start<.1||end-start>MAX_SECONDS+.001)throw Error('Choose a selection from 0.1 to 117 seconds within this file.');
    return {start,end:Math.min(duration,end)};
  }
  function pcm16(samples){
    const out=new Int16Array(samples.length);for(let i=0;i<samples.length;i++){const n=Number.isFinite(samples[i])?Math.max(-1,Math.min(1,samples[i])):0;out[i]=Math.round(n*(n<0?32768:32767));}return out;
  }
  function peaks(channels,count=180){
    if(!channels.length||!channels[0].length)return [];
    const length=channels[0].length,step=Math.max(1,Math.floor(length/count)),out=[];
    for(let x=0;x<count;x++){let peak=0;for(let i=x*step;i<Math.min(length,(x+1)*step);i+=Math.max(1,Math.floor(step/100))){let n=0;for(const c of channels)n+=c[i]/channels.length;peak=Math.max(peak,Math.abs(n));}out.push(Math.min(1,peak));}return out;
  }
  async function encode(samples,Encoder,{signal,progress=()=>{},pause=()=>new Promise(r=>setTimeout(r,0))}={}){
    if(!(samples instanceof Float32Array)||samples.length<800||samples.length>RATE*MAX_SECONDS)throw Error('Invalid prepared audio length.');
    const encoder=new Encoder(1,RATE,32),pcm=pcm16(samples),parts=[];let bytes=0;
    for(let i=0;i<pcm.length;i+=1152){if(signal?.aborted)throw Error('Audio preparation cancelled.');const part=encoder.encodeBuffer(pcm.subarray(i,i+1152));if(part.length){parts.push(new Uint8Array(part));bytes+=part.length;}if(i%(1152*16)===0){progress(Math.floor(i/pcm.length*100));await pause();}}
    if(signal?.aborted)throw Error('Audio preparation cancelled.');const tail=encoder.flush();parts.push(new Uint8Array(tail));bytes+=tail.length;
    const out=new Uint8Array(bytes);let at=0;for(const part of parts){out.set(part,at);at+=part.length;}progress(100);return out;
  }
  const api={RATE,MAX_SECONDS,MAX_INPUT,range,pcm16,peaks,encode};
  if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.SkellyAudioPrep=api;
})();
