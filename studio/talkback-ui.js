(function(){
  'use strict';
  const el=id=>document.getElementById(id),active=['requesting','recording','finishing','playing'];
  let outputBusy=false,outputGeneration=0,liveBusy=false;
  let outputIds=new Set(['']);
  const repeat=new window.SkellyTalkback.RepeatBack({media:navigator.mediaDevices,Recorder:window.MediaRecorder,onChange:render});
  const live=new window.SkellyTalkback.LiveLink(navigator.bluetooth,window.SkellyAudio.frame,{onChange:message=>{el('liveStatus').textContent=message;}});
  function render(){
    const supported=window.isSecureContext&&!!navigator.mediaDevices?.getUserMedia&&!!window.MediaRecorder;
    el('record').disabled=!supported||active.includes(repeat.state)||outputBusy||liveBusy;
    el('finish').disabled=repeat.state!=='recording';el('repeat').disabled=repeat.state!=='ready'||outputBusy||liveBusy;
    const outputSupported=!!HTMLMediaElement.prototype.setSinkId&&!!(navigator.mediaDevices?.selectAudioOutput||navigator.mediaDevices?.enumerateDevices);
    el('chooseOutput').disabled=active.includes(repeat.state)||outputBusy||liveBusy||!outputSupported;
    el('speakerSelect').disabled=active.includes(repeat.state)||outputBusy||liveBusy||!outputSupported;
    el('enableLive').disabled=!window.isSecureContext||!navigator.bluetooth||liveBusy||active.includes(repeat.state)||outputBusy||!el('isolated').checked;
    el('propName').disabled=liveBusy;el('isolated').disabled=liveBusy;
    el('status').textContent=supported?repeat.message:'Recording needs HTTPS or localhost and a compatible browser. Open this page in desktop Chrome or Edge.';
    el('status').dataset.state=repeat.state;el('micState').textContent=repeat.stream?'Microphone ON':'Microphone OFF';
  }
  function stop(){
    ++outputGeneration;outputBusy=false;live.cancel();repeat.stop();
    if(liveBusy)el('liveStatus').textContent=live.writeAttempted?'Setup stopped after a write was attempted. The request may have reached Skelly; power-cycle it before resuming autonomous operation.':'Setup stopped before the write. No live-enable request was sent.';
    render();
  }
  el('record').onclick=()=>repeat.record();el('finish').onclick=()=>repeat.finish();el('repeat').onclick=()=>repeat.play();el('stop').onclick=stop;
  el('isolated').onchange=render;
  el('chooseOutput').onclick=async()=>{
    if(el('chooseOutput').disabled)return;
    const generation=++outputGeneration;outputBusy=true;render();el('outputLabel').textContent='Checking available audio outputs…';
    try{
      if(navigator.mediaDevices.selectAudioOutput){
        const device=await navigator.mediaDevices.selectAudioOutput();if(generation!==outputGeneration)return;
        repeat.sink=device.deviceId;el('outputField').hidden=true;
        el('outputLabel').textContent='Selected output: '+(device.label||'chosen device')+'. Verify where the sound actually plays.';
      }else{
        const devices=await navigator.mediaDevices.enumerateDevices();if(generation!==outputGeneration)return;
        const outputs=devices.filter(d=>d.kind==='audiooutput'&&d.deviceId);
        const option=(value,label)=>{const node=document.createElement('option');node.value=value;node.textContent=label;return node;};
        outputIds=new Set(['',...outputs.map(d=>d.deviceId)]);
        const options=[option('','Computer default'),...outputs.map((d,i)=>option(d.deviceId,d.label||'Speaker '+(i+1)+' (name unavailable)'))];
        if(repeat.sink&&!outputIds.has(repeat.sink)){
          const unavailable=option(repeat.sink,'Previously selected output (unavailable)');unavailable.disabled=true;options.push(unavailable);
        }
        el('speakerSelect').replaceChildren(...options);el('speakerSelect').value=repeat.sink;el('outputField').hidden=false;
        el('outputLabel').textContent=outputs.some(d=>d.deviceId!=='default')?'Choose an output below, then verify where the sound actually plays.':
          'Only the computer default is visible. Record a phrase and allow microphone access, then choose speaker again, or select the output in Windows Sound settings.';
        if(repeat.sink&&!outputIds.has(repeat.sink))el('outputLabel').textContent='The previously selected output is unavailable. Choose an output below before playback.';
      }
    }catch{if(generation===outputGeneration)el('outputLabel').textContent='Output selection cancelled or unavailable. Previous output kept. Use computer sound settings if needed.';}
    finally{if(generation===outputGeneration){outputBusy=false;render();}}
  };
  el('speakerSelect').onchange=()=>{
    if(el('speakerSelect').disabled||!outputIds.has(el('speakerSelect').value))return;
    repeat.sink=el('speakerSelect').value;
    el('outputLabel').textContent='Selected output: '+el('speakerSelect').selectedOptions[0].textContent+'. Verify where the sound actually plays.';
  };
  el('enableLive').onclick=async()=>{
    if(el('enableLive').disabled)return;
    liveBusy=true;render();el('liveStatus').textContent='Choose your Ultra Skelly. Only a live-audio enable request will be sent.';
    try{el('liveStatus').textContent=await live.enable(el('propName').value);}
    catch(error){el('liveStatus').textContent=error.message;}
    finally{liveBusy=false;render();}
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
  if(!navigator.bluetooth)el('liveStatus').textContent='This browser cannot enable live mode. Use desktop Chrome/Edge for setup. Local recording can still work.';
  if(!HTMLMediaElement.prototype.setSinkId||!(navigator.mediaDevices?.selectAudioOutput||navigator.mediaDevices?.enumerateDevices))el('outputLabel').textContent='This browser cannot select a speaker here. Choose the output in your computer sound settings; playback uses the computer default.';
  render();
})();
