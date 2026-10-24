/* Verify packages before ESP Web Tools can open a USB port. No background flashing. */
(function(){
  'use strict';
  const SIZE=4194304,SHA=/^[a-f0-9]{40}$/,HASH=/^[a-f0-9]{64}$/,VERSION=/^\d{4}\.\d{2}\.\d{2}-preview\.\d+$/;
  async function verifyPackage(metadata,bytes,expected={}) {
    if(!metadata||!['head-only','universal'].includes(metadata.profile)||(metadata.binaryFile!==undefined&&metadata.binaryFile!==(metadata.profile==='universal'?'universal.bin':'head-only.bin'))||metadata.chipFamily!=='ESP32'||metadata.core!=='3.3.12'||
      !SHA.test(metadata.sourceCommit)||!HASH.test(metadata.sourceSHA256)||!HASH.test(metadata.binarySHA256)||metadata.physicalStatus!=='Untested'||
      bytes.length!==SIZE||metadata.bytes!==bytes.length||bytes[4096]!==0xe9||bytes[65536]!==0xe9)
      throw Error('Invalid ESP32 package. Select build.json and its matching firmware .bin, or retry the public download.');
    const device=metadata.deviceId??'ultra';
    if(!['ultra','skelly12'].includes(device)||(device==='skelly12'&&metadata.profile!=='universal'))throw Error('Unsupported package device.');
    if(metadata.releaseVersion!==undefined&&!VERSION.test(metadata.releaseVersion))throw Error('Unsupported package release label.');
    for(const key of ['firmwareRevision','firmwareBuild'])if(metadata[key]!==undefined&&(!Number.isSafeInteger(metadata[key])||metadata[key]<1||metadata[key]>0xffffffff))throw Error('Unsupported package firmware identity.');
    if(expected.deviceId&&device!==expected.deviceId)throw Error('Wrong Skelly model. Return to Studio and select the correct device before installing.');
    for(const key of ['profile','sourceCommit','binarySHA256','releaseVersion','firmwareRevision','firmwareBuild'])
      if(expected[key]!==undefined&&metadata[key]!==expected[key])throw Error('Package release/model does not match this Studio. Reload the page and retry.');
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
    if(digest!==metadata.binarySHA256)throw Error('Firmware hash mismatch. Download the complete package again.');
    return metadata;
  }
  function verifyCatalog(catalog,device,release){
    if(!['ultra','skelly12'].includes(device))throw Error('Unknown Skelly model. Return to Studio to choose your device.');
    if(!catalog||catalog.schema!==1||!SHA.test(catalog.sourceCommit)||!VERSION.test(catalog.releaseVersion))throw Error('Invalid firmware catalog. Retry after reloading Studio.');
    const entry=catalog.packages?.[device],path='./'+catalog.releaseVersion+'/'+catalog.sourceCommit+'/'+device+'/build.json';
    if(!entry||entry.metadata!==path||!HASH.test(entry.binarySHA256))throw Error('No verified universal package for this Skelly model. Use the advanced source download.');
    if(catalog.releaseVersion!==release.VERSION||catalog.firmwareRevision!==release.REVISION||catalog.firmwareBuild!==release.BUILD)throw Error('Studio and firmware catalog differ. Reload this page before installing.');
    return {deviceId:device,profile:'universal',sourceCommit:catalog.sourceCommit,binarySHA256:entry.binarySHA256,releaseVersion:catalog.releaseVersion,firmwareRevision:catalog.firmwareRevision,firmwareBuild:catalog.firmwareBuild,path};
  }
  async function boundedFetch(url,limit,{fetcher=fetch,signal}={}){
    const response=await fetcher(url,{cache:'no-store',redirect:'error',signal});
    if(!response.ok)throw Error('Firmware download unavailable (HTTP '+response.status+'). Retry, or use the advanced Arduino fallback.');
    const declared=Number(response.headers.get('content-length'));
    if(declared>limit)throw Error('Firmware download exceeds its allowed size.');
    const reader=response.body.getReader(),chunks=[];let length=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit)throw Error('Firmware download exceeds its allowed size.');chunks.push(value);}}
    finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return bytes;
  }
  async function loadPublicPackage(base,device,release,options={}){
    const root=new URL('./firmware/',base),json=async url=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedFetch(url,8192,options)));
    const catalog=await json(new URL('catalog.json',root)),expected=verifyCatalog(catalog,device,release);
    const metadataURL=new URL(expected.path,root),metadata=await json(metadataURL);
    const bytes=await boundedFetch(new URL('universal.bin',metadataURL),SIZE,options);
    await verifyPackage(metadata,bytes,expected);return {metadata,bytes};
  }
  function supportMessage(serial,secure){
    if(!secure)return 'USB installation needs HTTPS or localhost. Open the published Studio in desktop Chrome or Edge.';
    if(!serial)return 'This browser does not provide Web Serial. Open this page in desktop Chrome or Edge on a computer with USB access. You can still edit settings or use the Arduino fallback.';
    return '';
  }
  function installerManifest(metadata,binaryURL){return {name:(metadata.deviceId==='skelly12'?'Experimental 12-foot Skelly':'Ultra Skelly')+' '+metadata.profile,version:metadata.releaseVersion||metadata.sourceCommit.slice(0,12),new_install_prompt_erase:false,new_install_improv_wait_time:0,builds:[{chipFamily:'ESP32',parts:[{path:binaryURL,offset:0}]}]};}
  const api={verifyPackage,verifyCatalog,boundedFetch,loadPublicPackage,supportMessage,installerManifest};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof document==='undefined')return;
  const el=id=>document.getElementById(id),status=el('installerStatus');if(!status)return;
  const device=new URL(location.href).searchParams.get('device')||'ultra',experimental=device==='skelly12';
  const model=experimental?'2026 app-controlled 12-foot Skelly — Experimental / Not Hardware Tested':'6.5 ft Ultra Skelly v2';
  el('installModel').textContent=model;el('installExperimental').hidden=!experimental;
  el('configureSkelly').href='./index.html'+(experimental?'?device=skelly12':'')+'#controllerPanel';
  let generation=0,abort=null,binaryURL=null,manifestURL=null;
  const unavailable=supportMessage(navigator.serial,window.isSecureContext)||(!['ultra','skelly12'].includes(device)?'Unknown Skelly model. Return to Studio and choose your device.':'');
  el('prepareInstall').disabled=!!unavailable;el('firmwareFiles').disabled=!!unavailable;
  if(unavailable){status.textContent=unavailable;status.dataset.state='error';}
  function clear(){++generation;abort?.abort();abort=null;el('installer').replaceChildren();for(const url of [binaryURL,manifestURL])if(url)URL.revokeObjectURL(url);binaryURL=manifestURL=null;}
  async function prepare(localFiles){
    if(unavailable)return;
    if(document.querySelector('ewt-install-dialog')){status.textContent='Close the current installer dialog before preparing another package.';return;}
    if(!el('installConsent').checked){clear();status.textContent='Confirm the board and firmware/settings overwrite notice first.';return;}
    if(window.SkellyUsbPortOpen?.()||window.SkellyControllerPortOpen?.()){status.textContent='Disconnect the USB settings/log session before installing firmware.';return;}
    clear();const id=generation;abort=new AbortController();const activeAbort=abort,timeout=setTimeout(()=>activeAbort.abort(),45000);
    el('prepareInstall').disabled=el('firmwareFiles').disabled=true;status.dataset.state='busy';status.textContent='Downloading and verifying the firmware package…';
    try{
      let bundle;
      if(localFiles){
        const meta=localFiles.find(f=>f.name==='build.json');if(!meta||meta.size>8192)throw Error('Select build.json and its firmware .bin together.');
        const metadata=JSON.parse(await meta.text()),file=localFiles.find(f=>f.name===(metadata.profile==='universal'?'universal.bin':'head-only.bin'));
        if(!file||file.size!==SIZE)throw Error('Select build.json and its matching 4 MiB firmware .bin together.');
        const bytes=new Uint8Array(await file.arrayBuffer());await verifyPackage(metadata,bytes,{deviceId:device});bundle={metadata,bytes};
      }else bundle=await loadPublicPackage(location.href,device,window.SkellyRelease,{signal:abort.signal});
      if(id!==generation)return;
      clearTimeout(timeout);
      let libraryTimeout;
      try{await Promise.race([import('https://unpkg.com/esp-web-tools@10.2.1/dist/web/install-button.js'),new Promise((_,reject)=>{libraryTimeout=setTimeout(()=>reject(Error('Installer library timed out. Check internet access and retry, or use the Arduino fallback.')),20000);})]);}
      finally{clearTimeout(libraryTimeout);}
      if(id!==generation)return;
      const {metadata,bytes}=bundle;
      binaryURL=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
      manifestURL=URL.createObjectURL(new Blob([JSON.stringify(installerManifest(metadata,binaryURL))],{type:'application/json'}));
      const button=document.createElement('esp-web-install-button'),activate=document.createElement('button');
      activate.type='button';activate.slot='activate';activate.textContent='Connect ESP32 & install firmware';
      activate.addEventListener('click',event=>{if(!el('installConsent').checked){event.preventDefault();event.stopImmediatePropagation();status.textContent='Confirm the overwrite notice before opening the USB installer.';}});
      button.setAttribute('manifest',manifestURL);button.append(activate);el('installer').replaceChildren(button);
      status.dataset.state='ready';status.textContent=(metadata.releaseVersion||'Older local package')+' · '+metadata.sourceCommit.slice(0,12)+' · '+model+'. SHA-256 matches. Browser flashing: physically Untested. Choose Connect ESP32 & install firmware, then follow the installer.';
      el('localPackageNote').hidden=metadata.profile==='universal';
    }catch(error){if(id===generation){status.dataset.state='error';status.textContent=error.name==='AbortError'?'Download timed out. Check your connection and retry. No firmware was written.':error.message+' No firmware was written.';}}
    finally{clearTimeout(timeout);if(id===generation){el('prepareInstall').disabled=false;el('firmwareFiles').disabled=false;}}
  }
  el('prepareInstall').onclick=()=>prepare();
  el('firmwareFiles').addEventListener('change',()=>prepare(Array.from(el('firmwareFiles').files)));
  window.addEventListener('pagehide',clear);
})();
