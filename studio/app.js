/* Skelly Studio — entirely client-side Arduino firmware configurator.
 * Works with the exact upstream-tested firmware copy in template.js.
 * Torso and arm are optional; shared motor cooldown prevents concurrent body commands.
 */
(function () {
  "use strict";
  const DEFAULTS = Object.freeze({
    deviceId:"ultra",
    headEnabled:true, headMin:35, headMax:75,
    torsoEnabled:false, torsoMin:240, torsoMax:420,
    armEnabled:true, armMin:150, armMax:240,
    bodyOverlap:false, jawProtectBody:true, jawFollowupMotor:0, jawFollowupDelaySec:2, jawFollowupRecurring:false,
    compoundEnabled:false,compoundAlongside:true,compoundMin:240,compoundMax:600,compoundMasks:[3,5,6,7],
    lightsEnabled:false,torsoColor:"#ff0000",headColor:"#ff6000",torsoBrightness:255,headBrightness:255,lightRestoreMode:1,
    jawEnabled:false, jawMin:45, jawMax:90, jawFile:12, jawExtras:"",
    overlap:true, eyesEnabled:false, eyesMin:120, eyesMax:300, eyeJawMode:1,
    restEnabled:false,restMin:180,restMax:420,restDurationMin:25,restDurationMax:60,
    diagnosticsEnabled:false,bleName:"Ultra Skelly v2", eyeChoices:[1],
    fairBodyTurns:false,playbackDiagnostics:false,jawClipSec:21,jawDurations:"",
    clockEnabled:false,clockStart:1080,clockEnd:1380,clockDays:127,
    scanRetrySec:30,startupRetrySec:5,startupWindowSec:60,
    palette0Name:"Halloween",palette0Torso:"#ff6000",palette0Head:"#00ff00",palette1Name:"Haunted",palette1Torso:"#8000ff",palette1Head:"#00e6cc",palette2Name:"Moonlight",palette2Torso:"#176bff",palette2Head:"#c8e8ff",palette3Name:"Ember",palette3Torso:"#ff1800",palette3Head:"#ffb000",
    lightRotation:false,lightInterval:90,lightPalettes:[0,1,2,3],torsoEffect:1,headEffect:1,torsoSpeed:125,headSpeed:125
  });
  const DEVICE_PROFILES=Object.freeze({
    ultra:{name:"6.5 ft Ultra Skelly v2 — Default / Tested",bleName:"Ultra Skelly v2",eyes:18,experimental:false},
    skelly12:{name:"12 ft App-Controlled Skelly (2026) — Experimental / Untested",bleName:"12ft Skelly",eyes:20,experimental:true}
  });
  const deviceFor=c=>DEVICE_PROFILES[c.deviceId??"ultra"];
  // Only deliberate model changes and presets adapt capabilities. Imports and
  // generation reject incompatible settings instead of silently rewriting them.
  function adaptDevice(config,deviceId=config.deviceId??"ultra") {
    const p=DEVICE_PROFILES[deviceId];if(!p)throw Error("Unknown Skelly device profile.");
    const c={...config,deviceId};
    if(p.experimental)Object.assign(c,{armEnabled:false,torsoEnabled:false,compoundEnabled:false,
      jawEnabled:false,eyeJawMode:1,jawFollowupMotor:0,jawFollowupRecurring:false,playbackDiagnostics:false,
      headMin:Math.max(90,c.headMin),headMax:Math.max(90,c.headMax)});
    c.eyeChoices=c.eyeChoices.filter(i=>i<=p.eyes);if(!c.eyeChoices.length)c.eyeChoices=[1];
    return c;
  }
  const PRESETS = {
    watchful:{eyeJawMode:1,headEnabled:true,headMin:120,headMax:240,jawEnabled:false,torsoEnabled:false,armEnabled:false,bodyOverlap:false,jawProtectBody:true,jawFollowupMotor:0,jawFollowupRecurring:false,compoundEnabled:false,lightsEnabled:false},
    storyteller:{eyeJawMode:1,headEnabled:true,headMin:120,headMax:240,jawEnabled:true,jawMin:90,jawMax:180,torsoEnabled:false,armEnabled:false,bodyOverlap:false,jawProtectBody:true,jawFollowupMotor:0,jawFollowupRecurring:false,compoundEnabled:false,lightsEnabled:false},
    subtle:{eyeJawMode:1,headEnabled:true,headMin:60,headMax:120,jawEnabled:false,jawMin:100,jawMax:180,torsoEnabled:false,armEnabled:false,bodyOverlap:false,overlap:false,jawProtectBody:true,jawFollowupMotor:0,jawFollowupRecurring:false,compoundEnabled:false,lightsEnabled:false},
    normal:{eyeJawMode:1,eyesEnabled:true,eyeChoices:[1],headEnabled:true,headMin:35,headMax:75,jawEnabled:false,jawMin:45,jawMax:90,torsoEnabled:false,armEnabled:true,armMin:150,armMax:240,bodyOverlap:false,overlap:true,jawProtectBody:true,jawFollowupMotor:0,jawFollowupRecurring:false,compoundEnabled:false,lightsEnabled:false},
    haunted:{eyeJawMode:1,eyesEnabled:true,eyeChoices:[1,2,3,4,5,6,7,8],eyesMin:150,eyesMax:300,headEnabled:true,headMin:32,headMax:45,jawEnabled:false,jawMin:30,jawMax:60,torsoEnabled:true,torsoMin:75,torsoMax:180,armEnabled:true,armMin:60,armMax:120,bodyOverlap:false,overlap:true,jawProtectBody:true,jawFollowupMotor:0,jawFollowupDelaySec:2,jawFollowupRecurring:false,compoundEnabled:true,compoundAlongside:true,compoundMin:240,compoundMax:600,compoundMasks:[3,5,6,7],lightsEnabled:false}
  };
  const byId = id => document.getElementById(id);
  const PALETTES=Object.freeze({
    halloween:{name:"Halloween",torsoColor:"#ff6000",headColor:"#00ff00"},
    haunted:{name:"Haunted",torsoColor:"#8000ff",headColor:"#00e6cc"},
    moonlight:{name:"Moonlight",torsoColor:"#176bff",headColor:"#c8e8ff"},
    ember:{name:"Ember",torsoColor:"#ff1800",headColor:"#ffb000"}
  });
  function paletteSettings(name) {
    if(!Object.hasOwn(PALETTES,name))throw new Error("Choose a known lighting palette.");
    const p=PALETTES[name];
    return {lightsEnabled:true,torsoColor:p.torsoColor,headColor:p.headColor};
  }
  const CLIP_FIELDS = {chatter:"clipChatter",longOpen:"clipLongOpen",gasp:"clipGasp"};
  function normalizeLibrary(library) {
    const result={};
    if(!library || typeof library!=="object" || Array.isArray(library))throw new Error("Invalid jaw clip library.");
    for(const key of Object.keys(CLIP_FIELDS)) {
      const value=library[key];
      if(value===undefined || value===null || value==="")result[key]=null;
      else if(Number.isSafeInteger(value) && value>=1 && value<=65535)result[key]=value;
      else throw new Error("Clip file numbers must be whole numbers from 1 to 65535.");
    }
    return result;
  }
  function jawSelection(choice, library) {
    const clips=normalizeLibrary(library);
    let files;
    if(choice==="mix") {
      files=Object.values(clips).filter(n=>n!==null);
      if(files.length<2)throw new Error("Add at least two clip file numbers to create a mix.");
      if(new Set(files).size!==files.length)throw new Error("Use a different file number for each clip in a mix.");
    } else {
      if(!Object.hasOwn(CLIP_FIELDS,choice) || clips[choice]===null)throw new Error("Enter this clip’s file number first.");
      files=[clips[choice]];
    }
    return {jawEnabled:true,jawFile:files[0],jawExtras:files.slice(1).join(", ")};
  }
  let audioReference=null;
  function normalizeAudioReference(ref){
    if(ref==null)return null;
    if(typeof ref!=='object'||Array.isArray(ref)||typeof ref.name!=='string'||!ref.name||ref.name.length>128||/[\x00-\x1f\x7f]/.test(ref.name)||typeof ref.device!=='string'||!ref.device.trim()||ref.device.length>48||/[\x00-\x1f\x7f]/.test(ref.device)||!Number.isInteger(ref.serial)||ref.serial<1||ref.serial>65535||!Number.isInteger(ref.cluster)||ref.cluster<0||ref.cluster>0xffffffff)throw Error('Invalid audio file label.');
    return {name:ref.name,device:ref.device.trim(),serial:ref.serial,cluster:ref.cluster};
  }
  function referenceMatches(c,ref){return c.jawEnabled&&c.eyeJawMode===3&&ref?.serial===c.jawFile&&ref.device===c.bleName.trim();}
  function readAudioReference(c=readConfig()){return referenceMatches(c,audioReference)?{...audioReference}:null;}
  function writeAudioReference(ref){audioReference=normalizeAudioReference(ref);}
  function parseProfile(text) {
    if(typeof text!=="string" || text.length>65536)throw new Error("Choose a Studio settings file smaller than 64 KB.");
    const profile=JSON.parse(text);
    if(!profile || profile.app!=="SkellyStudio" || ![1,2,3,4,5].includes(profile.version) ||
       !profile.config || typeof profile.config!=="object" || Array.isArray(profile.config))
      throw new Error("This is not a supported Skelly Studio profile (version 1–5).");
    if(profile.version===5&&profile.config.deviceId!=='skelly12')throw Error('Experimental profiles require an explicit 12-foot device identifier.');
    const config={};
    for(const [key,value] of Object.entries(DEFAULTS)) {
      const added=["fairBodyTurns","playbackDiagnostics","jawClipSec","jawDurations","clockEnabled","clockStart","clockEnd","clockDays"];
      const lighting=["lightRotation","lightInterval","lightPalettes","torsoEffect","headEffect","torsoSpeed","headSpeed"];
      const refresh=key.startsWith("palette")||["scanRetrySec","startupRetrySec","startupWindowSec","compoundAlongside"].includes(key);
      const migrated=(profile.version<4&&refresh)||(profile.version===1&&added.includes(key))||(profile.version<3&&lighting.includes(key));
      const entry=key==="deviceId"&&profile.config[key]===undefined?"ultra":migrated&&profile.config[key]===undefined?(key==="compoundAlongside"?false:value):profile.config[key];
      if(Array.isArray(value)) {
        if(!Array.isArray(entry) || entry.some(n=>!Number.isSafeInteger(n)))throw new Error("Invalid profile setting: "+key);
        config[key]=entry.slice();
      } else {
        if(typeof entry!==typeof value || (typeof entry==="number" && !Number.isSafeInteger(entry)))
          throw new Error("Invalid profile setting: "+key);
        config[key]=entry;
      }
    }
    config.bodyOverlap=false; // Separate writes interrupt physical animations.
    // Validate dormant settings too: they will still be emitted into C++ constants.
    const errors=validate(config);
    errors.push(...validate({...config,deviceId:"ultra",bleName:"Ultra Skelly v2",eyeChoices:[1],headEnabled:true,torsoEnabled:true,armEnabled:true,
      jawEnabled:true,eyesEnabled:true,lightsEnabled:true,restEnabled:true,
      compoundEnabled:false,jawFollowupMotor:0}));
    if(config.compoundMin<45 || config.compoundMax>3600 || config.compoundMin>config.compoundMax ||
       config.compoundMasks.some(n=>![3,5,6,7].includes(n)) || new Set(config.compoundMasks).size!==config.compoundMasks.length)
      errors.push("Invalid combined movement settings.");
    if(errors.length)throw new Error([...new Set(errors)].join("\n"));
    const audio=normalizeAudioReference(profile.audio);
    if(audio&&!referenceMatches(config,audio))throw Error('Audio file label does not match this routine. Reselect the file on Skelly.');
    return {app:"SkellyStudio",version:config.deviceId==='skelly12'?5:4,config,clips:normalizeLibrary(profile.clips||{}),...(audio?{audio}:{})};
  }
  function createProfile(config,clips,reference=audioReference) {
    const audio=referenceMatches(config,reference)?normalizeAudioReference(reference):null;
    const profile=parseProfile(JSON.stringify({app:"SkellyStudio",version:4,config,clips,...(audio?{audio}:{})}));
    if(profile.config.deviceId==='ultra')delete profile.config.deviceId;
    return JSON.stringify(profile,null,2)+"\n";
  }
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
  function durationEntries(config) {
    const raw=config.jawDurations.trim();
    if(!raw)return [];
    const files=[config.jawFile,...extraFileNumbers(config)],seen=new Set();
    if(raw.length>256)throw new Error("Clip duration list is too long.");
    return raw.split(",").map(item=>{
      const match=/^\s*(\d+)\s*:\s*(\d+)\s*$/.exec(item);
      const file=match?Number(match[1]):NaN,seconds=match?Number(match[2]):NaN;
      if(!files.includes(file)||seen.has(file)||seconds<21||seconds>120||!Number.isSafeInteger(seconds))
        throw new Error("Clip estimates use selected-file:seconds, 21–120 seconds, with no duplicates.");
      seen.add(file);return [file,seconds];
    });
  }
  function validate(config) {
    const error=[];
    if(!config || typeof config!=="object" || Array.isArray(config))return ["Choose valid Studio settings."];
    // Disabled controls are still emitted as C++ constants. Check their types
    // and bounds too, so disabling a feature cannot bypass sketch validation.
    for(const [key,value] of Object.entries(DEFAULTS)) {
      const entry=config[key];
      if(key==='deviceId'&&entry===undefined)continue;
      if(Array.isArray(value)?!Array.isArray(entry):typeof entry!==typeof value)
        error.push("Invalid setting type: "+key+".");
    }
    if(error.length)return error;
    const device=deviceFor(config);
    if(!device)return ["Unknown Skelly device profile."];
    if(Object.values(DEVICE_PROFILES).some(p=>p!==device&&p.bleName===config.bleName.trim()))
      error.push("The Bluetooth name belongs to the other device model. Choose the matching Skelly profile.");
    if(device.experimental) {
      if(config.armEnabled||config.torsoEnabled||config.compoundEnabled||config.jawEnabled||config.eyeJawMode===3||config.jawFollowupMotor||config.jawFollowupRecurring||config.playbackDiagnostics)
        error.push("Experimental 12-foot support disables arm, torso, compound, audio/jaw and playback observations.");
      if(config.headMin<90)error.push("Experimental head intervals must be at least 90 seconds (unmeasured 60-second animation estimate + 30-second buffer).");
    }
    for(const [key,min,max] of [["scanRetrySec",5,300],["startupRetrySec",5,300],["startupWindowSec",0,300]])
      if(!Number.isSafeInteger(config[key])||config[key]<min||config[key]>max)error.push("Invalid Bluetooth retry timing: "+key);
    for(let i=0;i<4;i++) {
      if(!config["palette"+i+"Name"].trim()||config["palette"+i+"Name"].length>24||/[\x00-\x1f]/.test(config["palette"+i+"Name"]))error.push("Palette names need 1–24 characters.");
      for(const part of ["Torso","Head"])if(!/^#[0-9a-f]{6}$/i.test(config["palette"+i+part]))error.push("Choose valid palette colors.");
    }
    if(!Number.isSafeInteger(config.lightInterval)||config.lightInterval<15||config.lightInterval>3600)error.push("Palette interval must be 15–3600 seconds.");
    if(config.lightPalettes.some(n=>!Number.isSafeInteger(n)||n<0||n>3)||new Set(config.lightPalettes).size!==config.lightPalettes.length||
       (config.lightRotation&&config.lightPalettes.length<2))error.push("Rotation needs at least two distinct lighting palettes.");
    if(![config.torsoEffect,config.headEffect].every(n=>[1,2,3].includes(n)))error.push("Choose Static, Strobe or Pulsing.");
    if(![config.torsoSpeed,config.headSpeed].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=254))error.push("Effect speed must be 0–254.");
    if(!Number.isSafeInteger(config.jawClipSec)||config.jawClipSec<21||config.jawClipSec>120)
      error.push("Jaw clip estimate must be 21–120 seconds, including padding. Never shorten protection below 21 seconds.");
    if(!Number.isSafeInteger(config.clockStart)||!Number.isSafeInteger(config.clockEnd)||
       config.clockStart<0||config.clockStart>=1440||config.clockEnd<0||config.clockEnd>=1440||config.clockStart===config.clockEnd||
       !Number.isSafeInteger(config.clockDays)||config.clockDays<1||config.clockDays>127)
      error.push("Choose different clock start/end minutes (0–1439) and a weekday mask from 1 to 127.");
    try { durationEntries(config); } catch(e) { error.push(e.message); }
    if(!config.headEnabled && !config.jawEnabled && !config.eyesEnabled && !config.torsoEnabled && !config.armEnabled && !config.lightsEnabled)
      error.push("Enable at least one movement or eye effect.");
    for(const [name,min,max,floor] of [
      ["Head",config.headMin,config.headMax,32],
      ["Torso",config.torsoMin,config.torsoMax,45],
      ["Arm",config.armMin,config.armMax,45],
      ["Jaw",config.jawMin,config.jawMax,22],
      ["Eyes",config.eyesMin,config.eyesMax,15]
    ]) {
      if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<floor||max>3600||min>max)
        error.push(name+": choose whole-number intervals from "+floor+" to 3600 seconds, minimum ≤ maximum.");
    }
    if(!Number.isSafeInteger(config.jawFile)||config.jawFile<1||config.jawFile>65535)
      error.push("Enter the MP3 serial shown in your own web-controller log (1–65535).");
    if(typeof config.bleName!=="string"||!config.bleName.trim()||config.bleName.length>48||/[\x00-\x1F]/.test(config.bleName))
      error.push("Enter a valid advertised Bluetooth device name (1–48 characters).");

    {
      const pool=[config.jawFile,...extraFileNumbers(config)];
      if(pool.length>8 || pool.some(n=>!Number.isSafeInteger(n)||n<1||n>65535) ||
         new Set(pool).size!==pool.length)
        error.push("Jaw file pool must contain unique file serials 1–65535 (up to eight total), separated by commas.");
    }
    {
      for(const [label,min,max,floor,ceiling] of [
        ["Rest frequency",config.restMin,config.restMax,120,3600],
        ["Rest duration",config.restDurationMin,config.restDurationMax,15,300]
      ]) {
        if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||min<floor||max>ceiling||min>max)
          error.push(label+": whole numbers between "+floor+" and "+ceiling+" seconds, minimum ≤ maximum.");
      }
    }
    if(!Number.isSafeInteger(config.compoundMin) || !Number.isSafeInteger(config.compoundMax) ||
       config.compoundMin<45 || config.compoundMax>3600 || config.compoundMin>config.compoundMax)
      error.push("Combined movement frequency must be 45–3600 seconds.");
    if(config.compoundMasks.some(m=>![3,5,6,7].includes(m)) ||
       new Set(config.compoundMasks).size!==config.compoundMasks.length)
      error.push("Combined masks must be unique values from 3, 5, 6, 7.");
    if (config.compoundEnabled) {
      if(config.jawFollowupMotor!==0) error.push("Compound body mode and jaw-first reactions are separate modes; turn one OFF.");
      if(config.jawEnabled && !config.jawProtectBody) error.push("Compound body movements require MP3 body protection when jaw playback is enabled.");
      const enabled=(config.headEnabled?1:0)|(config.armEnabled?2:0)|(config.torsoEnabled?4:0);
      if(!Array.isArray(config.compoundMasks) || !config.compoundMasks.length ||
         config.compoundMasks.some(m=>![3,5,6,7].includes(m) || (m&~enabled)!==0) ||
         new Set(config.compoundMasks).size!==config.compoundMasks.length)
        error.push("Select at least one combined mask using only enabled head, arm, and torso motors.");
    }
    {
      if(!/^#[0-9a-f]{6}$/i.test(config.torsoColor||"") ||
         !/^#[0-9a-f]{6}$/i.test(config.headColor||""))
        error.push("Lighting colors must be six-digit hexadecimal colors.");
      if(![config.torsoBrightness,config.headBrightness].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=255))
        error.push("Lighting brightness must be 0–255.");
      if(![0,1,2].includes(config.lightRestoreMode))
        error.push("Choose a valid MP3 lighting restore behavior.");
    }
    if (![0,1,2,3,4].includes(config.jawFollowupMotor))
      error.push("Choose a jaw-first response: OFF, Arm, Torso, Alternate, or Head.");
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
    if(config.jawFollowupMotor===4 && !config.headEnabled)
      error.push("Enable the head switch to test Head after jaw.");
    if (![0,1,2,3].includes(config.eyeJawMode))
      error.push("Choose a valid eye/jaw behavior (0, 1, 2 or 3).");
    if((config.eyesEnabled && !config.eyeChoices.length) || config.eyeChoices.some(n=>!Number.isSafeInteger(n)||n<1||n>device.eyes) || new Set(config.eyeChoices).size!==config.eyeChoices.length)
      error.push("Select at least one valid eye design number between 1 and "+device.eyes+".");
    if(config.eyeJawMode===3 && (!config.jawProtectBody || config.overlap || config.jawFollowupMotor || (config.lightsEnabled&&config.lightRestoreMode!==1)))
      error.push("Audio scenes need full body protection, no jaw-first/overlap and restore lighting after playback.");
    return error;
  }
  function generateSketch(config) {
    const errors=validate(config);
    if(errors.length)throw new Error(errors.join("\n"));
    let out=window.SKELLY_FIRMWARE_TEMPLATE;
    if(typeof out!=="string" || out.length<5000)throw new Error("The tested firmware template did not load. Refresh this page.");
    // These substitutions fail closed rather than emitting a partial or invalid sketch.
    const assignments=[
      ["#define SKELLY_DEVICE_12FT 0","#define SKELLY_DEVICE_12FT "+Number(deviceFor(config).experimental)],
      ["const bool LIGHT_ROTATION_ENABLED = false;","const bool LIGHT_ROTATION_ENABLED = "+config.lightRotation+";"],
      ["const uint32_t LIGHT_ROTATION_INTERVAL_MS = 90000;","const uint32_t LIGHT_ROTATION_INTERVAL_MS = "+config.lightInterval*1000+";"],
      ["const uint8_t LIGHT_PALETTE_MASK = 15;","const uint8_t LIGHT_PALETTE_MASK = "+(config.lightPalettes.reduce((m,n)=>m|(1<<n),0)||1)+";"],
      ["const uint8_t TORSO_LIGHT_MODE = 1;","const uint8_t TORSO_LIGHT_MODE = "+config.torsoEffect+";"],
      ["const uint8_t HEAD_LIGHT_MODE = 1;","const uint8_t HEAD_LIGHT_MODE = "+config.headEffect+";"],
      ["const uint8_t TORSO_LIGHT_SPEED = 190;","const uint8_t TORSO_LIGHT_SPEED = "+(254-config.torsoSpeed)+";"],
      ["const uint8_t HEAD_LIGHT_SPEED = 190;","const uint8_t HEAD_LIGHT_SPEED = "+(254-config.headSpeed)+";"],
      ["const bool FAIR_BODY_TURNS = false;","const bool FAIR_BODY_TURNS = "+config.fairBodyTurns+";"],
      ["const bool PLAYBACK_DIAGNOSTICS = false;","const bool PLAYBACK_DIAGNOSTICS = "+config.playbackDiagnostics+";"],
      ["const bool CLOCK_WINDOW_ENABLED = false;","const bool CLOCK_WINDOW_ENABLED = "+config.clockEnabled+";"],
      ["const uint16_t CLOCK_START_MINUTE = 1080;","const uint16_t CLOCK_START_MINUTE = "+config.clockStart+";"],
      ["const uint16_t CLOCK_END_MINUTE = 1380;","const uint16_t CLOCK_END_MINUTE = "+config.clockEnd+";"],
      ["const uint8_t CLOCK_DAYS = 127;","const uint8_t CLOCK_DAYS = "+config.clockDays+";"],
      ["const uint32_t MOUTH_CLIP_MS = 21000;","const uint32_t MOUTH_CLIP_MS = "+config.jawClipSec*1000+";"],
      ["const uint16_t MOUTH_FILE_SERIAL = 12;","const uint16_t MOUTH_FILE_SERIAL = "+config.jawFile+";"],
      ["const bool MOUTH_ENABLED = true;","const bool MOUTH_ENABLED = "+Boolean(config.jawEnabled)+";"],
      ["const bool HEAD_ENABLED = true;","const bool HEAD_ENABLED = "+Boolean(config.headEnabled)+";"],
      ["const bool TORSO_ENABLED = false;","const bool TORSO_ENABLED = "+Boolean(config.torsoEnabled)+";"],
      ["const bool ARM_ENABLED = false;","const bool ARM_ENABLED = "+Boolean(config.armEnabled)+";"],
      ["const bool ALLOW_BODY_MOTOR_OVERLAP = false;","const bool ALLOW_BODY_MOTOR_OVERLAP = "+false+";"],
      ["const bool COMPOUND_ALONGSIDE = false;","const bool COMPOUND_ALONGSIDE = "+Boolean(config.compoundAlongside)+";"],
      ["const uint32_t SCAN_RETRY_MS = 30000;","const uint32_t SCAN_RETRY_MS = "+config.scanRetrySec*1000+";"],
      ["const uint32_t STARTUP_SCAN_RETRY_MS = 5000;","const uint32_t STARTUP_SCAN_RETRY_MS = "+config.startupRetrySec*1000+";"],
      ["const uint32_t STARTUP_SCAN_WINDOW_MS = 60000;","const uint32_t STARTUP_SCAN_WINDOW_MS = "+config.startupWindowSec*1000+";"],
      ["const uint8_t LIGHT_PALETTES[4][6] = {\n  {255,96,0,0,255,0}, {128,0,255,0,230,204},\n  {23,107,255,200,232,255}, {255,24,0,255,176,0}\n};",
       "const uint8_t LIGHT_PALETTES[4][6] = {"+Array.from({length:4},(_,i)=>"{"+["Torso","Head"].flatMap(part=>[1,3,5].map(at=>parseInt(config["palette"+i+part].slice(at,at+2),16))).join(",")+"}").join(",")+"};"],
      ["const bool COMPOUND_BODY_ENABLED = false;","const bool COMPOUND_BODY_ENABLED = "+Boolean(config.compoundEnabled)+";"],
      ["const uint8_t COMPOUND_BODY_MASKS[] = {0x03, 0x05, 0x06, 0x07};",
       "const uint8_t COMPOUND_BODY_MASKS[] = {"+(config.compoundMasks.length?config.compoundMasks:[3]).map(x=>"0x"+x.toString(16).padStart(2,"0")).join(", ")+"};"],
      ["const uint32_t COMPOUND_BODY_MIN_INTERVAL_MS = 180000;","const uint32_t COMPOUND_BODY_MIN_INTERVAL_MS = "+config.compoundMin*1000+";"],
      ["const uint32_t COMPOUND_BODY_MAX_INTERVAL_MS = 360000;","const uint32_t COMPOUND_BODY_MAX_INTERVAL_MS = "+config.compoundMax*1000+";"],
      ["const bool LIGHTS_ENABLED = false;","const bool LIGHTS_ENABLED = "+Boolean(config.lightsEnabled)+";"],
      ["const uint8_t TORSO_LIGHT_R = 255, TORSO_LIGHT_G = 0, TORSO_LIGHT_B = 0;",
       "const uint8_t TORSO_LIGHT_R = "+parseInt(config.torsoColor.slice(1,3),16)+", TORSO_LIGHT_G = "+parseInt(config.torsoColor.slice(3,5),16)+", TORSO_LIGHT_B = "+parseInt(config.torsoColor.slice(5,7),16)+";"],
      ["const uint8_t HEAD_LIGHT_R = 255, HEAD_LIGHT_G = 96, HEAD_LIGHT_B = 0;",
       "const uint8_t HEAD_LIGHT_R = "+parseInt(config.headColor.slice(1,3),16)+", HEAD_LIGHT_G = "+parseInt(config.headColor.slice(3,5),16)+", HEAD_LIGHT_B = "+parseInt(config.headColor.slice(5,7),16)+";"],
      ["const uint8_t TORSO_LIGHT_BRIGHTNESS = 180;","const uint8_t TORSO_LIGHT_BRIGHTNESS = "+config.torsoBrightness+";"],
      ["const uint8_t HEAD_LIGHT_BRIGHTNESS = 180;","const uint8_t HEAD_LIGHT_BRIGHTNESS = "+config.headBrightness+";"],
      ["const uint8_t LIGHT_RESTORE_MODE = 1;","const uint8_t LIGHT_RESTORE_MODE = "+config.lightRestoreMode+";"],
      ["const bool DIAGNOSTICS_ENABLED = false;","const bool DIAGNOSTICS_ENABLED = "+Boolean(config.diagnosticsEnabled)+";"],
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
    const durations=durationEntries(config);
    if(durations.length)out=replaceOnce(out,
      "uint32_t jawDurationMs(uint16_t file) { (void)file; return MOUTH_CLIP_MS; }",
      "uint32_t jawDurationMs(uint16_t file) {\n  switch(file) {\n"+
      durations.map(([file,seconds])=>"    case "+file+": return "+seconds*1000+";").join("\n")+
      "\n    default: return MOUTH_CLIP_MS;\n  }\n}");
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
    out=replaceOnce(out,"bool diagnosticResting(uint32_t now) { (void)now; return false; }",
      "bool diagnosticResting(uint32_t now) { return REST_ENABLED && !reached(now,restUntil); }");
    out=replaceOnce(out,"uint32_t nextEyeAt = 0;",
      "uint32_t nextEyeAt = 0;\nuint32_t nextRestAt = 0;\nuint32_t restUntil = 0;");
    out=replaceOnce(out,
      "  nextEyeAt = now + random(EYE_MIN_INTERVAL_MS, EYE_MAX_INTERVAL_MS + 1);",
      "  nextEyeAt = now + random(EYE_MIN_INTERVAL_MS, EYE_MAX_INTERVAL_MS + 1);\n"+
      "  nextRestAt = now + random(REST_MIN_INTERVAL_MS, REST_MAX_INTERVAL_MS + 1);\n"+
      "  restUntil = now;");
    if(config.clockEnabled && config.restEnabled)out=replaceOnce(out,
      "  nextEyeAt = at + random(EYE_MIN_INTERVAL_MS, EYE_MAX_INTERVAL_MS + 1);",
      "  nextEyeAt = at + random(EYE_MIN_INTERVAL_MS, EYE_MAX_INTERVAL_MS + 1);\n"+
      "  nextRestAt = at + random(REST_MIN_INTERVAL_MS, REST_MAX_INTERVAL_MS + 1);\n"+
      "  restUntil = at; // A newly opened window never inherits an old idle pause.");
    out=replaceOnce(out,
      "  bool sentHeadThisLoop = false;",
      "  if (REST_ENABLED && reached(now, nextRestAt) &&\n"+
      "      reached(now, bodySafeAfter) && reached(now, mouthPlayingUntil) &&\n"+
      "      reached(now, headSafeAfter) && reached(now, torsoSafeAfter) &&\n"+
      "      reached(now, armSafeAfter)) {\n"+
      "    uint32_t d = random(REST_MIN_DURATION_MS, REST_MAX_DURATION_MS + 1);\n"+
      "    restUntil = now + d;\n"+
      "    nextRestAt = restUntil + random(REST_MIN_INTERVAL_MS, REST_MAX_INTERVAL_MS + 1);\n"+
      "    logEvent(\"REST: new animations paused for %lu sec.\\n\", (unsigned long)(d / 1000));\n"+
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
      out=replaceOnce(out,"  const uint32_t clipDuration = jawDurationMs(MOUTH_FILE_SERIAL);",
        "  const uint32_t clipDuration = jawDurationMs(chosenJawFile);");
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
      "  if (mouthConfigured() && reached(millis(), nextMouthAt) &&\n      reached(millis(), mouthSafeAfter) &&\n      !(LIGHTS_ENABLED && (lightApplyPending || lightRestorePending))) {",
      "  if (mouthConfigured() && reached(millis(), nextMouthAt) &&\n"+
      "      reached(millis(), mouthSafeAfter) &&\n"+
      "      !(LIGHTS_ENABLED && (lightApplyPending || lightRestorePending)) &&\n"+
      "      (ALLOW_HEAD_JAW_OVERLAP || !HEAD_ENABLED || reached(millis(), headMovingUntil))) {");
    const eyes=(config.eyeChoices.length?config.eyeChoices:DEFAULTS.eyeChoices).slice().sort((a,b)=>a-b);
    out=replaceOnce(out,"const bool EYE_ROTATION_ENABLED = true;","const bool EYE_ROTATION_ENABLED = "+(eyes.length>1)+";");
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
      "// Head/torso/arm overlap="+false+"; measured arm runtime 22 seconds.",
      "// Jaw body protection="+config.jawProtectBody+"; AAC6 may interrupt prior AACA.",
      "// Jaw-first motor="+config.jawFollowupMotor+" delay="+config.jawFollowupDelaySec+"s; recurring="+config.jawFollowupRecurring+".",
      "// Compound body="+config.compoundEnabled+" masks="+config.compoundMasks.join(",")+" interval="+config.compoundMin+"-"+config.compoundMax+"s.",
      "// Live RGB channels (0=torso, 1=head)="+config.lightsEnabled+"; restore="+config.lightRestoreMode+"; mode 1 verified in isolated test; mode 2 untested.",
      "// Verbose diagnostics="+Boolean(config.diagnosticsEnabled)+"; clip end is modeled, not notified by Skelly.",
      "// Overlap="+config.overlap+"; eyes="+config.eyesEnabled+" "+config.eyesMin+"–"+config.eyesMax+"s",
      "// Random AAF9 eye selection verified; jaw-MP3 eye recovery modes need hardware testing.",
      "// Do not enable torso/arm movement in stored audio file metadata; use 0x00.",
      ""
    ].join("\n");
    return (deviceFor(config).experimental ? "// 2026 12-foot Skelly: Experimental — Not Hardware Tested.\n// Only head, eyes and chest channel 0 enabled; no Ultra hardware evidence applies.\n" : stamp)+out;
  }
  function readConfig() {
    const n=id=>Number(byId(id).value);
    return {
      deviceId:byId("deviceId")?.value??"ultra",
      headEnabled:byId("headEnabled").checked,headMin:n("headMin"),headMax:n("headMax"),
      torsoEnabled:byId("torsoEnabled").checked,torsoMin:n("torsoMin"),torsoMax:n("torsoMax"),
      armEnabled:byId("armEnabled").checked,armMin:n("armMin"),armMax:n("armMax"),
      bodyOverlap:false,jawProtectBody:byId("jawProtectBody").checked,
      compoundEnabled:byId("compoundEnabled").checked,compoundAlongside:byId("compoundAlongside").checked,
      scanRetrySec:n("scanRetrySec"),startupRetrySec:n("startupRetrySec"),startupWindowSec:n("startupWindowSec"),
      ...Object.fromEntries(Array.from({length:4},(_,i)=>["Name","Torso","Head"].map(part=>{const key="palette"+i+part;return [key,byId(key).value]})).flat()),compoundMin:n("compoundMin"),compoundMax:n("compoundMax"),
      compoundMasks:Array.from(document.querySelectorAll(".compound-choice:checked")).map(el=>Number(el.value)),
      lightRotation:byId("lightRotation").checked,lightInterval:n("lightInterval"),
      lightPalettes:Array.from(document.querySelectorAll(".light-palette-choice:checked")).map(el=>Number(el.value)),
      torsoEffect:n("torsoEffect"),headEffect:n("headEffect"),torsoSpeed:n("torsoSpeed"),headSpeed:n("headSpeed"),
      lightsEnabled:byId("lightsEnabled").checked,torsoColor:byId("torsoColor").value,headColor:byId("headColor").value,
      torsoBrightness:n("torsoBrightness"),headBrightness:n("headBrightness"),lightRestoreMode:n("lightRestoreMode"),
      jawFollowupMotor:n("jawFollowupMotor"),jawFollowupDelaySec:n("jawFollowupDelaySec"),jawFollowupRecurring:byId("jawFollowupRecurring").checked,
      jawEnabled:byId("jawEnabled").checked,jawMin:n("jawMin"),jawMax:n("jawMax"),jawFile:n("jawFile"),jawExtras:byId("jawExtras").value,
      overlap:byId("overlap").checked,eyesEnabled:byId("eyesEnabled").checked,
      restEnabled:byId("restEnabled").checked,restMin:n("restMin"),restMax:n("restMax"),
      restDurationMin:n("restDurationMin"),restDurationMax:n("restDurationMax"),
      eyesMin:n("eyesMin"),eyesMax:n("eyesMax"),eyeJawMode:n("eyeJawMode"),
      diagnosticsEnabled:byId("diagnosticsEnabled").checked,
      fairBodyTurns:byId("fairBodyTurns").checked,playbackDiagnostics:byId("playbackDiagnostics").checked,
      jawClipSec:n("jawClipSec"),jawDurations:byId("jawDurations").value,
      clockEnabled:byId("clockEnabled").checked,
      clockStart:byId("clockStart").value.split(":").reduce((h,m)=>Number(h)*60+Number(m)),
      clockEnd:byId("clockEnd").value.split(":").reduce((h,m)=>Number(h)*60+Number(m)),
      clockDays:Array.from(document.querySelectorAll(".clock-day:checked")).reduce((mask,el)=>mask|Number(el.value),0),
      bleName:byId("bleName").value,eyeChoices:Array.from(document.querySelectorAll(".eye-choice input:checked")).map(el=>Number(el.value))
    };
  }
  function writeConfig(cfg) {
    if(cfg.deviceId!==undefined&&byId("deviceId")){
      if(byId('deviceId').value!==cfg.deviceId){
        byId('deviceChangeNotice').hidden=false;
        byId('deviceChangeNotice').textContent='Warning: loaded settings change the device model to '+DEVICE_PROFILES[cfg.deviceId].name+'. Check the selected prop before installing or saving settings.';
      }
      byId("deviceId").value=cfg.deviceId;
    }
    for(const key of ["scanRetrySec","startupRetrySec","startupWindowSec",...Array.from({length:4},(_,i)=>["Name","Torso","Head"].map(p=>"palette"+i+p)).flat()])if(cfg[key]!==undefined)byId(key).value=cfg[key];
    if(cfg.compoundAlongside!==undefined)byId("compoundAlongside").checked=cfg.compoundAlongside;
    for(const key of ["lightInterval","torsoEffect","headEffect","torsoSpeed","headSpeed"])if(cfg[key]!==undefined)byId(key).value=cfg[key];
    if(cfg.lightRotation!==undefined)byId("lightRotation").checked=cfg.lightRotation;
    if(cfg.lightPalettes)document.querySelectorAll(".light-palette-choice").forEach(el=>el.checked=cfg.lightPalettes.includes(Number(el.value)));
    if(cfg.jawEnabled===true){byId(cfg.eyeJawMode===3?"audioScenes":"mouth").open=true;if(cfg.eyeJawMode===3){byId("mouth").open=false;byId("advanced").open=true;}}
    for(const key of ["fairBodyTurns","playbackDiagnostics","clockEnabled"])if(cfg[key]!==undefined)byId(key).checked=cfg[key];
    for(const key of ["jawClipSec","jawDurations"])if(cfg[key]!==undefined)byId(key).value=cfg[key];
    for(const key of ["clockStart","clockEnd"])if(cfg[key]!==undefined)byId(key).value=String(Math.floor(cfg[key]/60)).padStart(2,"0")+":"+String(cfg[key]%60).padStart(2,"0");
    if(cfg.clockDays!==undefined)document.querySelectorAll(".clock-day").forEach(el=>el.checked=Boolean(cfg.clockDays&Number(el.value)));
    for(const id of ["headMin","headMax","torsoMin","torsoMax","armMin","armMax","jawMin","jawMax","jawFile","jawExtras","jawFollowupMotor","jawFollowupDelaySec","compoundMin","compoundMax","torsoColor","headColor","torsoBrightness","headBrightness","lightRestoreMode","eyesMin","eyesMax","eyeJawMode","restMin","restMax","restDurationMin","restDurationMax","bleName"])
      if(cfg[id]!==undefined)byId(id).value=cfg[id];
    for(const id of ["headEnabled","torsoEnabled","armEnabled","jawEnabled","overlap","jawProtectBody","jawFollowupRecurring","compoundEnabled","lightsEnabled","eyesEnabled","restEnabled","diagnosticsEnabled"])
      if(cfg[id]!==undefined)byId(id).checked=cfg[id];
    if(cfg.compoundMasks)document.querySelectorAll(".compound-choice").forEach(el=>el.checked=cfg.compoundMasks.includes(Number(el.value)));
    if(cfg.eyeChoices){document.querySelectorAll(".eye-choice input").forEach(el=>el.checked=cfg.eyeChoices.includes(Number(el.value)));byId('eyeBehavior').value=cfg.eyeChoices.length>1?'random':'fixed';showEyePreview(cfg.eyeChoices[0]||1);}
    if(cfg.torsoColor!==undefined||cfg.headColor!==undefined)byId('linkLightColors').checked=byId('torsoColor').value===byId('headColor').value;
    for(let i=0;i<4;i++)if(cfg['palette'+i+'Torso']!==undefined||cfg['palette'+i+'Head']!==undefined)document.querySelector('[data-palette-link="'+i+'"]').checked=byId('palette'+i+'Torso').value===byId('palette'+i+'Head').value;
    render();
  }
  function simulateSchedule(c,exampleSeed=0x582A,seconds=300) {
    if(!Number.isInteger(seconds)||seconds<1||seconds>3600)throw Error('Choose a preview window of 1–3600 seconds.');
    let seed=exampleSeed, random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    const between=(lo,hi)=>lo+Math.floor(random()*(hi-lo+1));
    const events=[];
    const add=(kind,on,min,max,duration)=>{
      if(!on||!Number.isInteger(min)||!Number.isInteger(max)||min>max||min<=0)return;
      let t=0;
      for(let j=0;j<512;j++){t+=between(min,max);if(t>=seconds)break;events.push({kind,time:t,duration})}
    };
    add("head",c.headEnabled&&(!c.compoundEnabled||c.compoundAlongside),c.headMin,c.headMax,25);
    add("torso",c.torsoEnabled&&(!c.compoundEnabled||c.compoundAlongside),c.torsoMin,c.torsoMax,25);
    add("arm",c.armEnabled&&(!c.compoundEnabled||c.compoundAlongside),c.armMin,c.armMax,22);
    add("compound",c.compoundEnabled,c.compoundMin,c.compoundMax,35); // illustration: compound body events
    add("jaw",c.jawEnabled,c.jawMin,c.jawMax,21);
    add("eyes",c.eyesEnabled&&c.eyeChoices.length>1,c.eyesMin,c.eyesMax,0);
    add("lights",c.lightsEnabled&&c.lightRotation,c.lightInterval,c.lightInterval,0);
    events.sort((a,b)=>a.time-b.time);
    // Show requested intervals only. A partial arbitration model gave false
    // precision about actual starts and could leave events out of time order.
    return events.filter(e=>e.time<seconds);
  }
  let previewSeed=0x582A;
  function renderMotionPreviews(){
    for(const demo of document.querySelectorAll("[data-motion-for]")){
      const enabled=byId(demo.dataset.motionFor).checked;
      demo.classList.toggle("is-enabled",enabled);
      demo.classList.toggle("is-animated",enabled);
    }
  }
  function render() {
    const c=readConfig(),errors=validate(c);
    for(const button of document.querySelectorAll('.preset'))button.setAttribute('aria-pressed',String(button.classList.contains('chosen')));
    renderMotionPreviews();
    const seconds=900;
    const clock=t=>Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
    byId('timelineTitle').textContent='15-minute timing preview';
    byId('timelineMid').textContent=clock(Math.floor(seconds/2));byId('timelineEnd').textContent=clock(seconds);
    byId('timeline').setAttribute('aria-label','Example requested intervals over '+seconds+' seconds, not actual movement times');
    const previewItems=window.SkellyExperience.previewItems(c);
    const legend=byId("timelineLegend");legend.replaceChildren();
    for(const [kind,label] of previewItems) {
      const item=document.createElement("span"),dot=document.createElement("i");
      dot.className="dot "+kind;item.append(dot,document.createTextNode(" "+label));legend.append(item);
    }
    byId("timelineEmpty").hidden=simulateSchedule(c,previewSeed,seconds).length>0;
    const feedback=byId("scheduleFeedback");
    feedback.replaceChildren();
    for(const text of window.SkellyExperience.scheduleFeedback(c)) {
      const item=document.createElement("li");item.textContent=text;feedback.append(item);
    }
    byId("headSummary").textContent=c.headEnabled?c.headMin+"–"+c.headMax+" sec":"Off";
    byId("torsoSummary").textContent=c.torsoEnabled?c.torsoMin+"–"+c.torsoMax+" sec":"Off";
    byId("armSummary").textContent=c.armEnabled?c.armMin+"–"+c.armMax+" sec":"Off";
    byId("bodyOverlapSummary").textContent=c.compoundEnabled?(c.compoundAlongside?"Serialized + combined actions":"Combined actions only"):"Serialized";
    byId("compoundSummary").textContent=c.compoundEnabled?c.compoundMasks.map(m=>"0x"+m.toString(16).padStart(2,"0")).join(", ")+" · "+c.compoundMin+"–"+c.compoundMax+" sec":"Off";
    byId('lightSummary').textContent=window.SkellyExperience.lightingSummary(c);
    const summaryPalette=c.lightPalettes[0]??0;
    for(const part of ['torso','head']){const dot=byId(part==='torso'?'summaryTorsoColor':'summaryHeadColor');dot.hidden=!c.lightsEnabled;dot.style.background=c.lightRotation?c['palette'+summaryPalette+(part==='torso'?'Torso':'Head')]:c[part+'Color'];}
    byId("jawProtectionSummary").textContent=c.jawEnabled?(c.jawProtectBody?"Protect all body motors":"MP3 can interrupt motion"):"Not needed";
    const motorLabel=["Off","Arm","Torso","Arm or torso","Head (2s & 10s failed)"][c.jawFollowupMotor] || "Unknown";
    byId("jawFollowupSummary").textContent=c.jawFollowupMotor===0?"Off":motorLabel+" after "+c.jawFollowupDelaySec+"s · "+(c.jawFollowupRecurring?"Recurring":"One-shot");
    const files=[c.jawFile,...extraFileNumbers(c)];
    const clips=readLibrary();
    const names={chatter:"Chatter",longOpen:"Long open",gasp:"Whisper & gasp"};
    const selectedNames=files.map(file=>Object.keys(clips).filter(k=>clips[k]===file));
    byId("jawChoiceStatus").textContent=!c.jawEnabled?"Jaw playback is off.":"Selected: "+files.map((file,i)=>
      (selectedNames[i].length===1?names[selectedNames[i][0]]+" · ":"")+"#"+file).join(" + ")+(files.length>1?" · chosen randomly":"");
    for(const button of document.querySelectorAll("[data-jaw-choice]")) {
      let selected=false;
      try {
        const choice=jawSelection(button.dataset.jawChoice,clips);
        button.disabled=false;
        selected=c.jawEnabled && choice.jawFile===c.jawFile && choice.jawExtras===c.jawExtras;
      } catch { button.disabled=true; }
      button.setAttribute("aria-pressed",String(selected));
    }
    const fixedEyes=c.eyeChoices.length===1;
    byId("eyeSummary").textContent=c.eyesEnabled?(fixedEyes?'Eye #'+c.eyeChoices[0]+' · fixed':c.eyesMin+"–"+c.eyesMax+" sec · random"):"Off · stored eyes";
    byId('summaryEyeImage').hidden=!c.eyesEnabled;
    byId('summaryEyeImage').src=eyeImageUrl(c.eyeChoices[0]);
    byId('summaryEyeRotation').hidden=!c.eyesEnabled||fixedEyes;
    byId("lightingStatus").textContent=c.lightsEnabled?(c.lightRotation?"On · "+c.lightPalettes.length+" palettes every "+c.lightInterval+" sec":"On · selected colors"):"Off · stored colors";
    byId("lightRotationOptions").disabled=!c.lightsEnabled||!c.lightRotation;
    byId("lightRotationOptions").hidden=!c.lightRotation;
    byId('lightingMode').value=c.lightRotation?'rotate':'single';byId('linkLightRow').hidden=c.lightRotation;
    document.querySelectorAll('.light-custom-color').forEach(node=>node.hidden=c.lightRotation);
    byId('torsoColor').disabled=c.lightRotation;byId('headColor').disabled=c.lightRotation||byId('linkLightColors').checked;
    for(let i=0;i<4;i++)byId('palette'+i+'Head').disabled=document.querySelector('[data-palette-link="'+i+'"]').checked;
    for(const part of ["torso","head"]){byId(part+"Speed").disabled=!c.lightsEnabled||c[part+"Effect"]===1;byId(part+'SpeedRow').hidden=c[part+'Effect']===1;const brightness=Math.round(c[part+'Brightness']/255*100)+'%';byId(part+'BrightnessValue').textContent=brightness;byId(part+'Brightness').setAttribute('aria-valuetext',brightness);}
    byId('strobeNotice').hidden=!c.lightsEnabled||![c.torsoEffect,c.headEffect].includes(2);
    byId("eyesStatus").textContent=c.eyesEnabled?(fixedEyes?'On · eye #'+c.eyeChoices[0]+' · stays the same':"On · "+c.eyeChoices.length+" expressions in random rotation"):"Off · preview your chosen expression";
    byId('eyeTiming').hidden=byId('eyeBehavior').value==='fixed';
    for(const id of ['eyesMin','eyesMax'])byId(id).disabled=byId('eyeBehavior').value==='fixed';
    byId("breaksStatus").textContent=c.restEnabled?"On · "+c.restDurationMin+"–"+c.restDurationMax+" second pauses":"Off · pauses between routines";
    const palette=Array.from({length:4},(_,i)=>({name:c["palette"+i+"Name"],torsoColor:c["palette"+i+"Torso"],headColor:c["palette"+i+"Head"]})).find(p=>p.torsoColor===c.torsoColor && p.headColor===c.headColor);
    byId("paletteStatus").textContent=!c.lightsEnabled?"Lighting is off.":c.lightRotation?"Rotating selected palettes; custom color fields are used when rotation is off.":palette?palette.name+" colors selected.":"Custom colors selected.";
    for(const button of document.querySelectorAll("[data-palette]")) {
      const i=Object.keys(PALETTES).indexOf(button.dataset.palette);
      const p={name:c["palette"+i+"Name"],torsoColor:c["palette"+i+"Torso"],headColor:c["palette"+i+"Head"]};
      button.lastChild.textContent=p.name;
      const swatches=button.querySelectorAll("i");swatches[0].style.background=p.torsoColor;swatches[1].style.background=p.headColor;
      document.querySelector('[data-edit-palette="'+i+'"]').setAttribute('aria-label','Edit '+p.name+' palette');
      document.querySelector('.light-palette-choice[value="'+i+'"]').nextSibling.textContent=" "+p.name;
      button.setAttribute("aria-pressed",String(!c.lightRotation && p.torsoColor===c.torsoColor && p.headColor===c.headColor));
    }
    byId("mouthStatus").textContent=c.jawEnabled?(c.eyeJawMode===3?"Audio scene active · advanced playback controls":"On · limited coordination; audio required"):"Off · optional";
    byId("mouthOptions").disabled=!c.jawEnabled;
    byId("mouthOptions").hidden=!c.jawEnabled;
    byId("mouthOptions").classList.toggle("muted",!c.jawEnabled);
    byId("overlapSummary").textContent=!c.jawEnabled?"Not needed":(c.jawEnabled&&c.jawProtectBody)?"Blocked by MP3 protection":c.overlap?"Allowed (experimental)":"Avoided";
    for(const id of ["headEnabled","torsoEnabled","armEnabled","jawEnabled"])document.querySelector('[data-for="'+id+'"]').classList.toggle("muted",!byId(id).checked);
    const firstPalette=c.lightPalettes[0]??0;
    byId('lightPreviewTorso').style.background=c.lightRotation?c['palette'+firstPalette+'Torso']:c.torsoColor;
    byId('lightPreviewHead').style.background=c.lightRotation?c['palette'+firstPalette+'Head']:c.headColor;
    byId('lightPreviewLabel').textContent=c.lightRotation?'Starts with '+c['palette'+firstPalette+'Name']:palette?palette.name:'Custom colors';
    byId("selectedEyeCount").textContent=fixedEyes?'Selected: eye #'+c.eyeChoices[0]+' · fixed':c.eyeChoices.length+" of "+deviceFor(c).eyes+" selected";
    byId("restOptions").classList.toggle("muted",!c.restEnabled);
    byId("restOptions").inert=!c.restEnabled;
    const e=byId("error");e.hidden=!errors.length;e.textContent=errors.join("\n");
    byId('validationJump').hidden=!errors.length;
    byId("download").disabled=errors.length>0;byId("preview").disabled=errors.length>0;
    const timeline=byId("timeline");timeline.replaceChildren();
    timeline.style.height=Math.max(38,previewItems.length*24+10)+"px";
    for(const [row,[kind]] of previewItems.entries()) {
      const key={compound:'compound',head:'head',arm:'arm',torso:'torso',eyes:'eyes',jaw:'jaw'}[kind];
      const min=kind==='lights'?c.lightInterval:c[key+'Min'],max=kind==='lights'?c.lightInterval:c[key+'Max'];
      if(min<seconds){const range=document.createElement('span');range.className='request-window '+kind;range.style.left=(min/seconds*100)+'%';range.style.width=Math.max(.7,(Math.min(max,seconds)-min)/seconds*100)+'%';range.style.top=(8+row*24)+'px';range.title='First '+kind+' request window: '+min+'–'+max+' seconds';if(max>seconds){range.classList.add('continues');range.textContent='→';}timeline.append(range);}
    }
    byId('timelineBeyond').hidden=!(c.compoundEnabled&&c.compoundMax>seconds);
    byId('timelineBeyond').textContent='Combined requests: '+c.compoundMin+'–'+c.compoundMax+' seconds; the first can fall beyond this window.';
    for(const ev of simulateSchedule(c,previewSeed,seconds)){
      const element=document.createElement("span");
      element.className="event "+ev.kind;
      element.style.left=(ev.time/seconds*100)+"%";
      element.style.top=(8+previewItems.findIndex(([kind])=>kind===ev.kind)*24)+"px";
      element.style.height="14px";
      element.title=ev.kind+" requested at "+Math.floor(ev.time/60)+":"+String(ev.time%60).padStart(2,"0")+"; actual start may be later";
      timeline.appendChild(element);
    }
    const experimental=deviceFor(c).experimental;
    byId('firstRunIntro').textContent=experimental?'Start with head only, at least 90 seconds between requests. Duration is unmeasured; keep the first test attended.':'Choose Subtle for a spooky head turn every 1–2 minutes. No wiring to the prop is needed.';
    byId('firstRunDevice').textContent=experimental?'2026 app-controlled 12-foot model only. Experimental — Not Hardware Tested. Use an original ESP32-WROOM.':'Use a 6.5-foot Ultra Skelly v2 and an original ESP32-WROOM. Other models are unverified.';
    byId('firstRunExtras').textContent=experimental?'After a visual head test passes, test optional eyes and chest lighting separately. Audio and other body motors stay disabled.':'Add arm, torso, eyes or lighting to make the routine your own.';
    for(const node of document.querySelectorAll('.preset small, [data-scene-starter] small, [data-scene-starter] span')){
      node.dataset.ultraDescription??=node.textContent;
      node.textContent=experimental?(node.parentElement.dataset.sceneStarter?(node.tagName==='SPAN'?'Eyes and chest lighting · experimental':'Head only · model restrictions apply'):'Head only · 90+ sec requests'):node.dataset.ultraDescription;
    }
    byId('deviceWarning').hidden=!experimental;
    for(const id of ['armEnabled','torsoEnabled'])byId(id).closest('.movement-block').hidden=experimental;
    byId('compoundEnabled').closest('.eye-sync-control').hidden=experimental;
    byId('mouth').hidden=experimental;
    byId('audioScenes').hidden=experimental;
    byId('headLightTitle').closest('section').hidden=experimental;
    byId('lightPreviewHead').closest('span').hidden=experimental;
    document.querySelectorAll('.palette-swatches').forEach(node=>node.lastElementChild.hidden=experimental);
    byId('torsoLightTitle').textContent=experimental?'Chest (experimental)':'Torso';
    byId('headEnabled').closest('.movement-block').querySelector('small').textContent=experimental?'Duration unmeasured; 60 s estimate + 30 s cooldown':'Turns for about 25 seconds';
    byId('headMin').min=experimental?90:32;byId('headMax').min=experimental?90:32;
    if(experimental){byId('linkLightRow').hidden=true;byId('summaryHeadColor').hidden=true;}
    for(let i=0;i<4;i++){
      byId('palette'+i+'Head').closest('label').hidden=experimental;
      document.querySelector('[data-palette-link="'+i+'"]').closest('label').hidden=experimental;
    }
    document.querySelectorAll('.eye-choice input').forEach(input=>{
      const i=Number(input.value),card=input.closest('.eye-card');card.hidden=i>deviceFor(c).eyes;
      const img=card.querySelector('img');if(img){const url=eyeImageUrl(i);img.hidden=!url;img.src=url;}
    });
    byId('summaryEyeImage').hidden=!c.eyesEnabled||!eyeImageUrl(c.eyeChoices[0]);
    document.dispatchEvent(new CustomEvent('skelly-config-changed'));
  }
  function generateRuntimeSketch(scenes,rotate=false,random=false) {
    if(!window.SkellyRuntime)throw Error('The offline USB settings module did not load.');
    const words=window.SkellyRuntime.encode(scenes,rotate,validate,random);
    // Include every optional scheduling hook in the universal build; runtime
    // settings, rather than these compile-time seed values, control activation.
    const deviceId=scenes[0].config.deviceId??"ultra";
    let source=generateSketch(adaptDevice({...DEFAULTS,bleName:scenes[0].config.bleName,jawEnabled:false,jawExtras:'13',restEnabled:true,clockEnabled:true},deviceId));
    const match=source.match(/const uint32_t RUNTIME_SEED\[\] = \{[^}]+\};/);
    if(!match)throw Error('Runtime seed anchor missing.');
    source=replaceOnce(source,match[0],'const uint32_t RUNTIME_SEED[] = {'+words.map(n=>n+'UL').join(',')+'};');
    return '#define SKELLY_RUNTIME 1\n'+source;
  }
  // Bundled eye previews and attribution: images/eyes/README.md.
  function eyeImageUrl(index) {
    if(typeof document!=="undefined" && byId("deviceId")?.value==="skelly12") {
      // Upstream numbering differs. Two designs have no bundled Ultra image.
      const mapping=[14,15,16,17,0,0,18,1,2,3,4,5,6,7,8,9,10,11,12,13];
      index=mapping[index-1];if(!index)return "";
    }
    return "./images/eyes/eye_icon_"+index+".png";
  }
  function showEyePreview(index) {
    const image=byId("eyePreviewImage");
    image.src=eyeImageUrl(index);
    image.hidden=!image.getAttribute('src');
    image.alt="Enlarged preview of Ultra Skelly eye pattern "+index;
    byId("eyePreviewLabel").textContent="Eye pattern #"+index;
  }
  function readLibrary() {
    return Object.fromEntries(Object.entries(CLIP_FIELDS).map(([key,id])=>
      [key,byId(id).value===""?null:Number(byId(id).value)]));
  }
  function writeLibrary(clips,reference=null) {
    writeAudioReference(reference);
    for(const [key,id] of Object.entries(CLIP_FIELDS))byId(id).value=clips[key]??"";
  }
  function sketchFilename(name,now=new Date()) {
    const pad=n=>String(n).padStart(2,'0');
    return name.replace(/\.ino$/i,'')+'_'+now.getFullYear()+pad(now.getMonth()+1)+pad(now.getDate())+'_'+pad(now.getHours())+pad(now.getMinutes())+pad(now.getSeconds())+'.ino';
  }
  function downloadText(text,name,type) {
    const href=URL.createObjectURL(new Blob([text],{type}));
    const a=document.createElement("a");a.href=href;a.download=/\.ino$/i.test(name)?sketchFilename(name):name;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
  }
  function init(){
    let editingPalette=null;
    const eyeGrid=byId("eyeGrid");
    for(let i=1;i<=18;i++){
      const card=document.createElement("div");
      card.className="eye-card";
      const label=document.createElement("label");
      label.className="eye-choice";
      label.title="Choose eye pattern "+i;
      const input=document.createElement("input");
      input.type="checkbox";input.value=i;input.checked=i===1;
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
    // The two additional 12-foot designs are selectable without inventing art.
    for(let i=19;i<=20;i++){
      const card=document.createElement('div');card.className='eye-card';card.hidden=true;
      const label=document.createElement('label');label.className='eye-choice';
      const input=document.createElement('input');input.type='checkbox';input.value=i;
      label.append(input,document.createTextNode('Eye '+i));card.append(label);eyeGrid.append(card);
    }
    for(const el of document.querySelectorAll("input, select"))el.addEventListener("input",()=>{
      if(el.id==="scenePreviewSelect"||el.id==='controllerConsent'||el.closest("#audioScenes"))return;
      if(el.id==='deviceId'){
        const device=DEVICE_PROFILES[el.value];
        writeConfig(adaptDevice({...readConfig(),bleName:device.bleName,headEnabled:true,
          headMin:device.experimental?90:35,headMax:device.experimental?180:75,eyesEnabled:false,lightsEnabled:false,eyeChoices:[1]}));
        byId('deviceChangeNotice').hidden=true;
        return;
      }
      for(const b of document.querySelectorAll(".preset")){b.classList.remove("chosen");b.setAttribute('aria-pressed','false');}
      if(el.closest('.eye-choice')){
        if(byId('eyeBehavior').value==='fixed')document.querySelectorAll('.eye-choice input').forEach(other=>other.checked=other===el);
        else if(!document.querySelector('.eye-choice input:checked'))el.checked=true;
        if(el.checked)showEyePreview(Number(el.value));
      }
      if(el.id==='eyeBehavior'&&el.value==='fixed')writeConfig({eyeChoices:readConfig().eyeChoices.slice(0,1)});
      if(el.id==='linkLightColors'||el.id==='torsoColor')if(byId('linkLightColors').checked)byId('headColor').value=byId('torsoColor').value;
      for(let i=0;i<4;i++)if(el.id==='palette'+i+'Torso'||el.dataset.paletteLink===String(i))if(document.querySelector('[data-palette-link="'+i+'"]').checked)byId('palette'+i+'Head').value=byId('palette'+i+'Torso').value;
      if(editingPalette?.follow&&(el.id.startsWith('palette'+editingPalette.index)||el.dataset.paletteLink===String(editingPalette.index))){
        byId('torsoColor').value=byId('palette'+editingPalette.index+'Torso').value;byId('headColor').value=byId('palette'+editingPalette.index+'Head').value;byId('linkLightColors').checked=byId('torsoColor').value===byId('headColor').value;
      }
      if(el.id==='lightingMode')writeConfig({lightRotation:el.value==='rotate',lightsEnabled:true});
      else if(el.id==="jawEnabled"&&!el.checked)writeConfig(window.SkellyExperience.withoutMouth(readConfig()));
      else if(el.id==="lightRotation"&&el.checked)writeConfig({lightsEnabled:true});
      else render();
    });
    byId("selectAllEyes").addEventListener("click",()=>{byId('eyeBehavior').value='random';document.querySelectorAll(".eye-choice input").forEach(el=>el.checked=Number(el.value)<=deviceFor(readConfig()).eyes);render()});
    byId("selectFewEyes").addEventListener("click",()=>{byId('eyeBehavior').value='random';document.querySelectorAll(".eye-choice input").forEach(el=>el.checked=Number(el.value)<=6);render()});
    byId('newExample').addEventListener('click',()=>{previewSeed=(previewSeed+1)>>>0;render();});
    for(const b of document.querySelectorAll(".preset"))b.addEventListener("click",()=>{
      for(const p of document.querySelectorAll(".preset"))p.classList.toggle("chosen",p===b);
      const preset=PRESETS[b.dataset.preset];
      writeConfig(adaptDevice(preset.jawEnabled?{...readConfig(),...preset}:window.SkellyExperience.withoutMouth({...readConfig(),...preset})));
    });
    for(const button of document.querySelectorAll("[data-jaw-choice]"))button.addEventListener("click",()=>{
      try {
        writeConfig({...jawSelection(button.dataset.jawChoice,readLibrary()),eyeJawMode:1});
        for(const b of document.querySelectorAll(".preset")){b.classList.remove("chosen");b.setAttribute('aria-pressed','false');}
      }
      catch(error) { byId("jawChoiceStatus").textContent=error.message; }
    });
    for(const button of document.querySelectorAll("[data-palette]"))button.addEventListener("click",()=>{
      const c=readConfig(),i=Object.keys(PALETTES).indexOf(button.dataset.palette);
      writeConfig({torsoColor:c["palette"+i+"Torso"],headColor:byId('linkLightColors').checked?c["palette"+i+"Torso"]:c["palette"+i+"Head"],lightRotation:false});
      for(const b of document.querySelectorAll(".preset")){b.classList.remove("chosen");b.setAttribute('aria-pressed','false');}
    });
    for(const button of document.querySelectorAll('[data-edit-palette]'))button.addEventListener('click',()=>{
      const index=Number(button.dataset.editPalette),c=readConfig();editingPalette={index,follow:!c.lightRotation&&c.torsoColor===c['palette'+index+'Torso']&&c.headColor===c['palette'+index+'Head']};document.querySelectorAll('[data-palette-editor]').forEach(node=>node.hidden=Number(node.dataset.paletteEditor)!==index);
      byId('paletteDialogTitle').textContent='Edit '+byId('palette'+index+'Name').value;byId('paletteDialog').showModal();byId('palette'+index+'Name').focus();
    });
    for(const id of ['paletteDialogClose','paletteDialogDone'])byId(id).onclick=()=>byId('paletteDialog').close();
    byId('paletteDialog').addEventListener('close',()=>editingPalette=null);
    // Reveal nested disclosures before native anchor scrolling, including deep links.
    function revealSection(hash){
      const target=byId(hash.slice(1));if(!target)return null;
      for(let node=target;node;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
      const focus=target.tagName==='DETAILS'?target.querySelector('summary'):target;
      if(focus){if(!focus.hasAttribute('tabindex'))focus.setAttribute('tabindex','-1');focus.focus({preventScroll:true});}
      return target;
    }
    for(const link of document.querySelectorAll('a[href^="#"]'))link.addEventListener('click',event=>{
      if(!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey)revealSection(link.getAttribute('href'));
    });
    const revealHash=()=>{if(window.location.hash)revealSection(window.location.hash)?.scrollIntoView({block:'start'});};
    window.addEventListener('hashchange',revealHash);
    revealHash();
    byId("saveProfile").addEventListener("click",()=>{
      try {
        downloadText(createProfile(readConfig(),readLibrary()),"SkellyStudio-settings.json","application/json");
        byId("profileStatus").textContent="Settings saved. Keep this file to restore your setup.";
      } catch(error) { byId("profileStatus").textContent=error.message; }
    });
    byId("loadProfile").addEventListener("click",()=>byId("profileFile").click());
    byId("profileFile").addEventListener("change",async event=>{
      const file=event.target.files[0];
      if(!file)return;
      try {
        if(file.size>65536)throw new Error("Choose a settings file smaller than 64 KB.");
        const profile=parseProfile(await file.text());
        const previousDevice=readConfig().deviceId;
        if(window.SkellyScenes?.loadProfile){if(!await window.SkellyScenes.loadProfile(profile))return;}
        else{
        for(const [key,id] of Object.entries(CLIP_FIELDS))byId(id).value=profile.clips[key]??"";
        writeAudioReference(profile.audio);writeConfig(profile.config);
        }
        for(const b of document.querySelectorAll(".preset")){b.classList.remove("chosen");b.setAttribute('aria-pressed','false');}
        byId("profileStatus").textContent=(previousDevice!==profile.config.deviceId?"Warning: this profile changes the selected device model. ":"")+"Settings loaded for "+deviceFor(profile.config).name+". Clip numbers belong to the Skelly that created this profile.";
      } catch(error) { byId("profileStatus").textContent="Could not load settings: "+error.message; }
      finally { event.target.value=""; }
    });
    byId("download").addEventListener("click",()=>{
      try{
        const code=generateSketch(readConfig());
        downloadText(code,"SkellyAutonomous.ino","text/plain;charset=utf-8");
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
    const pauseMotion=()=>byId("movement").classList.toggle("motion-paused",document.hidden);
    document.addEventListener("visibilitychange",pauseMotion);pauseMotion();
    writeConfig({...DEFAULTS,...PRESETS.normal});
  }
  window.SkellyStudioGenerator={DEFAULTS,PRESETS,DEVICE_PROFILES,adaptDevice,validate,generateSketch,generateRuntimeSketch,simulateSchedule,jawSelection,createProfile,parseProfile,PALETTES,paletteSettings,readConfig,writeConfig,downloadText,sketchFilename,readLibrary,writeLibrary,readAudioReference,writeAudioReference,normalizeAudioReference};
  if(typeof document!=="undefined")document.addEventListener("DOMContentLoaded",init);
})();
