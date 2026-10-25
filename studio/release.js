/* Public identity for this reviewed firmware family; source is the authority. */
(function(){
  'use strict';
  const VERSION='2026.10.24-preview.2',REVISION=5,BUILD=2026102402;
  function firmwareView(data,capable=false,identified=false,stale=false){
    if(!identified)return {text:'Connect to identify installed firmware.',update:false};
    if(!capable)return {text:'Universal firmware required for USB settings.',update:true};
    if(data?.firmware===undefined)return {text:'USB settings supported · version not reported. Update for activity details.',update:false};
    const old=data.firmware<REVISION||data.firmware===REVISION&&data.build!==undefined&&data.build<BUILD;
    const current=data.firmware===REVISION&&data.build===BUILD;
    const label=old?' · update available':current?' · current Studio release':data.build===undefined?' · release not identified':' · different release';
    return {text:(stale?'Last reported: ':'')+'Firmware revision '+data.firmware+' · build '+(data.build??'unknown')+label,update:old};
  }
  const api={VERSION,REVISION,BUILD,firmwareView};
  if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.SkellyRelease=api;
})();
