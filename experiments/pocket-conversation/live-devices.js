/* Explicit browser audio routing for the attended operator page. */
(function(){
  'use strict';
  function create({media, RepeatBack, Recorder, storage, nodes, onChange, onPlayback=()=>{}, mayPlay=()=>true, isBusy, outputSupported}){
    const read=key=>{try{return storage?.getItem('skelly-live-'+key)||'';}catch{return '';}};
    const save=(key,value)=>{try{storage?.setItem('skelly-live-'+key,value);}catch{}};
    let input=read('input'),output=read('output'),inputAvailable=false,outputAvailable=false,enabled=false,pending=false,sequence=0,timer,previousTest='idle';
    const test=new RepeatBack({media,Recorder,onChange:()=>{const finished=previousTest==='playing'&&test.state==='ready';previousTest=test.state;nodes.deviceStatus.textContent=test.message;if(finished){test.stop('Test discarded. Browser playback ended; confirm actual sound separately.');return;}draw();}});
    function draw(notify=true){
      const busy=isBusy(), testing=pending||['requesting','recording','finishing','playing'].includes(test.state);
      nodes.enableDevices.disabled=busy||testing;nodes.inputDevice.disabled=nodes.outputDevice.disabled=busy||testing;
      nodes.testRecording.disabled=busy||testing||!ready();
      nodes.testPlayback.disabled=busy||testing||!ready()||test.state!=='ready'||!mayPlay();
      if(notify)onChange();
    }
    function ready(){return enabled&&inputAvailable&&outputAvailable&&!!input&&!!output&&outputSupported;}
    function list(select,kind,devices,chosen){
      select.replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='Choose '+(kind==='audioinput'?'a microphone':'a speaker');select.append(blank);
      for(const device of devices.filter(d=>d.kind===kind&&d.deviceId&&!['default','communications'].includes(d.deviceId))){
        const option=document.createElement('option');option.value=device.deviceId;option.textContent=device.label||'Audio device (label unavailable)';select.append(option);
      }
      const found=[...select.options].some(option=>option.value===chosen&&chosen);select.value=found?chosen:'';return !!found;
    }
    async function refresh(){
      const generation=++sequence;
      try{
        const devices=await media.enumerateDevices();if(generation!==sequence)return;
        inputAvailable=list(nodes.inputDevice,'audioinput',devices,input);outputAvailable=list(nodes.outputDevice,'audiooutput',devices,output);
        nodes.deviceStatus.textContent=!outputSupported?'This browser cannot select a speaker. Use desktop Chrome or Edge.':(input&&!inputAvailable?'Selected microphone is unavailable. Reconnect it or explicitly choose another. ':!input?'Choose an input microphone. ':'')+(output&&!outputAvailable?'Selected speaker is unavailable. Reconnect it or explicitly choose another. ':!output?'Choose the Skelly Live Stereo speaker. ':'')+(ready()?'Devices selected. Check actual sound and jaw response separately.':'');
      }catch{enabled=false;nodes.deviceStatus.textContent='Could not list audio devices. Check browser permissions and Windows audio settings.';}
      draw();
    }
    nodes.enableDevices.onclick=async()=>{
      if(isBusy()||pending)return;
      test.stop();const generation=++sequence;pending=true;draw();nodes.deviceStatus.textContent='Allow microphone access to list devices. The microphone will close immediately.';
      try{
        const stream=await media.getUserMedia({audio:input?{deviceId:{exact:input}}:true,video:false});
        stream.getTracks().forEach(track=>track.stop());if(generation!==sequence)return;pending=false;enabled=true;await refresh();
      }catch(error){if(generation!==sequence)return;pending=false;enabled=false;try{const devices=await media.enumerateDevices();if(generation!==sequence)return;inputAvailable=list(nodes.inputDevice,'audioinput',devices,input);outputAvailable=list(nodes.outputDevice,'audiooutput',devices,output);}catch{}nodes.deviceStatus.textContent=error.name==='NotAllowedError'?'Microphone permission denied. Allow access in Windows and the browser, then retry.':input?'Selected microphone unavailable. Reconnect it or choose another; no substitute was used.':'Could not open the microphone. Check Windows input and browser permissions.';draw();}
    };
    function selectionStatus(){nodes.deviceStatus.textContent=ready()?'Devices selected. Check actual sound and jaw response separately.':'Select an available microphone and speaker, then check both devices.';}
    nodes.inputDevice.onchange=()=>{test.stop();input=nodes.inputDevice.value;save('input',input);inputAvailable=!!input;selectionStatus();draw();};
    nodes.outputDevice.onchange=()=>{test.stop();output=nodes.outputDevice.value;save('output',output);outputAvailable=!!output;selectionStatus();draw();};
    nodes.testRecording.onclick=()=>{if(!ready()||isBusy())return;test.input=input;test.sink=output;void test.record().then(()=>{if(test.state==='recording')timer=setTimeout(()=>test.finish(),3000);});};
    nodes.testPlayback.onclick=()=>{if(ready()&&!isBusy()&&mayPlay()){test.sink=output;onPlayback();void test.play();}};
    function stop(){++sequence;pending=false;clearTimeout(timer);test.stop();}
    function changed(){stop();enabled=false;inputAvailable=outputAvailable=false;nodes.deviceStatus.textContent='Audio devices changed. Re-enable devices and verify the selected microphone and speaker before continuing.';draw();}
    return {ready,input:()=>input,output:()=>output,testing:()=>pending||!['idle','ready','error'].includes(test.state),testPhase:()=>test.state,testStream:()=>test.stream,stop,changed,sync:()=>draw(false)};
  }
  const api={create};if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.SkellyLiveDevices=api;
})();
