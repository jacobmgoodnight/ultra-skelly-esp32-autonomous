(function(){
  'use strict';
  const el=id=>document.getElementById(id);let turn,token='',checking=false,checkGeneration=0,checkAbort,tick;
  const repeat=new window.SkellyTalkback.RepeatBack({media:navigator.mediaDevices,Recorder:window.MediaRecorder,onChange:()=>{draw();turn?.changed();}});
  turn=new window.SkellyConversation.Conversation({repeat,
    captureFactory:()=>new window.SkellyTalkbackAuto.PcmCapture({media:navigator.mediaDevices,Context:window.AudioContext,WorkletNode:window.AudioWorkletNode}),
    gateFactory:threshold=>new window.SkellyTalkbackAuto.SpeechGate(threshold),encode:window.SkellyTalkbackAuto.wav,onChange:draw,
    onLevel:(level,threshold,kind)=>{el('level').value=Math.min(.2,level);el('levelHint').textContent=kind==='off'?'Microphone off.':kind==='calibrating'?'Measuring background noise.':level>=threshold?'Sound detected.':'Waiting for speech.';},
    request:async(clip,signal)=>{
      const response=await fetch('/api/reply',{method:'POST',headers:{'Content-Type':'audio/wav','X-Skelly-Token':token},body:clip,signal});
      const value=await window.SkellyConversation.readJSON(response);if(!response.ok)throw Error(value.error||'Local companion is unavailable.');return value;
    }});
  function draw(){
    const supported=window.isSecureContext&&navigator.mediaDevices?.getUserMedia&&window.AudioContext&&window.AudioWorkletNode;
    const busy=!!turn?.active,remaining=turn?.remaining||0;
    el('talk').disabled=!supported||!token||checking||busy||remaining>0||!el('attending').checked;
    el('check').disabled=checking||busy;el('voice').disabled=el('sensitivity').disabled=el('attending').disabled=busy;
    el('shutdown').disabled=!token||checking;
    el('status').textContent=turn?.message||'Check the local engine, then choose Talk.';
    const stream=turn?.capture?.stream,label=stream?.getAudioTracks?.()[0]?.label;
    el('mic').textContent=stream?'Microphone ON'+(label?' · '+label.slice(0,120):''):'Microphone OFF';
    el('reply').textContent=turn?.replyText||'';
    el('pause').textContent=remaining?'Pause: '+remaining+' seconds before the next Talk. The microphone stays off.':'';
    clearTimeout(tick);if(remaining&&!document.hidden)tick=setTimeout(draw,1000);
    if(!supported)el('service').textContent='Use desktop Chrome/Edge with microphone and Web Audio support.';
  }
  el('check').onclick=async()=>{
    if(el('check').disabled)return;
    const generation=++checkGeneration;checking=true;checkAbort=new AbortController();const abort=checkAbort;
    const timer=setTimeout(()=>abort.abort(),5000);draw();el('service').textContent='Checking local speech and reply engines…';
    try{
      const response=await fetch('/api/status',{signal:abort.signal});const value=await window.SkellyConversation.readJSON(response,2048);if(generation!==checkGeneration)return;
      if(!response.ok||value.ready!==true||typeof value.token!=='string'||value.token.length>100)throw Error();
      token=value.token;el('service').textContent='Local engines ready. Audio stays on this computer. Select Skelly Stereo in Windows sound settings.';
    }catch{if(generation===checkGeneration){token='';el('service').textContent='Start the local companion, then open http://127.0.0.1:8766/ and check again.';}}
    finally{clearTimeout(timer);if(generation===checkGeneration){checking=false;checkAbort=null;draw();}}
  };
  el('talk').onclick=()=>{if(!el('talk').disabled){repeat.voice=el('voice').value;void turn.start(Number(el('sensitivity').value)).catch(error=>turn.stop(error.message));}};
  function stop(){++checkGeneration;checking=false;checkAbort?.abort();checkAbort=null;turn.stop();draw();}
  el('stop').onclick=stop;el('attending').onchange=draw;
  el('shutdown').onclick=async()=>{
    if(el('shutdown').disabled)return;const previousToken=token;stop();token='';draw();
    try{const response=await fetch('/api/shutdown',{method:'POST',headers:{'X-Skelly-Token':previousToken}});if(!response.ok)throw Error();el('service').textContent='Local companion is stopping. Restart it from the project to use conversation again.';}
    catch{el('service').textContent='Could not confirm companion shutdown. Stop it with Ctrl+C in its terminal.';}
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else draw();});window.addEventListener('pagehide',stop);
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>{if(turn.active)turn.stop('Audio devices changed. Check Windows input/output settings before another turn.');});
  draw();
})();
