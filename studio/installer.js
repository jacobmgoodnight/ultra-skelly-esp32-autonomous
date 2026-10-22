/* A local, hash-checked fixed-profile installer. Loaded only on the USB page. */
(function(){
  "use strict";
  async function verifyPackage(metadata,bytes) {
    if(metadata.profile!=="head-only"||metadata.chipFamily!=="ESP32"||metadata.core!=="3.3.12"||
      !/^[a-f0-9]{40}$/.test(metadata.sourceCommit)||!/^[a-f0-9]{64}$/.test(metadata.sourceSHA256)||
      !/^[a-f0-9]{64}$/.test(metadata.binarySHA256)||metadata.physicalStatus!=="Untested"||
      bytes.length!==4194304||metadata.bytes!==bytes.length||bytes[4096]!==0xe9||bytes[65536]!==0xe9)
      throw new Error("Choose build.json and head-only.bin from the same ESP32 installer package.");
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),n=>n.toString(16).padStart(2,"0")).join("");
    if(digest!==metadata.binarySHA256)throw new Error("Firmware hash mismatch. Download the complete package again.");
    return metadata;
  }
  if(typeof module!=="undefined")module.exports={verifyPackage};
  if(typeof document==="undefined")return;
  const status=document.getElementById("installerStatus"),input=document.getElementById("firmwareFiles");
  let binaryURL=null,manifestURL=null;
  input.addEventListener("change",async()=>{
    const container=document.getElementById("installer");container.replaceChildren();
    if(binaryURL)URL.revokeObjectURL(binaryURL);if(manifestURL)URL.revokeObjectURL(manifestURL);
    try {
      const files=Array.from(input.files),meta=files.find(f=>f.name==="build.json"),binary=files.find(f=>f.name==="head-only.bin");
      if(!meta||!binary||meta.size>8192||binary.size!==4194304)throw new Error("Select build.json and head-only.bin together from an extracted package.");
      const verifiedBytes=new Uint8Array(await binary.arrayBuffer());
      const data=await verifyPackage(JSON.parse(await meta.text()),verifiedBytes);
      status.textContent="Head only, every 2–4 minutes. Build "+data.sourceCommit.slice(0,12)+"; core 3.3.12; image hash matches. Physical status: "+data.physicalStatus+". This does not authenticate the publisher—use your reviewed GitHub build.";
      const enable=document.createElement("button");enable.type="button";enable.textContent="Load USB installer for this preview";
      enable.onclick=async()=>{
        if(!document.getElementById("installConsent").checked){status.textContent="Confirm the overwrite and preview notice first.";return;}
        enable.disabled=true;
        try {
          // Version pinned; no CDN script is fetched by the configurator or log tools.
          await import("https://unpkg.com/esp-web-tools@10.2.1/dist/web/install-button.js");
          binaryURL=URL.createObjectURL(new Blob([verifiedBytes],{type:"application/octet-stream"}));
          manifestURL=URL.createObjectURL(new Blob([JSON.stringify({name:"Ultra Skelly head-only preview",version:data.sourceCommit.slice(0,12),new_install_prompt_erase:true,new_install_improv_wait_time:0,builds:[{chipFamily:"ESP32",parts:[{path:binaryURL,offset:0}]}]})],{type:"application/json"}));
          const button=document.createElement("esp-web-install-button");button.setAttribute("manifest",manifestURL);container.replaceChildren(button);
        }catch(e){status.textContent="Installer unavailable: "+e.message;enable.disabled=false;}
      };
      container.append(enable);
    }catch(e){status.textContent=e.message;}
  });
})();
