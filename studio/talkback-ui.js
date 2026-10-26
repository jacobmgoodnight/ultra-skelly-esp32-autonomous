(function(){
  'use strict';
  const el=id=>document.getElementById(id),active=['requesting','recording','finishing','playing'];
  let outputBusy=false,outputGeneration=0,inputBusy=false,inputGeneration=0,liveBusy=false;
  let outputIds=new Set(['']),inputIds=new Set(['']);
  let auto;
  const repeat=new window.SkellyTalkback.RepeatBack({media:navigator.mediaDevices,Recorder:window.MediaRecorder,onChange:()=>{render();auto?.changed();}});
  const live=new window.SkellyTalkback.LiveLink(navigator.bluetooth,window.SkellyAudio.frame,{onChange:message=>{el('liveStatus').textContent=message;}});
  if(window.SkellyTalkbackAuto)auto=new window.SkellyTalkbackAuto.AutomaticRepeat({repeat,onChange:render,onLevel:showLevel,captureFactory:()=>new window.SkellyTalkbackAuto.PcmCapture({media:navigator.mediaDevices,Context:window.AudioContext,WorkletNode:window.AudioWorkletNode,input:repeat.input})});
  function showLevel(level=0,threshold=0,kind='off'){
    el('soundLevel').value=Math.min(.2,Math.max(0,level));
    const hint=kind==='off'?'Microphone off. The sound meter runs only during automatic capture.':kind==='calibrating'?'Measuring background noise; stay quiet.':level>=threshold?'Sound is above the phrase start level.':'Below the phrase start level. Speak closer, or choose Sensitive before the next pilot.';
    if(el('levelHint').textContent!==hint)el('levelHint').textContent=hint;
  }
  function render(){
    const supported=window.isSecureContext&&!!navigator.mediaDevices?.getUserMedia&&!!window.MediaRecorder;
    const automatic=!!auto?.active,selectionBusy=outputBusy||inputBusy,locked=active.includes(repeat.state)||selectionBusy||liveBusy||automatic;
    el('record').disabled=!supported||locked;
    el('finish').disabled=repeat.state!=='recording'||automatic;el('repeat').disabled=repeat.state!=='ready'||selectionBusy||liveBusy||automatic;
    const outputSupported=!!HTMLMediaElement.prototype.setSinkId&&!!(navigator.mediaDevices?.selectAudioOutput||navigator.mediaDevices?.enumerateDevices);
    el('chooseOutput').disabled=el('speakerSelect').disabled=locked||!outputSupported;
    el('chooseInput').disabled=el('microphoneSelect').disabled=locked||!window.isSecureContext||!navigator.mediaDevices?.enumerateDevices;
    el('voice').disabled=locked;
    el('enableLive').disabled=!window.isSecureContext||!navigator.bluetooth||locked||!el('isolated').checked;
    el('propName').disabled=liveBusy;el('isolated').disabled=liveBusy;
    el('status').textContent=automatic?auto.message:supported?repeat.message:'Recording needs HTTPS or localhost and a compatible browser. Open this page in desktop Chrome or Edge.';
    el('status').dataset.state=automatic?auto.phase:repeat.state;
    const stream=repeat.stream||auto?.capture?.stream,label=stream?.getAudioTracks?.()[0]?.label;
    el('micState').textContent=stream?'Microphone ON'+(label?' · '+label.slice(0,120):''):'Microphone OFF';
    if(!automatic||!['calibrating','listening','capturing'].includes(auto.phase))showLevel();
    const autoSupported=!!auto&&window.isSecureContext&&!!navigator.mediaDevices?.getUserMedia&&!!window.AudioContext&&!!window.AudioWorkletNode;
    el('startAuto').disabled=!autoSupported||locked||!el('autoConsent').checked;
    el('autoConsent').disabled=el('sensitivity').disabled=automatic;
    el('autoStatus').textContent=autoSupported?(auto?.message||'Automatic pilot is off.'):'Automatic capture is unavailable in this browser. Use manual recording.';
  }
  function stop(){
    ++outputGeneration;++inputGeneration;outputBusy=inputBusy=false;live.cancel();if(auto?.active)auto.stop();else repeat.stop();
    if(liveBusy)el('liveStatus').textContent=live.writeAttempted?'Setup stopped after a write was attempted. The request may have reached Skelly; power-cycle it before resuming autonomous operation.':'Setup stopped before the write. No live-enable request was sent.';
    render();
  }
  el('record').onclick=()=>repeat.record();el('finish').onclick=()=>repeat.finish();el('repeat').onclick=()=>repeat.play();el('stop').onclick=stop;
  el('isolated').onchange=render;
  el('autoConsent').onchange=render;
  el('voice').onchange=()=>{if(!el('voice').disabled&&['original','deep'].includes(el('voice').value))repeat.voice=el('voice').value;};
  el('startAuto').onclick=()=>{if(!el('startAuto').disabled)void auto.start(Number(el('sensitivity').value)).catch(error=>auto.stop(error.message));};
  el('chooseInput').onclick=async()=>{
    if(el('chooseInput').disabled)return;
    const generation=++inputGeneration;inputBusy=true;render();el('inputLabel').textContent='Checking available microphones…';
    try{
      const devices=await navigator.mediaDevices.enumerateDevices();if(generation!==inputGeneration)return;
      const inputs=devices.filter(d=>d.kind==='audioinput'&&d.deviceId);
      const option=(value,label)=>{const node=document.createElement('option');node.value=value;node.textContent=label;return node;};
      inputIds=new Set(['',...inputs.map(d=>d.deviceId)]);
      const options=[option('','Computer default'),...inputs.map((d,i)=>option(d.deviceId,d.label||'Microphone '+(i+1)+' (name unavailable)'))];
      if(repeat.input&&!inputIds.has(repeat.input)){const unavailable=option(repeat.input,'Previously selected microphone (unavailable)');unavailable.disabled=true;options.push(unavailable);}
      el('microphoneSelect').replaceChildren(...options);el('microphoneSelect').value=repeat.input||'';el('inputField').hidden=false;
      el('inputLabel').textContent=repeat.input&&!inputIds.has(repeat.input)?'The previously selected microphone is unavailable. Choose one before recording.':inputs.some(d=>d.label)?'Choose the laptop or USB microphone below. Used for manual and automatic capture.':'Microphone names may be hidden until permission is granted. Record a phrase and allow access, then choose microphone again. This button does not open the microphone.';
    }catch{if(generation===inputGeneration)el('inputLabel').textContent='Could not list microphones. Previous input kept. Check browser permissions or computer input settings.';}
    finally{if(generation===inputGeneration){inputBusy=false;render();}}
  };
  el('microphoneSelect').onchange=()=>{
    if(el('microphoneSelect').disabled||!inputIds.has(el('microphoneSelect').value))return;
    repeat.input=el('microphoneSelect').value;
    el('inputLabel').textContent='Selected microphone: '+el('microphoneSelect').selectedOptions[0].textContent+'. Used for the next manual recording or automatic pilot.';
  };
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
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>{++inputGeneration;++outputGeneration;inputBusy=outputBusy=false;if(auto?.active)auto.stop('Audio devices changed. Check the selected input/output and restart the pilot.');render();});
  if(!navigator.bluetooth)el('liveStatus').textContent='This browser cannot enable live mode. Use desktop Chrome/Edge for setup. Local recording can still work.';
  if(!HTMLMediaElement.prototype.setSinkId||!(navigator.mediaDevices?.selectAudioOutput||navigator.mediaDevices?.enumerateDevices))el('outputLabel').textContent='This browser cannot select a speaker here. Choose the output in your computer sound settings; playback uses the computer default.';
  if(!navigator.mediaDevices?.enumerateDevices)el('inputLabel').textContent='Choose the microphone in your browser or computer input settings. Playback uses your selected speaker.';
  render();
})();
