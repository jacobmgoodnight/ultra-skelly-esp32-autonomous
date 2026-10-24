/* Explicit, computer-only conversion; audio stays silent until Play is clicked. */
(function(){
  'use strict';if(typeof document==='undefined')return;
  document.addEventListener('DOMContentLoaded',()=>{
    const el=id=>document.getElementById(id),p=window.SkellyAudioPrep,a=window.SkellyAudio;
    let source=null,result=null,url=null,generation=0,busy=false,abort=null,encoderTask=null,sourceName='Audio';
    const say=s=>el('audioPrepStatus').textContent=s;
    function invalidate(){result=null;el('audioPrepUse').disabled=el('audioPrepDownload').disabled=true;el('audioPrepPlayer').pause();el('audioPrepPlayer').removeAttribute('src');el('audioPrepPlayer').load();if(url)URL.revokeObjectURL(url);url=null;el('audioPrepPlayer').hidden=true;}
    function state(){el('audioPrepConvert').disabled=!source||busy;el('audioPrepSource').disabled=busy;el('audioPrepStart').disabled=el('audioPrepEnd').disabled=busy||!source;el('audioPrepCancel').disabled=!busy;}
    function draw(){
      const canvas=el('audioWaveform'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);if(!source)return;
      const start=Number(el('audioPrepStart').value),end=Number(el('audioPrepEnd').value);ctx.fillStyle='#b28df91c';ctx.fillRect(start/source.duration*canvas.width,0,(end-start)/source.duration*canvas.width,canvas.height);
      ctx.strokeStyle='#b28df9';ctx.beginPath();p.peaks(Array.from({length:source.numberOfChannels},(_,i)=>source.getChannelData(i))).forEach((peak,i,values)=>{const x=i/values.length*canvas.width,h=Math.max(1,peak*canvas.height*.45);ctx.moveTo(x,canvas.height/2-h);ctx.lineTo(x,canvas.height/2+h);});ctx.stroke();
    }
    function encoder(){
      if(window.lamejs)return Promise.resolve(window.lamejs.Mp3Encoder);
      if(!encoderTask)encoderTask=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/lamejs-1.2.1/lame.min.js';s.onload=()=>window.lamejs?resolve(window.lamejs.Mp3Encoder):reject(Error('Local MP3 encoder unavailable.'));s.onerror=()=>{encoderTask=null;s.remove();reject(Error('Local MP3 encoder did not load. Keep the complete Studio folder for offline use.'));};document.head.append(s);});return encoderTask;
    }
    el('audioPrepSource').onchange=async()=>{
      const id=++generation,file=el('audioPrepSource').files[0];source=null;invalidate();state();if(!file){say('Choose audio to prepare on this computer.');draw();return;}
      let context;busy=true;state();say('Reading audio on this computer…');
      try{
        if(file.size>p.MAX_INPUT)throw Error('Choose audio smaller than 12 MiB.');
        const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Audio conversion is unavailable in this browser. Upload a prepared MP3 instead.');
        context=new Audio();const data=await file.arrayBuffer();if(id!==generation)return;const decoded=await context.decodeAudioData(data);if(id!==generation)return;
        p.range(decoded.duration,0,Math.min(p.MAX_SECONDS,decoded.duration));if(decoded.numberOfChannels>2)throw Error('Choose mono or stereo audio.');source=decoded;sourceName=file.name;
        el('audioPrepStart').value='0';el('audioPrepEnd').value=Math.floor(Math.min(p.MAX_SECONDS,source.duration)*1000)/1000;el('audioWaveform').hidden=false;draw();say(source.duration.toFixed(1)+' seconds · choose up to 117 seconds, then prepare the MP3.');
      }catch(e){if(id===generation)say(e.message);}finally{try{await context?.close();}catch{}if(id===generation){busy=false;state();}}
    };
    for(const id of ['audioPrepStart','audioPrepEnd'])el(id).oninput=()=>{invalidate();draw();say('Selection changed. Prepare it again before uploading.');};
    el('audioPrepConvert').onclick=async()=>{
      const id=++generation;invalidate();busy=true;abort=new AbortController();const signal=abort.signal;state();say('Preparing locally…');
      try{
        const selection=p.range(source.duration,Number(el('audioPrepStart').value),Number(el('audioPrepEnd').value));
        const Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!Offline)throw Error('This browser cannot resample audio. Upload a prepared MP3 instead.');
        const length=Math.min(p.RATE*p.MAX_SECONDS,Math.floor((selection.end-selection.start)*p.RATE)),context=new Offline(1,length,p.RATE),node=context.createBufferSource();node.buffer=source;node.connect(context.destination);node.start(0,selection.start,selection.end-selection.start);
        const rendered=await context.startRendering();if(id!==generation||signal.aborted)return;const Encoder=await encoder();if(id!==generation||signal.aborted)return;
        const bytes=await p.encode(rendered.getChannelData(0),Encoder,{signal,progress:n=>{if(id===generation)say('Preparing locally · '+n+'%');}}),info=a.inspectMp3(bytes);if(id!==generation||signal.aborted)return;
        result={bytes,info,name:sourceName};url=URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));el('audioPrepPlayer').src=url;el('audioPrepPlayer').hidden=false;el('audioPrepUse').disabled=el('audioPrepDownload').disabled=false;say('Ready · '+info.duration.toFixed(1)+' seconds · padded estimate '+info.guard+' seconds. Preview plays on this computer only.');
      }catch(e){if(id===generation)say(e.message);}finally{if(id===generation){busy=false;abort=null;state();}}
    };
    el('audioPrepCancel').onclick=()=>{++generation;abort?.abort();abort=null;busy=false;state();say('Preparation cancelled. Nothing was uploaded.');};
    el('audioPrepUse').onclick=()=>{if(!result)return;document.dispatchEvent(new CustomEvent('skelly-audio-prepared',{detail:result}));say('Prepared MP3 selected for upload below. Nothing has been sent to Skelly.');};
    el('audioPrepDownload').onclick=()=>{if(!result)return;const link=document.createElement('a');link.href=url;link.download='Skelly-prepared-'+Date.now()+'.mp3';link.click();};
    window.addEventListener('pagehide',()=>{++generation;abort?.abort();invalidate();source=null;});state();
  });
})();
