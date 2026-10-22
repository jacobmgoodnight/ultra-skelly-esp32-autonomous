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
      fairBodyTurns:false,playbackDiagnostics:false};
  }
  function scheduleFeedback(c) {
    const messages=["Equal minimum/maximum values request a fixed interval; a range randomizes it. Starts are measured after connection or the previous start, not by clock time."];
    if(c.headEnabled||c.armEnabled||c.torsoEnabled) messages.push("Motor cooldowns stay conservative: head 32 seconds, arm 32 seconds, torso 35 seconds. A due request waits for its locks.");
    if(c.jawEnabled&&c.jawProtectBody) messages.push("Jaw playback waits for body movement to finish. Body requests wait while jaw playback is due or active; requested intervals are not guaranteed start times.");
    if(c.jawEnabled&&c.jawFollowupMotor) messages.push("Jaw-first coordination uses a separate delayed follow-up. The request illustration does not draw that follow-up; HEAD after jaw failed in physical tests.");
    if(c.compoundEnabled) messages.push(c.compoundAlongside?"Combined actions wait for current motion, take priority when due, then individual routines resume. Each selected combination uses one command.":"Combined-only mode replaces individual body requests. One permitted mask is chosen per event.");
    if(c.restEnabled) messages.push("Idle breaks begin only after active movement finishes and can postpone every new request.");
    if(c.jawEnabled&&c.fairBodyTurns) messages.push(c.jawProtectBody?"Fair turns is experimental: one waiting body request gets a turn after jaw playback, without shortening motor cooldowns.":"Fair turns is inactive while MP3 body protection is OFF. Enable protection to use it.");
    if(c.clockEnabled) messages.push("Clock scheduling pauses new routines until USB time is set after every restart. Only selected days and the configured local-time window are active; existing motion can finish.");
    if(c.lightsEnabled&&c.jawEnabled&&c.lightRestoreMode) messages.push("The next jaw clip waits for the complete light-restoration sequence. Playback end is estimated, not confirmed by the prop.");
    const load=(c.headEnabled?32/c.headMin:0)+(c.armEnabled?32/c.armMin:0)+(c.torsoEnabled?35/c.torsoMin:0);
    if(!c.bodyOverlap&&(!c.compoundEnabled||c.compoundAlongside)&&load>1) messages.push("These body intervals request more movement than the shared cooldown allows. Expect delays; increasing the intervals gives each part more room.");
    if(c.jawEnabled&&c.jawProtectBody&&(c.compoundEnabled||c.headEnabled||c.armEnabled||c.torsoEnabled)&&c.jawMin<40) messages.push("Frequent jaw requests can starve body movement under jaw-priority scheduling. Use longer jaw intervals or the optional fair-turn policy.");
    return messages;
  }
  function previewItems(c) {
    const items=[];
    if(c.compoundEnabled)items.push(["compound","Combined"]);
    if(!c.compoundEnabled||c.compoundAlongside)for(const [key,name] of [["head","Head"],["torso","Torso"],["arm","Arm"]])if(c[key+"Enabled"])items.push([key,name]);
    if(c.eyesEnabled)items.push(["eyes","Eyes"]);
    if(c.lightsEnabled&&c.lightRotation)items.push(["lights","Lighting"]);
    if(c.jawEnabled)items.push(["jaw","Jaw"]);
    return items;
  }
  const api={firstRoutine,withoutMouth,scheduleFeedback,previewItems};
  if(typeof module!=="undefined")module.exports=api;
  if(typeof window!=="undefined")window.SkellyExperience=api;
})();
