(function(){
  'use strict';
  const el=id=>document.getElementById(id),active=['requesting','recording','finishing','playing'];
  let outputBusy=false,outputGeneration=0,liveBusy=false;
  const repeat=new window.SkellyTalkback.RepeatBack({media:navigator.mediaDevices,Recorder:window.MediaRecorder,onChange:render});
  const live=new window.SkellyTalkback.LiveLink(navigator.bluetooth,window.SkellyAudio.frame);
  function render(){
    const supported=window.isSecureContext&&!!navigator.mediaDevices?.getUserMedia&&!!window.MediaRecorder;
    el('record').disabled=!supported||active.includes(repeat.state)||outputBusy||liveBusy;
    el('finish').disabled=repeat.state!=='recording';el('repeat').disabled=repeat.state!=='ready'||outputBusy||liveBusy;
    el('chooseOutput').disabled=active.includes(repeat.state)||outputBusy||liveBusy||!navigator.mediaDevices?.selectAudioOutput||!HTMLMediaElement.prototype.setSinkId;
    el('enableLive').disabled=!window.isSecureContext||!navigator.bluetooth||liveBusy||active.includes(repeat.state)||outputBusy||!el('isolated').checked;
    el('propName').disabled=liveBusy;el('isolated').disabled=liveBusy;
    el('status').textContent=supported?repeat.message:'Recording needs HTTPS or localhost and a compatible browser. Open this page in desktop Chrome or Edge.';
    el('status').dataset.state=repeat.state;el('micState').textContent=repeat.stream?'Microphone ON':'Microphone OFF';
  }
  function stop(){
    ++outputGeneration;outputBusy=false;live.cancel();repeat.stop();
    if(liveBusy)el('liveStatus').textContent='Setup stopped. A request already sent cannot be recalled. Stop audio and power-cycle Skelly before resuming autonomous operation.';
    render();
  }
  el('record').onclick=()=>repeat.record();el('finish').onclick=()=>repeat.finish();el('repeat').onclick=()=>repeat.play();el('stop').onclick=stop;
  el('isolated').onchange=render;
  el('chooseOutput').onclick=async()=>{
    const generation=++outputGeneration;outputBusy=true;render();
    try{
      const device=await navigator.mediaDevices.selectAudioOutput();if(generation!==outputGeneration)return;
      repeat.sink=device.deviceId;el('outputLabel').textContent='Selected output: '+(device.label||'chosen device')+'. Verify where the sound actually plays.';
    }catch{if(generation===outputGeneration)el('outputLabel').textContent='Output selection cancelled or unavailable. Previous output kept. Use computer sound settings if needed.';}
    finally{if(generation===outputGeneration){outputBusy=false;render();}}
  };
  el('enableLive').onclick=async()=>{
    if(el('enableLive').disabled)return;
    liveBusy=true;render();el('liveStatus').textContent='Choose your Ultra Skelly. Only a live-audio enable request will be sent.';
    try{el('liveStatus').textContent=await live.enable(el('propName').value);}
    catch(error){el('liveStatus').textContent=error.message+' A request already sent may have taken effect. Check the prop; no automatic retry.';}
    finally{liveBusy=false;render();}
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});window.addEventListener('pagehide',stop);
  if(!navigator.bluetooth)el('liveStatus').textContent='This browser cannot enable live mode. Use desktop Chrome/Edge for setup. Local recording can still work.';
  render();
})();
