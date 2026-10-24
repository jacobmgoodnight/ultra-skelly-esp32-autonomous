/* Public identity for this reviewed firmware family; source is the authority. */
(function(){
  'use strict';
  const VERSION='2026.10.24-preview.1',REVISION=5,BUILD=2026102401;
  function firmwareView(data,capable=false,identified=false,stale=false){
    if(!identified)return {text:'Connect to identify installed firmware.',update:false};
    if(!capable)return {text:'Universal firmware required for USB settings.',update:true};
    if(data?.firmware===undefined)return {text:'USB settings supported · version not reported. Update for activity details.',update:false};
    const old=data.firmware<REVISION||data.firmware===REVISION&&(data.build??0)<BUILD;
    return {text:(stale?'Last reported: ':'')+'Firmware revision '+data.firmware+' · build '+(data.build??'unknown')+(old?' · update available':data.build===BUILD?' · current Studio release':' · different release'),update:old};
  }
  const api={VERSION,REVISION,BUILD,firmwareView};
  if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.SkellyRelease=api;
})();
