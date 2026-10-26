/* Pure setup guidance. No device access and no prediction of physical response. */
(function () {
  "use strict";
  function firstRoutine(defaults) {
    return {...defaults, headEnabled:true, headMin:60, headMax:120,
      jawEnabled:false, armEnabled:false, torsoEnabled:false, eyesEnabled:false,
      lightsEnabled:false, compoundEnabled:false, jawFollowupMotor:0,
      jawFollowupRecurring:false, bodyOverlap:false, jawProtectBody:true,
      restEnabled:false, overlap:false, fairBodyTurns:false, playbackDiagnostics:false,
      clockEnabled:false};
  }
  function withoutMouth(config) {
    return {...config,jawEnabled:false,jawFollowupMotor:0,jawFollowupRecurring:false,
      fairBodyTurns:false,playbackDiagnostics:false,eyeJawMode:config.eyeJawMode===3?1:config.eyeJawMode};
  }
  function previewItems(c) {
    const items=[];
    if(c.compoundEnabled)items.push(["compound","Combined"]);
    if(!c.compoundEnabled||c.compoundAlongside)for(const [key,name] of [["head","Head"],["torso","Torso"],["arm","Arm"]])if(c[key+"Enabled"])items.push([key,name]);
    if(c.eyesEnabled&&c.eyeChoices.length>1)items.push(["eyes","Eyes"]);
    if(c.lightsEnabled&&c.lightRotation)items.push(["lights","Lighting"]);
    if(c.jawEnabled)items.push(["jaw",c.eyeJawMode===3?"Audio scene":"Jaw"]);
    return items;
  }
  function lightingSummary(c){
    if(!c.lightsEnabled)return 'Off · stored lights';
    const names={1:'Static',2:'Strobe',3:'Pulsing'},effects=c.torsoEffect===c.headEffect?names[c.torsoEffect]:names[c.torsoEffect]+' / '+names[c.headEffect];
    return (c.lightRotation?c.lightPalettes.length+' palettes · '+c.lightInterval+' sec · ':'')+effects+' · '+Math.round(c.torsoBrightness/255*100)+'% / '+Math.round(c.headBrightness/255*100)+'%';
  }
  const api={firstRoutine,withoutMouth,previewItems,lightingSummary};
  if(typeof module!=="undefined")module.exports=api;
  if(typeof window!=="undefined")window.SkellyExperience=api;
})();
