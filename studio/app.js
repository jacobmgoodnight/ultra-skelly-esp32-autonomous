/* Skelly Studio — entirely client-side Arduino firmware configurator.
 * Works with the exact upstream-tested firmware copy in template.js.
 * Torso/arm commands are intentionally absent.
 */
(function () {
  "use strict";
  const DEFAULTS = Object.freeze({
    headEnabled:true, headMin:32, headMax:60,
    jawEnabled:true, jawMin:45, jawMax:90, jawFile:12,
    overlap:true, eyesEnabled:false, eyesMin:120, eyesMax:300,
    bleName:"Ultra Skelly v2", eyeChoices:Array.from({length:18},(_,i)=>i+1)
  });
  const PRESETS = {
    subtle:{headMin:65,headMax:120,jawMin:100,jawMax:180,overlap:false},
    normal:{headMin:32,headMax:60,jawMin:45,jawMax:90,overlap:true},
    haunted:{headMin:32,headMax:45,jawMin:30,jawMax:60,overlap:true}
  };
  const byId = id => document.getElementById(id);
  function replaceOnce(source, original, replacement) {
    const at=source.indexOf(original);
    if (at<0 || source.indexOf(original,at+original.length)!==-1)
      throw new Error("Firmware template changed: missing or repeated anchor "+original.slice(0,45));
    return source.slice(0,at)+replacement+source.slice(at+original.length);
  }
  function validate(config) {
    const error=[];
    if(!config.headEnabled && !config.jawEnabled && !config.eyesEnabled)
      error.push("Enable at least one movement or eye effect.");
    for(const [name,enabled,min,max,floor] of [
      ["Head",config.headEnabled,config.headMin,config.headMax,32],
      ["Jaw",config.jawEnabled,config.jawMin,config.jawMax,22],
      ["Eyes",config.eyesEnabled,config.eyesMin,config.eyesMax,15]
    ]) {
      if(!enabled)continue;
      if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<floor||max>3600||min>max)
        error.push(name+": choose whole-number intervals from "+floor+" to 3600 seconds, minimum ≤ maximum.");
    }
    if(config.jawEnabled && (!Number.isSafeInteger(config.jawFile)||config.jawFile<1||config.jawFile>65535))
      error.push("Enter the MP3 serial shown in your own web-controller log (1–65535).");
    if(typeof config.bleName!=="string"||!config.bleName.trim()||config.bleName.length>48||/[\x00-\x1F]/.test(config.bleName))
      error.push("Enter a valid advertised Bluetooth device name (1–48 characters).");
    if(config.eyesEnabled && (!config.eyeChoices.length || config.eyeChoices.some(n=>!Number.isSafeInteger(n)||n<1||n>18) || new Set(config.eyeChoices).size!==config.eyeChoices.length))
      error.push("Select at least one valid eye design number between 1 and 18.");
    return error;
  }
  function generateSketch(config) {
    const errors=validate(config);
    if(errors.length)throw new Error(errors.join("\n"));
    let out=window.SKELLY_FIRMWARE_TEMPLATE;
    if(typeof out!=="string" || out.length<5000)throw new Error("The tested firmware template did not load. Refresh this page.");
    // These substitutions fail closed rather than emitting a partial or invalid sketch.
    const assignments=[
      ["const uint16_t MOUTH_FILE_SERIAL = 12;","const uint16_t MOUTH_FILE_SERIAL = "+config.jawFile+";"],
      ["const bool MOUTH_ENABLED = true;","const bool MOUTH_ENABLED = "+Boolean(config.jawEnabled)+";"],
      ["const bool EYES_ENABLED = false;","const bool EYES_ENABLED = "+Boolean(config.eyesEnabled)+";"],
      ["const uint32_t HEAD_MIN_INTERVAL_MS = 32000;","const uint32_t HEAD_MIN_INTERVAL_MS = "+(config.headMin*1000)+";"],
      ["const uint32_t HEAD_MAX_INTERVAL_MS = 60000;","const uint32_t HEAD_MAX_INTERVAL_MS = "+(config.headMax*1000)+";"],
      ["const uint32_t MOUTH_MIN_INTERVAL_MS = 45000;","const uint32_t MOUTH_MIN_INTERVAL_MS = "+(config.jawMin*1000)+";"],
      ["const uint32_t MOUTH_MAX_INTERVAL_MS = 90000;","const uint32_t MOUTH_MAX_INTERVAL_MS = "+(config.jawMax*1000)+";"],
      ["const uint32_t EYE_MIN_INTERVAL_MS = 120000;","const uint32_t EYE_MIN_INTERVAL_MS = "+(config.eyesMin*1000)+";"],
      ["const uint32_t EYE_MAX_INTERVAL_MS = 300000;","const uint32_t EYE_MAX_INTERVAL_MS = "+(config.eyesMax*1000)+";"],
      ['#define SKELLY_NAME "Ultra Skelly v2"','#define SKELLY_NAME '+JSON.stringify(config.bleName.trim())]
    ];
    for(const [from,to] of assignments)out=replaceOnce(out,from,to);
    out=replaceOnce(out,
      "const bool MOUTH_ENABLED = "+Boolean(config.jawEnabled)+";",
      "const bool MOUTH_ENABLED = "+Boolean(config.jawEnabled)+";\n"+
      "const bool HEAD_ENABLED = "+Boolean(config.headEnabled)+";\n"+
      "const bool ALLOW_HEAD_JAW_OVERLAP = "+Boolean(config.overlap)+";");
    out=replaceOnce(out,
      "  if (reached(now, nextHeadAt)) {",
      "  if (HEAD_ENABLED && reached(now, nextHeadAt) &&\n"+
      "      (ALLOW_HEAD_JAW_OVERLAP || !mouthConfigured() || reached(now, mouthPlayingUntil))) {");
    out=replaceOnce(out,
      "  if (mouthConfigured() && reached(millis(), nextMouthAt) &&\n      reached(millis(), mouthSafeAfter)) {",
      "  if (mouthConfigured() && reached(millis(), nextMouthAt) &&\n"+
      "      reached(millis(), mouthSafeAfter) &&\n"+
      "      (ALLOW_HEAD_JAW_OVERLAP || !HEAD_ENABLED || reached(millis(), headMovingUntil))) {");
    const eyes=(config.eyeChoices.length?config.eyeChoices:DEFAULTS.eyeChoices).slice().sort((a,b)=>a-b);
    out=replaceOnce(out,
      "const bool EYES_ENABLED = "+Boolean(config.eyesEnabled)+";",
      "const bool EYES_ENABLED = "+Boolean(config.eyesEnabled)+";\n"+
      "const uint8_t EYE_OPTIONS[] = {"+eyes.join(", ")+"};\n"+
      "const size_t EYE_OPTIONS_COUNT = sizeof(EYE_OPTIONS) / sizeof(EYE_OPTIONS[0]);");
    out=replaceOnce(out,
      "  uint8_t eye = (uint8_t)random(1, 19); // inclusive 1-18\n  if (eye == lastEye) eye = (uint8_t)((eye % 18) + 1);",
      "  uint8_t eye = EYE_OPTIONS[random(0, (long)EYE_OPTIONS_COUNT)];\n"+
      "  if (EYE_OPTIONS_COUNT > 1 && eye == lastEye) {\n"+
      "    // Move to the next permitted eye rather than repeating the same icon.\n"+
      "    for (size_t k = 0; k < EYE_OPTIONS_COUNT; ++k) {\n"+
      "      if (EYE_OPTIONS[k] != lastEye) { eye = EYE_OPTIONS[k]; break; }\n"+
      "    }\n"+
      "  }");
    const stamp=[
      "// GENERATED WITH SKELLY STUDIO — ultra-skelly-esp32-autonomous",
      "// Settings: head="+config.headEnabled+" "+config.headMin+"–"+config.headMax+"s; jaw="+config.jawEnabled+" "+config.jawMin+"–"+config.jawMax+"s",
      "// Overlap="+config.overlap+"; eyes="+config.eyesEnabled+" "+config.eyesMin+"–"+config.eyesMax+"s",
      "// Eye feature unverified: opt in only after the EyeSingleTest sketch works.",
      "// Do not enable torso/arm movement in stored audio file metadata; use 0x00.",
      ""
    ].join("\n");
    return stamp+out;
  }
  function readConfig() {
    const n=id=>Number(byId(id).value);
    return {
      headEnabled:byId("headEnabled").checked,headMin:n("headMin"),headMax:n("headMax"),
      jawEnabled:byId("jawEnabled").checked,jawMin:n("jawMin"),jawMax:n("jawMax"),jawFile:n("jawFile"),
      overlap:byId("overlap").checked,eyesEnabled:byId("eyesEnabled").checked,
      eyesMin:n("eyesMin"),eyesMax:n("eyesMax"),
      bleName:byId("bleName").value,eyeChoices:Array.from(document.querySelectorAll(".eye-choice input:checked")).map(el=>Number(el.value))
    };
  }
  function writeConfig(cfg) {
    for(const id of ["headMin","headMax","jawMin","jawMax","jawFile","eyesMin","eyesMax","bleName"])
      if(cfg[id]!==undefined)byId(id).value=cfg[id];
    for(const id of ["headEnabled","jawEnabled","overlap","eyesEnabled"])
      if(cfg[id]!==undefined)byId(id).checked=cfg[id];
    if(cfg.eyeChoices)document.querySelectorAll(".eye-choice input").forEach(el=>el.checked=cfg.eyeChoices.includes(Number(el.value)));
    render();
  }
  function simulateSchedule(c) {
    let seed=0x582A, random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    const between=(lo,hi)=>lo+Math.floor(random()*(hi-lo+1));
    const events=[];
    const add=(kind,on,min,max,duration)=>{
      if(!on||!Number.isInteger(min)||!Number.isInteger(max)||min>max||min<=0)return;
      let t=0;
      for(let j=0;j<70;j++){t+=between(min,max);if(t>=300)break;events.push({kind,time:t,duration})}
    };
    add("head",c.headEnabled,c.headMin,c.headMax,25);
    add("jaw",c.jawEnabled,c.jawMin,c.jawMax,21);
    add("eyes",c.eyesEnabled,c.eyesMin,c.eyesMax,0);
    events.sort((a,b)=>a.time-b.time);
    if(!c.overlap&&c.headEnabled&&c.jawEnabled){
      let headUntil=0,jawUntil=0;
      for(const e of events){
        if(e.kind==="head"){e.time=Math.max(e.time,jawUntil);headUntil=e.time+25}
        if(e.kind==="jaw"){e.time=Math.max(e.time,headUntil);jawUntil=e.time+21}
      }
    }
    return events.filter(e=>e.time<300);
  }
  function render() {
    const c=readConfig(),errors=validate(c);
    byId("headSummary").textContent=c.headEnabled?c.headMin+"–"+c.headMax+" sec":"Off";
    byId("jawSummary").textContent=c.jawEnabled?c.jawMin+"–"+c.jawMax+" sec · file #"+c.jawFile:"Off";
    byId("eyeSummary").textContent=c.eyesEnabled?c.eyesMin+"–"+c.eyesMax+" sec · unverified":"Off · experimental";
    byId("overlapSummary").textContent=c.overlap?"Allowed":"Avoided";
    for(const id of ["headEnabled","jawEnabled"])document.querySelector('[data-for="'+id+'"]').classList.toggle("muted",!byId(id).checked);
    byId("eyeOptions").classList.toggle("muted",!c.eyesEnabled);
    const e=byId("error");e.hidden=!errors.length;e.textContent=errors.join("\n");
    byId("download").disabled=errors.length>0;byId("preview").disabled=errors.length>0;
    const timeline=byId("timeline");timeline.replaceChildren();
    for(const ev of simulateSchedule(c)){
      const element=document.createElement("span");
      element.className="event "+ev.kind;
      element.style.left=(ev.time/3)+"%";
      element.title=ev.kind+" at "+Math.floor(ev.time/60)+":"+String(ev.time%60).padStart(2,"0")+" (illustrative)";
      timeline.appendChild(element);
    }
  }
  function init(){
    const eyeGrid=byId("eyeGrid");
    for(let i=1;i<=18;i++){
      const label=document.createElement("label");
      label.className="eye-choice";
      const input=document.createElement("input");input.type="checkbox";input.value=i;input.checked=true;
      const text=document.createElement("span");text.textContent=i;
      label.append(input,text);eyeGrid.append(label);
    }
    for(const el of document.querySelectorAll("input"))el.addEventListener("input",()=>{
      for(const b of document.querySelectorAll(".preset"))b.classList.remove("chosen");
      render();
    });
    byId("selectAllEyes").addEventListener("click",()=>{document.querySelectorAll(".eye-choice input").forEach(el=>el.checked=true);render()});
    byId("selectFewEyes").addEventListener("click",()=>{document.querySelectorAll(".eye-choice input").forEach(el=>el.checked=Number(el.value)<=6);render()});
    for(const b of document.querySelectorAll(".preset"))b.addEventListener("click",()=>{
      for(const p of document.querySelectorAll(".preset"))p.classList.toggle("chosen",p===b);
      writeConfig(PRESETS[b.dataset.preset]);
    });
    byId("download").addEventListener("click",()=>{
      try{
        const code=generateSketch(readConfig());
        const blob=new Blob([code],{type:"text/plain;charset=utf-8"});
        const href=URL.createObjectURL(blob);
        const a=document.createElement("a");a.href=href;a.download="SkellyAutonomous.ino";
        document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
      }catch(e){byId("error").textContent=e.message;byId("error").hidden=false}
    });
    const dialog=byId("codeDialog");
    byId("preview").addEventListener("click",()=>{
      try{byId("codeText").textContent=generateSketch(readConfig());dialog.showModal()}
      catch(e){byId("error").textContent=e.message;byId("error").hidden=false}
    });
    for(const id of ["closeDialog","closeDialogBottom"])byId(id).addEventListener("click",()=>dialog.close());
    byId("copyCode").addEventListener("click",async()=>{
      try{await navigator.clipboard.writeText(byId("codeText").textContent);
        byId("copyCode").textContent="Copied!";
        setTimeout(()=>byId("copyCode").textContent="Copy code",1500)
      }catch(e){byId("copyCode").textContent="Copy unavailable; select code above"}
    });
    writeConfig(DEFAULTS);
  }
  window.SkellyStudioGenerator={DEFAULTS,PRESETS,validate,generateSketch,simulateSchedule};
  if(typeof document!=="undefined")document.addEventListener("DOMContentLoaded",init);
})();
