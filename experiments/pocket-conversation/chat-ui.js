(function(){
  'use strict';
  const el=id=>document.getElementById(id);let turn,sessionRun,live,token='',selectedEngine='local',selectedBrain='local',selectedDelivery='natural',selectedConsent=false,selectedTone='haunt-dry',selectedConversation='family',familyCatalog=false,checking=false,checkGeneration=0,checkAbort,tick,session=window.crypto.randomUUID(),selectedPersonality='friendly',cues=[],cloud={brain:false,voice:false};
  // Cloud choices and permission are deliberately never restored from browser storage.
  el('brainMode').value=el('engine').value='local';el('cloudDelivery').value='natural';el('cloudConsent').checked=false;el('conversationMode').value='family';
  let liveLink=null,liveBusy=false;
  const usingCloud=()=>el('brainMode').value==='cloud'||el('engine').value==='elevenlabs';
  function cloudAllowed(){return ['open','family'].includes(el('conversationMode').value)&&['friendly','mischief',...(el('conversationMode').value==='family'?['guardian','storyteller']:[])].includes(el('personality').value)&&(el('conversationMode').value!=='family'||(familyCatalog&&!usingCloud()))&&['local','cloud'].includes(el('brainMode').value)&&['local','elevenlabs'].includes(el('engine').value)&&['natural','whispering','dry'].includes(el('cloudDelivery').value)&&(el('brainMode').value==='local'||cloud.brain)&&(el('engine').value==='local'||cloud.voice)&&(!usingCloud()||el('cloudConsent').checked);}
  function cloudDetails(){
    const brain=el('brainMode').value==='cloud',voice=el('engine').value==='elevenlabs';
    el('cloudPanel').hidden=!(brain||voice);el('cloudDeliveryField').hidden=!voice;el('localControls').hidden=voice;
    el('cloudDisclosure').textContent=brain||voice?'Raw microphone audio stays local. '+(brain?'Claude receives recognized speech and recent chat. ':'')+(voice?'ElevenLabs receives Skelly’s checked reply text. ':'')+'Shared names may be included. Provider billing and retention terms apply.':'Local mode keeps this conversation on your laptop.';
  }
  const cueSchedule=new window.SkellyConversation.CueSchedule();
  const repeat=new window.SkellyTalkback.RepeatBack({media:navigator.mediaDevices,Recorder:window.MediaRecorder,onChange:()=>{draw();turn?.changed();}});
  turn=new window.SkellyConversation.Conversation({repeat,cue:new window.SkellyConversation.ThinkingCue(),
    captureFactory:()=>new window.SkellyTalkbackAuto.PcmCapture({media:window.SkellyAdaptiveMic.gainManagedMedia(navigator.mediaDevices),Context:window.AudioContext,WorkletNode:window.AudioWorkletNode,input:live?.input()||''}),
    gateFactory:threshold=>new window.SkellyAdaptiveMic.AdaptiveSpeechGate(threshold),encode:samples=>window.SkellyTalkbackAuto.wav(window.SkellyAdaptiveMic.normalizePhrase(samples)),onChange:draw,
    onLevel:(level,threshold,kind)=>{el('level').value=Math.min(.2,level);el('levelHint').hidden=kind==='off';el('levelHint').textContent=kind==='off'?'Microphone off.':kind==='calibrating'?'Measuring the room for one second.':level>=threshold?'Speech detected; level adjusts automatically.':'Listening and adapting to room noise.';},
    request:async(clip,signal)=>{
      if((selectedBrain==='cloud'&&(!cloud.brain||!selectedConsent||!el('cloudConsent').checked))||(selectedEngine==='elevenlabs'&&(!cloud.voice||!selectedConsent||!el('cloudConsent').checked)))throw Error('Allow the configured cloud services for this chat before talking. Nothing sent.');
      if(selectedConversation==='family'&&!familyCatalog)throw Error('Family replies are unavailable. Check or restart the companion. Nothing played.');
      const identity=window.crypto.randomUUID(),turnToken=token,turnSession=session,personality=selectedPersonality,conversation=selectedConversation;
      const cancel=()=>{void fetch('/api/cancel',{method:'POST',headers:{'X-Skelly-Token':turnToken,'X-Skelly-Turn':identity},keepalive:true}).catch(()=>{});};
      signal.addEventListener('abort',cancel,{once:true});
      try{
        if(signal.aborted){cancel();throw Error('Turn cancelled. Nothing played.');}
        const headers={'Content-Type':'audio/wav','X-Skelly-Token':turnToken,'X-Skelly-Brain':selectedBrain,'X-Skelly-Voice':selectedEngine,'X-Skelly-Delivery':selectedDelivery,'X-Skelly-Tone':selectedTone,'X-Skelly-Turn':identity,'X-Skelly-Session':turnSession,'X-Skelly-Personality':personality,'X-Skelly-Conversation':selectedConversation};if(selectedConsent&&usingCloud())headers['X-Skelly-Cloud-Consent']='yes';
        const response=await fetch('/api/reply',{method:'POST',headers,body:clip,signal});
        const value=await window.SkellyConversation.readJSON(response);if(!response.ok)throw Error(value.error||'Local companion is unavailable.');
        if(conversation==='family'&&value.responseMode!=='family')throw Error('Companion did not return a reviewed family reply. Nothing played.');
        if(!signal.aborted){const cloudVoice=['elevenlabs-v3','elevenlabs-v4'].includes(value.source);if(typeof value.source==='string'&&value.source.startsWith('Reviewed recording · '))el('voiceSource').textContent='Last reply: '+value.source.slice(0,120)+'. Reviewed family reply.';else el('voiceSource').textContent='Last reply: '+(cloudVoice?'ElevenLabs · '+value.source.slice(11):value.source==='pocket-haunt-dry'?'Pocket · Haunt dry':value.source==='pocket-haunt-croaky'?'Pocket · Haunt croaky':value.source==='pocket-e'?'Pocket · synthetic E':value.source==='piper-fallback'?'Piper fallback · Pocket did not produce a bounded reply':value.source==='windows-fallback'?'Windows fallback':'Piper')+(cloudVoice?' · cloud voice.':selectedTone.startsWith('haunt-')?' · new synthetic character reference.':selectedTone==='crypt'?' · crypt skeleton, lower pitch at normal pace.':selectedTone==='hollow'?' · hollow skeleton tone.':'.')+' '+(value.brainSource==='claude'?'Claude conversation. ':value.brainSource==='local'?'Local conversation. ':'')+(value.responseMode==='family'?'Reviewed family reply.':value.responseMode==='requested-joke'?'Requested catalog joke.':value.responseMode==='generated'?'Conversational reply.':value.responseMode==='conversation-recovery'?'Repetition interrupted.':'Friendly fallback. No automatic retry.');}
        return value;
      }finally{signal.removeEventListener('abort',cancel);}
    }});
  function draw(){
    const supported=window.isSecureContext&&navigator.mediaDevices?.getUserMedia&&window.AudioContext&&window.AudioWorkletNode;
    const busy=!!turn?.active||!!sessionRun?.active,remaining=turn?.remaining||0;
    el('talk').disabled=!supported||!token||checking||busy||remaining>0||!el('attending').checked||!cloudAllowed()||!!(live&&(!live.ready()||live.testing()));
    el('talk').textContent=el('handsFree').checked?'Start conversation':'Talk to Skelly';
    el('check').disabled=checking||busy;el('personality').disabled=el('conversationMode').disabled=el('sensitivity').disabled=el('attending').disabled=el('quickTest').disabled=el('handsFree').disabled=busy;el('brainMode').disabled=el('engine').disabled=busy||el('conversationMode').value==='family';el('profileGuardian').disabled=el('profileStoryteller').disabled=el('conversationMode').value!=='family';
    const cloudVoice=el('engine').value==='elevenlabs';el('tone').disabled=el('voice').disabled=busy||cloudVoice;el('cloudDelivery').disabled=busy||!cloudVoice;el('thinkingCue').disabled=busy||cloudVoice;el('cloudConsent').disabled=busy||!usingCloud();cloudDetails();
    el('forget').disabled=el('shutdown').disabled=!token||checking;
    if(liveLink)el('enableLive').disabled=liveBusy||busy||!el('isolated').checked;
    el('status').textContent=sessionRun?.waiting?'Your turn is next. Microphone off for two seconds, then one quiet calibration second.':turn?.message||'Check the local engine, then choose Talk.';
    const stream=turn?.capture?.stream||live?.testStream(),label=stream?.getAudioTracks?.()[0]?.label;
    el('mic').textContent=stream?'Microphone ON'+(label?' · '+label.slice(0,120):''):'Microphone OFF';
    el('reply').textContent=turn?.replyText||'';
    el('heard').textContent=turn?.heardText||'';
    el('sessionStatus').textContent=sessionRun?.active?'Turn '+sessionRun.count+' of 6'+(sessionRun.waiting?' · your turn shortly.':'.'):el('handsFree').checked?'Up to six turns. Start when ready.':'One turn at a time.';
    el('pause').textContent=remaining?'Pause: '+remaining+' seconds before the next Talk. The microphone stays off.':'';
    if(live){const testPhase=live.testPhase();el('livePhase').textContent=['requesting','calibrating','listening','capturing'].includes(turn?.phase)||['requesting','recording','finishing'].includes(testPhase)?'Listening':turn?.phase==='thinking'?'Thinking':turn?.phase==='playing'||testPhase==='playing'?'Speaking':remaining?'Cooldown':'Idle';live.sync();}
    clearTimeout(tick);if(remaining&&!document.hidden)tick=setTimeout(draw,1000);
    if(!supported)el('service').textContent='Use desktop Chrome/Edge with microphone and Web Audio support.';
    sessionRun?.observe();
  }
  el('check').onclick=async()=>{
    if(el('check').disabled)return;
    const generation=++checkGeneration;checking=true;checkAbort=new AbortController();const abort=checkAbort;
    const timer=setTimeout(()=>abort.abort(),5000);draw();el('service').textContent='Checking local speech and reply engines…';
    try{
      const response=await fetch('/api/status',{signal:abort.signal});const value=await window.SkellyConversation.readJSON(response,2048);if(generation!==checkGeneration)return;
      if(value.conversation!==true||!response.ok||value.ready!==true||typeof value.token!=='string'||value.token.length>100)throw Error();
      token=value.token;el('service').textContent='Connected. Confirm your speaker below, then start talking.';if(!turn.active&&!turn.replyText)turn.message='Ready when you are.';
      familyCatalog=value.familyCatalog===true;el('familyModeOption').disabled=!familyCatalog;el('familyStatus').textContent=familyCatalog?'Family mode plays only replies a person has reviewed.':'Family replies are unavailable. Restart the Skelly Live launcher, or choose Open mode while you listen.';if(!familyCatalog&&el('conversationMode').value==='family')el('service').textContent='Connected, but reviewed family replies are unavailable. Restart the Skelly Live launcher.';
      el('localVoiceReady').textContent='Local voice: '+(typeof value.voice==='string'?value.voice.slice(0,120):'not reported')+'. Software readiness only; listen to verify the speaker.';
      const tones=Array.isArray(value.tones)?value.tones:['crypt','hollow','natural'];el('hauntDry').disabled=!tones.includes('haunt-dry');el('hauntCroaky').disabled=!tones.includes('haunt-croaky');if(live&&el('tone').options)for(const option of el('tone').options)option.disabled=!tones.includes(option.value);if(!tones.includes(el('tone').value))el('tone').value=live&&tones.includes('natural')?'natural':'crypt';
      if(live&&el('tone').options){const natural=[...el('tone').options].find(option=>option.value==='natural');if(natural)natural.textContent=tones.length===1?'Natural · '+(value.voice||'local voice'):'Original E voice';}
      cloud={brain:value.cloud?.brain===true,voice:value.cloud?.voice===true};el('cloudBrainOption').disabled=!cloud.brain;el('cloudVoiceOption').disabled=!cloud.voice;
      if(!cloud.brain)el('brainMode').value='local';if(!cloud.voice)el('engine').value='local';if(!usingCloud())el('cloudConsent').checked=false;
      el('cloudStatus').textContent='Optional cloud conversation: '+(cloud.brain?'configured':value.cloud?.brainIssue?'invalid or incomplete configuration; check optional cloud setup':'not configured')+'. Optional cloud voice: '+(cloud.voice?'configured':value.cloud?.voiceIssue?'invalid or incomplete configuration; check optional cloud setup':'not configured')+'. This checks local format only; no provider was contacted.';
      el('voiceSource').textContent='Local voice: '+(typeof value.voice==='string'?value.voice.slice(0,120):'older companion; restart it for voice details')+'. Conversation model: '+(typeof value.brain==='string'?value.brain.slice(0,100):'local')+(value.modelLoaded===false?' · currently stopped; the next local turn may reload it':'')+'. Chat memory stays in RAM until cleared or expired.';
      cues=[];
      if(value.thinkingCuesReady===true){
        try{
          const response=await fetch('/api/thinking-cues',{signal:abort.signal}),data=await window.SkellyConversation.readJSON(response,360000);
          if(!response.ok||!Array.isArray(data.cues)||data.cues.length!==3||data.cues.map(c=>c.id).join(',')!=='thinking,moment,well')throw Error();
          const clips=data.cues.map(window.SkellyConversation.decodeCue);
          if(generation===checkGeneration)cues=clips;
        }catch{}
      }
      if(generation===checkGeneration)el('cueStatus').textContent=cues.length?'Three variations ready. Used occasionally, with no overlapping speech.':'Thinking remarks unavailable; ordinary replies still work.';
    }catch{if(generation===checkGeneration){token='';familyCatalog=false;el('familyModeOption').disabled=true;el('familyStatus').textContent='Family mode unavailable: check the local companion.';cloud={brain:false,voice:false};el('cloudBrainOption').disabled=el('cloudVoiceOption').disabled=true;el('brainMode').value=el('engine').value='local';el('cloudConsent').checked=false;el('cloudStatus').textContent='Cloud availability could not be checked.';el('localVoiceReady').textContent='Local voice: unavailable until the companion is checked.';el('service').textContent='Companion is offline. Start it, then check the connection again.';}}
    finally{clearTimeout(timer);if(generation===checkGeneration){checking=false;checkAbort=null;draw();}}
  };
  const previewIds=['previewDry','previewCroaky','previewCrypt'];
  function stopPreviews(except=''){for(const id of previewIds)if(id!==except){el(id).pause?.();try{el(id).currentTime=0;}catch{}}}
  for(const id of previewIds)el(id).onplay=()=>{if(turn.active||sessionRun?.active)stopPreviews();else stopPreviews(id);};
  function takeTurn(handsFree=false){if(!cloudAllowed()||(live&&(!live.ready()||live.testing())))return Promise.reject(Error('Check your selected devices and services before talking.'));stopPreviews();selectedEngine=el('engine').value;selectedBrain=el('brainMode').value;selectedDelivery=el('cloudDelivery').value;selectedConsent=usingCloud()&&el('cloudConsent').checked;selectedPersonality=el('personality').value;selectedConversation=el('conversationMode').value;selectedTone=el('tone').value;repeat.voice=selectedEngine==='elevenlabs'?'original':el('voice').value;if(live)repeat.sink=live.output();const thinkingClip=cueSchedule.choose(cues,!live&&el('thinkingCue').checked&&selectedEngine==='local');return turn.start(Number(el('sensitivity').value),{noPause:!live&&(handsFree||el('quickTest').checked),thinkingClip});}
  sessionRun=new window.SkellyConversation.ConversationSession({turn,startTurn:()=>takeTurn(true),mayListen:()=>!!token&&el('attending').checked&&el('handsFree').checked&&!document.hidden&&!checking&&cloudAllowed()&&(!live||(live.ready()&&!live.testing())),
    onEnd:(message,preserve)=>{const reply=turn.replyText,heard=turn.heardText;if(!preserve)forgetMemory();turn.stop(message);if(preserve){turn.replyText=reply;turn.heardText=heard;}draw();},onChange:draw});
  el('talk').onclick=()=>{if(!el('talk').disabled){if(el('handsFree').checked)sessionRun.begin();else void takeTurn().catch(error=>turn.stop(error.message));}};
  function forgetMemory(){const previous=session;session=window.crypto.randomUUID();el('cloudConsent').checked=false;selectedConsent=false;if(token)void fetch('/api/forget',{method:'POST',headers:{'X-Skelly-Token':token,'X-Skelly-Session':previous},keepalive:true}).catch(()=>{});}
  function stop(forget=false){if(liveBusy)liveLink?.cancel();sessionRun.stop();live?.stop();stopPreviews();if(forget)forgetMemory();else{el('cloudConsent').checked=false;selectedConsent=false;}++checkGeneration;checking=false;checkAbort?.abort();checkAbort=null;turn.stop(forget?'New visit. Microphone off.':'Paused. Your visit is still here; microphone off.');draw();}
  el('stop').onclick=()=>stop();el('forget').onclick=()=>stop(true);el('personality').onchange=()=>{stop(true);turn.message='New personality, fresh visit. Microphone off.';draw();};el('attending').onchange=el('handsFree').onchange=el('cloudConsent').onchange=draw;
  el('conversationMode').onchange=()=>{stop(true);if(el('conversationMode').value==='family')el('brainMode').value=el('engine').value='local';else if(!['friendly','mischief'].includes(el('personality').value))el('personality').value='friendly';turn.message='Reply mode changed. Start a fresh visit.';draw();};
  el('brainMode').onchange=el('engine').onchange=()=>{stop(true);if(el('engine').value==='elevenlabs')el('voice').value='original';turn.message='Service changed. Start a fresh visit and allow cloud use if selected.';draw();};
  el('shutdown').onclick=async()=>{
    if(el('shutdown').disabled)return;const previousToken=token;stop(true);token='';familyCatalog=false;el('familyModeOption').disabled=true;el('familyStatus').textContent='Family mode unavailable: check the local companion.';el('localVoiceReady').textContent='Local voice: companion stopping.';draw();
    try{const response=await fetch('/api/shutdown',{method:'POST',headers:{'X-Skelly-Token':previousToken}});if(!response.ok)throw Error();el('service').textContent='Local companion is stopping. Restart it from the project to use conversation again.';}
    catch{el('service').textContent='Could not confirm companion shutdown. Choose Stop and exit in the Skelly Live launcher, then restart it.';}
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop(true);else draw();});window.addEventListener('pagehide',()=>stop(true));
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>{live?.changed();if(turn.active||sessionRun.active){stop(true);turn.message='Audio devices changed. Check Windows input/output settings before another turn.';draw();}});
  if(window.SkellyLiveDevices){
    live=window.SkellyLiveDevices.create({media:navigator.mediaDevices,RepeatBack:window.SkellyTalkback.RepeatBack,Recorder:window.MediaRecorder,storage:window.localStorage,nodes:Object.fromEntries(['enableDevices','inputDevice','outputDevice','deviceStatus','testRecording','testPlayback'].map(id=>[id,el(id)])),onChange:draw,onPlayback:()=>{turn.cooldownUntil=Math.max(turn.cooldownUntil,Date.now()+60000);draw();},mayPlay:()=>el('attending').checked,isBusy:()=>!!turn.active||!!sessionRun.active||turn.remaining>0,outputSupported:!!window.HTMLMediaElement?.prototype?.setSinkId});
    el('thinkingCue').checked=el('quickTest').checked=el('handsFree').checked=false;el('thinkingCue').closest('label').hidden=true;el('quickTest').closest('label').hidden=true;el('handsFree').closest('label').hidden=true;el('previewDry').closest('details').hidden=true;el('sessionStatus').hidden=el('cueStatus').hidden=true;
    if(window.SkellyTalkback.LiveLink&&window.SkellyAudio?.frame&&navigator.bluetooth&&window.isSecureContext){
      liveLink=new window.SkellyTalkback.LiveLink(navigator.bluetooth,window.SkellyAudio.frame,{onChange:message=>{el('liveStatus').textContent=message;}});
      el('isolated').onchange=draw;
      el('enableLive').onclick=async()=>{
        if(el('enableLive').disabled)return;
        liveBusy=true;draw();el('liveStatus').textContent='Choose your Ultra Skelly in the Bluetooth chooser. Only the speaker request is sent.';
        try{el('liveStatus').textContent=await liveLink.enable(el('propName').value);}
        catch(error){el('liveStatus').textContent=error.message;}
        finally{liveBusy=false;draw();}
      };
    }else el('liveStatus').textContent='This browser cannot turn on the speaker. Use desktop Chrome or Edge, or pair Skelly’s Live speaker from Windows Bluetooth settings.';
    void el('check').onclick();
    // A background check never opens audio. If the companion disappears, stop
    // the current turn and require another explicit connection check.
    const heartbeat=async()=>{
      const expected=token,generation=checkGeneration;
      if(expected&&!document.hidden&&!checking){
        const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),4000);
        try{
          const response=await fetch('/api/status',{signal:abort.signal});
          const value=await window.SkellyConversation.readJSON(response,2048);
          if(!response.ok||value.ready!==true||value.conversation!==true||value.token!==expected||(el('conversationMode').value==='family'&&value.familyCatalog!==true))throw Error('Companion unavailable');
          if(generation===checkGeneration&&token===expected&&value.modelLoaded===false)el('service').textContent='Companion connected; the local model is stopped. The next local turn may reload it. Check diagnostics if it fails.';
        }catch{
          if(generation===checkGeneration&&token===expected&&!document.hidden){stop(true);token='';familyCatalog=false;el('familyModeOption').disabled=true;el('familyStatus').textContent='Family mode unavailable: check the local companion.';el('localVoiceReady').textContent='Local voice: companion connection lost.';el('service').textContent='Companion connection lost. Microphone stopped. Restart the launcher if needed, then check the local engine.';draw();}
        }finally{clearTimeout(timer);}
      }
      setTimeout(heartbeat,10000);
    };
    setTimeout(heartbeat,10000);
  }
  draw();
})();
