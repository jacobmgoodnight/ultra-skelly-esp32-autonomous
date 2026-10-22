(function(){
  "use strict";
  const byId=id=>document.getElementById(id);
  const session=new window.SkellySerial.Session(navigator.serial,()=>{
    byId("connect").disabled=session.busy||Boolean(session.port)||!navigator.serial;
    byId("disconnect").disabled=!session.port||session.closing;
    byId("identify").disabled=!session.port;
    byId("clock").disabled=!session.port||!session.capture.text.includes("USB READY v1 CLOCK");
    byId('readStatus').disabled=!session.port;
    byId("status").textContent=(session.port?"USB connected. ":"Disconnected. ")+session.capture.size+" bytes captured; "+session.capture.dropped+" discarded. "+session.error;
    byId("output").textContent=session.capture.text.slice(-32768);
  });
  const download=(data,name,type)=>{const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  byId("connect").disabled=!navigator.serial;
  if(!navigator.serial)byId("status").textContent="Web Serial is unavailable. Use desktop Chrome/Edge on HTTPS, localhost or a supported local file, or use the Python capture tool.";
  byId("connect").onclick=()=>session.connect().catch(e=>byId("status").textContent=e.message);
  byId("disconnect").onclick=()=>session.disconnect().catch(e=>byId("status").textContent=e.message);
  byId("clock").onclick=()=>session.syncClock().then(()=>byId("status").textContent="Time sent. Look for USB TIME accepted in the log.").catch(e=>byId("status").textContent=e.message);
  byId("identify").onclick=()=>session.identify().catch(e=>byId("status").textContent=e.message);
  byId('readStatus').onclick=()=>session.status().then(r=>byId('controllerState').textContent=r.text+'\nReported controller state; physical movement and lighting need observation.').catch(e=>byId('controllerState').textContent=e.message);
  byId("raw").onclick=()=>download(session.capture.bytes(),"Skelly-serial.bin","application/octet-stream");
  byId("text").onclick=()=>download(new TextDecoder().decode(session.capture.bytes()),"Skelly-serial.txt","text/plain");
  byId("report").onclick=()=>download(JSON.stringify(session.diagnostics(),null,2),"Skelly-diagnostics.json","application/json");
})();
