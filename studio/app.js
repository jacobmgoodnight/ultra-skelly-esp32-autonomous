/* Skelly Studio — entirely client-side Arduino firmware configurator.
 * Works with the exact upstream-tested firmware copy in template.js.
 * Torso and arm are optional; shared motor cooldown prevents concurrent body commands.
 */
(function () {
  "use strict";
  const DEFAULTS = Object.freeze({
    headEnabled:true, headMin:32, headMax:60,
    torsoEnabled:false, torsoMin:240, torsoMax:420,
    armEnabled:false, armMin:360, armMax:720,
    bodyOverlap:false, jawProtectBody:true, jawFollowupMotor:0, jawFollowupDelaySec:2, jawFollowupRecurring:false,
    jawEnabled:true, jawMin:45, jawMax:90, jawFile:12, jawExtras:"",
    overlap:true, eyesEnabled:false, eyesMin:120, eyesMax:300, eyeJawMode:1,
    restEnabled:false,restMin:180,restMax:420,restDurationMin:25,restDurationMax:60,
    bleName:"Ultra Skelly v2", eyeChoices:Array.from({length:18},(_,i)=>i+1)
  });
  const PRESETS = {
    subtle:{headEnabled:true,headMin:65,headMax:120,jawEnabled:false,jawMin:100,jawMax:180,torsoEnabled:false,armEnabled:false,bodyOverlap:false,overlap:false},
    normal:{headEnabled:true,headMin:32,headMax:60,jawEnabled:true,jawMin:45,jawMax:90,torsoEnabled:false,armEnabled:false,bodyOverlap:false,overlap:true},
    haunted:{headEnabled:true,headMin:32,headMax:45,jawEnabled:true,jawMin:30,jawMax:60,torsoEnabled:true,torsoMin:180,torsoMax:360,armEnabled:true,armMin:360,armMax:720,bodyOverlap:false,overlap:true,jawProtectBody:true,jawFollowupMotor:0,jawFollowupDelaySec:2,jawFollowupRecurring:false}
  };
  const byId = id => document.getElementById(id);
  function replaceOnce(source, original, replacement) {
    const at=source.indexOf(original);
    if (at<0 || source.indexOf(original,at+original.length)!==-1)
      throw new Error("Firmware template changed: missing or repeated anchor "+original.slice(0,45));
    return source.slice(0,at)+replacement+source.slice(at+original.length);
  }

  function extraFileNumbers(config) {
    const raw=(config.jawExtras||"").trim();
    if(!raw)return [];
    return raw.split(",").map(part=>part.trim()).map(part=>/^\d+$/.test(part)?Number(part):NaN);
  }
  function validate(config) {
    const error=[];
    if(!config.headEnabled && !config.jawEnabled && !config.eyesEnabled && !config.torsoEnabled && !config.armEnabled)
      error.push("Enable at least one movement or eye effect.");
    for(const [name,enabled,min,max,floor] of [
      ["Head",config.headEnabled,config.headMin,config.headMax,32],
      ["Torso",config.torsoEnabled,config.torsoMin,config.torsoMax,45],
      ["Arm",config.armEnabled,config.armMin,config.armMax,45],
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

    if(config.jawEnabled) {
      const pool=[config.jawFile,...extraFileNumbers(config)];
      if(pool.length>8 || pool.some(n=>!Number.isSafeInteger(n)||n<1||n>65535) ||
         new Set(pool).size!==pool.length)
        error.push("Jaw file pool must contain unique file serials 1–65535 (up to eight total), separated by commas.");
    }
    if(config.restEnabled) {
      for(const [label,min,max,floor,ceiling] of [
        ["Rest frequency",config.restMin,config.restMax,120,3600],
        ["Rest duration",config.restDurationMin,config.restDurationMax,15,300]
      ]) {
        if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<floor||max>ceiling||min>max)
          error.push(label+": whole numbers between "+floor+" and "+ceiling+" seconds, minimum ≤ maximum.");
      }
    }
    if (![0,1,2,3].includes(config.jawFollowupMotor))
      error.push("Choose a jaw-first response: OFF, Arm, Torso, or Alternate.");
    if (config.jawFollowupMotor === 3 &&
        (!config.armEnabled || !config.torsoEnabled))
      error.push("Enable both arm and torso for alternating jaw-first reactions.");
    if (config.jawFollowupMotor === 3 && !config.jawFollowupRecurring)
      error.push("Enable recurring mode to alternate arm and torso.");
    if (!Number.isSafeInteger(config.jawFollowupDelaySec) || config.jawFollowupDelaySec < 1 || config.jawFollowupDelaySec > 10)
      error.push("Jaw-first motor delay must be a whole number from 1 to 10 seconds.");
    if(config.jawFollowupMotor && !config.jawEnabled)
      error.push("Enable silent jaw playback before selecting a jaw-first motor reaction.");
    if(config.jawFollowupMotor===1 && !config.armEnabled)
      error.push("Enable the arm switch to test Arm after jaw.");
    if(config.jawFollowupMotor===2 && !config.torsoEnabled)
      error.push("Enable the torso switch to test Torso after jaw.");
    if (![0,1,2].includes(config.eyeJawMode))
      error.push("Choose a valid eye/jaw behavior (0, 1 or 2).");
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
      ["const bool HEAD_ENABLED = true;","const bool HEAD_ENABLED = "+Boolean(config.headEnabled)+";"],
      ["const bool TORSO_ENABLED = false;","const bool TORSO_ENABLED = "+Boolean(config.torsoEnabled)+";"],
      ["const bool ARM_ENABLED = false;","const bool ARM_ENABLED = "+Boolean(config.armEnabled)+";"],
      ["const bool ALLOW_BODY_MOTOR_OVERLAP = false;","const bool ALLOW_BODY_MOTOR_OVERLAP = "+Boolean(config.bodyOverlap)+";"],
      ["const bool JAW_PROTECTS_ARM_TORSO = true;","const bool JAW_PROTECTS_ARM_TORSO = "+Boolean(config.jawProtectBody)+";"],
      ["const uint8_t JAW_FOLLOWUP_MOTOR = 0;","const uint8_t JAW_FOLLOWUP_MOTOR = "+config.jawFollowupMotor+";"],
      ["const bool JAW_FOLLOWUP_RECURRING = false;","const bool JAW_FOLLOWUP_RECURRING = "+Boolean(config.jawFollowupRecurring)+";"],
      ["const uint32_t JAW_FOLLOWUP_DELAY_MS = 2000;","const uint32_t JAW_FOLLOWUP_DELAY_MS = "+(config.jawFollowupDelaySec*1000)+";"],
      ["const uint32_t TORSO_MIN_INTERVAL_MS = 240000;","const uint32_t TORSO_MIN_INTERVAL_MS = "+(config.torsoMin*1000)+";"],
      ["const uint32_t TORSO_MAX_INTERVAL_MS = 420000;","const uint32_t TORSO_MAX_INTERVAL_MS = "+(config.torsoMax*1000)+";"],
      ["const uint32_t ARM_MIN_INTERVAL_MS = 360000;","const uint32_t ARM_MIN_INTERVAL_MS = "+(config.armMin*1000)+";"],
      ["const uint32_t ARM_MAX_INTERVAL_MS = 720000;","const uint32_t ARM_MAX_INTERVAL_MS = "+(config.armMax*1000)+";"],
      ["const bool EYES_ENABLED = false;","const bool EYES_ENABLED = "+Boolean(config.eyesEnabled)+";"],
      ["const uint8_t EYE_JAW_MODE = 1;","const uint8_t EYE_JAW_MODE = "+config.eyeJawMode+";"],
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
      "const bool ALLOW_HEAD_JAW_OVERLAP = "+Boolean(config.overlap)+";"); 
    // NEW - rest scheduling defaults OFF, to avoid changing verified movement behavior.
    out=replaceOnce(out,"const bool ALLOW_HEAD_JAW_OVERLAP = "+Boolean(config.overlap)+";",
      "const bool ALLOW_HEAD_JAW_OVERLAP = "+Boolean(config.overlap)+";\n"+
      "const bool REST_ENABLED = "+Boolean(config.restEnabled)+";\n"+
      "const uint32_t REST_MIN_INTERVAL_MS = "+(config.restMin*1000)+";\n"+
      "const uint32_t REST_MAX_INTERVAL_MS = "+(config.restMax*1000)+";\n"+
      "const uint32_t REST_MIN_DURATION_MS = "+(config.restDurationMin*1000)+";\n"+
      "const uint32_t REST_MAX_DURATION_MS = "+(config.restDurationMax*1000)+";");
    out=replaceOnce(out,"uint32_t nextEyeAt = 0;",
      "uint32_t nextEyeAt = 0;\nuint32_t nextRestAt = 0;\nuint32_t restUntil = 0;");
    out=replaceOnce(out,
      "  nextEyeAt = now + random(EYE_MIN_INTERVAL_MS, EYE_MAX_INTERVAL_MS + 1);",
      "  nextEyeAt = now + random(EYE_MIN_INTERVAL_MS, EYE_MAX_INTERVAL_MS + 1);\n"+
      "  nextRestAt = now + random(REST_MIN_INTERVAL_MS, REST_MAX_INTERVAL_MS + 1);\n"+
      "  restUntil = now;");
    out=replaceOnce(out,
      "  bool sentHeadThisLoop = false;",
      "  if (REST_ENABLED && reached(now, nextRestAt) &&\n"+
      "      reached(now, bodySafeAfter) && reached(now, mouthPlayingUntil) &&\n"+
      "      reached(now, headSafeAfter) && reached(now, torsoSafeAfter) &&\n"+
      "      reached(now, armSafeAfter)) {\n"+
      "    uint32_t d = random(REST_MIN_DURATION_MS, REST_MAX_DURATION_MS + 1);\n"+
      "    restUntil = now + d;\n"+
      "    nextRestAt = restUntil + random(REST_MIN_INTERVAL_MS, REST_MAX_INTERVAL_MS + 1);\n"+
      "    Serial.printf(\"REST: new animations paused for %lu sec.\\n\", (unsigned long)(d / 1000));\n"+
      "  }\n"+
      "  if (REST_ENABLED && !reached(now, restUntil)) { delay(100); return; }\n"+
      "  bool sentHeadThisLoop = false;");
    // NEW - choose a random stored MP3 serial from the user-configured pool.
    const filePool=[config.jawFile,...extraFileNumbers(config)];
    if(filePool.length>1) {
      out=replaceOnce(out,"const bool MOUTH_ENABLED = "+Boolean(config.jawEnabled)+";",
        "const bool MOUTH_ENABLED = "+Boolean(config.jawEnabled)+";\n"+
        "const uint16_t JAW_FILE_POOL[] = {"+filePool.join(", ")+"};\n"+
        "const size_t JAW_POOL_COUNT = sizeof(JAW_FILE_POOL) / sizeof(JAW_FILE_POOL[0]);");
      out=replaceOnce(out,"void startMouth(uint32_t now) {",
        "void startMouth(uint32_t now) {\n"+
        "  const uint16_t chosenJawFile = JAW_FILE_POOL[random(0, (long)JAW_POOL_COUNT)];");
      out=replaceOnce(out,"    (uint8_t)(MOUTH_FILE_SERIAL >> 8),",
        "    (uint8_t)(chosenJawFile >> 8),");
      out=replaceOnce(out,"    (uint8_t)(MOUTH_FILE_SERIAL & 0xFF),",
        "    (uint8_t)(chosenJawFile & 0xFF),");
      out=replaceOnce(out,"                (unsigned)MOUTH_FILE_SERIAL,\n                (unsigned long)(jawInterval / 1000),",
        "                (unsigned)chosenJawFile,\n                (unsigned long)(jawInterval / 1000),");
    }
    // Head, torso and arm share the global body-motor scheduler. When
    // disabling jaw overlap, delay HEAD command at its selected dispatch point.
    out=replaceOnce(out,
      "    if (choice == 1) {",
      "    if (choice == 1 && (!ALLOW_HEAD_JAW_OVERLAP && mouthConfigured() && !reached(now, mouthPlayingUntil))) {\n"+
      "      // Wait until jaw clip ends rather than starting head movement.\n"+
      "    } else if (choice == 1) {");
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
      "// Torso="+config.torsoEnabled+" "+config.torsoMin+"–"+config.torsoMax+"s; arm="+config.armEnabled+" "+config.armMin+"–"+config.armMax+"s",
      "// Head/torso/arm overlap="+config.bodyOverlap+"; measured arm runtime 22 seconds.",
      "// Jaw body protection="+config.jawProtectBody+"; AAC6 may interrupt prior AACA.",
      "// Jaw-first motor="+config.jawFollowupMotor+" delay="+config.jawFollowupDelaySec+"s; recurring="+config.jawFollowupRecurring+".",
      "// Overlap="+config.overlap+"; eyes="+config.eyesEnabled+" "+config.eyesMin+"–"+config.eyesMax+"s",
      "// Random AAF9 eye selection verified; jaw-MP3 eye recovery modes need hardware testing.",
      "// Do not enable torso/arm movement in stored audio file metadata; use 0x00.",
      ""
    ].join("\n");
    return stamp+out;
  }
  function readConfig() {
    const n=id=>Number(byId(id).value);
    return {
      headEnabled:byId("headEnabled").checked,headMin:n("headMin"),headMax:n("headMax"),
      torsoEnabled:byId("torsoEnabled").checked,torsoMin:n("torsoMin"),torsoMax:n("torsoMax"),
      armEnabled:byId("armEnabled").checked,armMin:n("armMin"),armMax:n("armMax"),
      bodyOverlap:byId("bodyOverlap").checked,jawProtectBody:byId("jawProtectBody").checked,
      jawFollowupMotor:n("jawFollowupMotor"),jawFollowupDelaySec:n("jawFollowupDelaySec"),jawFollowupRecurring:byId("jawFollowupRecurring").checked,
      jawEnabled:byId("jawEnabled").checked,jawMin:n("jawMin"),jawMax:n("jawMax"),jawFile:n("jawFile"),jawExtras:byId("jawExtras").value,
      overlap:byId("overlap").checked,eyesEnabled:byId("eyesEnabled").checked,
      restEnabled:byId("restEnabled").checked,restMin:n("restMin"),restMax:n("restMax"),
      restDurationMin:n("restDurationMin"),restDurationMax:n("restDurationMax"),
      eyesMin:n("eyesMin"),eyesMax:n("eyesMax"),eyeJawMode:n("eyeJawMode"),
      bleName:byId("bleName").value,eyeChoices:Array.from(document.querySelectorAll(".eye-choice input:checked")).map(el=>Number(el.value))
    };
  }
  function writeConfig(cfg) {
    for(const id of ["headMin","headMax","torsoMin","torsoMax","armMin","armMax","jawMin","jawMax","jawFile","jawExtras","jawFollowupMotor","jawFollowupDelaySec","eyesMin","eyesMax","eyeJawMode","restMin","restMax","restDurationMin","restDurationMax","bleName"])
      if(cfg[id]!==undefined)byId(id).value=cfg[id];
    for(const id of ["headEnabled","torsoEnabled","armEnabled","jawEnabled","overlap","bodyOverlap","jawProtectBody","jawFollowupRecurring","eyesEnabled","restEnabled"])
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
    add("torso",c.torsoEnabled,c.torsoMin,c.torsoMax,25);
    add("arm",c.armEnabled,c.armMin,c.armMax,22);
    add("jaw",c.jawEnabled,c.jawMin,c.jawMax,21);
    add("eyes",c.eyesEnabled,c.eyesMin,c.eyesMax,0);
    events.sort((a,b)=>a.time-b.time);
    // Illustrative global motor serialization (real controller prioritizes
    // overdue movements; exact future times are inherently unpredictable).
    let bodyAvailableAt=0;
    for(const ev of events) {
      if(!c.bodyOverlap && ["head","torso","arm"].includes(ev.kind)){
        ev.time=Math.max(ev.time,bodyAvailableAt);
        const cooldown=ev.kind==="head"?32:ev.kind==="torso"?35:32;
        bodyAvailableAt=ev.time+cooldown;
      }
    }
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
    byId("torsoSummary").textContent=c.torsoEnabled?c.torsoMin+"–"+c.torsoMax+" sec":"Off";
    byId("armSummary").textContent=c.armEnabled?c.armMin+"–"+c.armMax+" sec":"Off";
    byId("bodyOverlapSummary").textContent=c.bodyOverlap?"Allowed · experimental":"Serialized · default";
    byId("jawProtectionSummary").textContent=c.jawEnabled?(c.jawProtectBody?"Protect arm / torso":"MP3 takes priority"):"Not needed";
    const motorLabel=["Off","Arm","Torso","Arm or torso"][c.jawFollowupMotor] || "Unknown";
    byId("jawFollowupSummary").textContent=c.jawFollowupMotor===0?"Off":motorLabel+" after "+c.jawFollowupDelaySec+"s · "+(c.jawFollowupRecurring?"Recurring":"One-shot");
    byId("jawSummary").textContent=c.jawEnabled?c.jawMin+"–"+c.jawMax+" sec · "+(extraFileNumbers(c).length+1)+" file(s)":"Off";
    const eyeLabel=["MP3 controls eyes","Restore chosen eye","New eye on jaw"][c.eyeJawMode] || "Custom";
    byId("eyeSummary").textContent=c.eyesEnabled?c.eyesMin+"–"+c.eyesMax+" sec · "+eyeLabel:"Off · optional";
    byId("restSummary").textContent=c.restEnabled?c.restDurationMin+"–"+c.restDurationMax+" sec":"Off";
    byId("overlapSummary").textContent=c.overlap?"Allowed":"Avoided";
    for(const id of ["headEnabled","torsoEnabled","armEnabled","jawEnabled"])document.querySelector('[data-for="'+id+'"]').classList.toggle("muted",!byId(id).checked);
    byId("eyeOptions").classList.toggle("muted",!c.eyesEnabled);
    byId("selectedEyeCount").textContent=c.eyeChoices.length+" of 18 selected";
    byId("restOptions").classList.toggle("muted",!c.restEnabled);
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
  // Thumbnails are loaded from the community Web Controller's original images,
  // not bundled or redistributed. The source includes exactly 18 eye icons.
  function eyeImageUrl(index) {
    return "https://raw.githubusercontent.com/martinecker/SkellyUltraWebController/main/images/skelly/eye_icon_"+index+".png";
  }
  function showEyePreview(index) {
    const image=byId("eyePreviewImage");
    image.src=eyeImageUrl(index);
    image.alt="Enlarged preview of Ultra Skelly eye pattern "+index;
    byId("eyePreviewLabel").textContent="Eye pattern #"+index;
  }
  function init(){
    const eyeGrid=byId("eyeGrid");
    for(let i=1;i<=18;i++){
      const card=document.createElement("div");
      card.className="eye-card";
      const label=document.createElement("label");
      label.className="eye-choice";
      label.title="Toggle eye pattern "+i+" for random rotation";
      const input=document.createElement("input");
      input.type="checkbox";input.value=i;input.checked=true;
      input.setAttribute("aria-label","Include eye pattern "+i);
      const content=document.createElement("span");
      content.className="eye-tile";
      const image=document.createElement("img");
      image.src=eyeImageUrl(i);
      image.alt="Eye pattern "+i;
      image.width=100;image.height=100;
      image.loading="lazy";image.decoding="async";
      const number=document.createElement("span");
      number.className="eye-tile-number";
      number.textContent="Eye "+String(i).padStart(2,"0");
      content.append(image,number);
      label.append(input,content);
      const zoom=document.createElement("button");
      zoom.type="button";zoom.className="eye-zoom";
      zoom.textContent="Preview";
      zoom.setAttribute("aria-label","Show larger preview of eye pattern "+i);
      zoom.addEventListener("click",()=>showEyePreview(i));
      card.append(label,zoom);
      eyeGrid.append(card);
    }
    showEyePreview(1);
    for(const el of document.querySelectorAll("input, select"))el.addEventListener("input",()=>{
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
