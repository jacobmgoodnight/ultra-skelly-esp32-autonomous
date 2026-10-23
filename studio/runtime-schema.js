/* Versioned wire fields. Seconds remain seconds on USB; cooldowns are not writable. */
(function(){
  const fields=[];
  const add=(name,min,max,macro=null,expression=null)=>fields.push({name,min,max,macro,expression});
  for(const [name,macro] of Object.entries({headEnabled:'HEAD_ENABLED',armEnabled:'ARM_ENABLED',torsoEnabled:'TORSO_ENABLED',jawEnabled:'MOUTH_ENABLED',eyesEnabled:'EYES_ENABLED',lightsEnabled:'LIGHTS_ENABLED',compoundEnabled:'COMPOUND_BODY_ENABLED',compoundAlongside:'COMPOUND_ALONGSIDE',jawProtectBody:'JAW_PROTECTS_ARM_TORSO',jawFollowupRecurring:'JAW_FOLLOWUP_RECURRING',overlap:'ALLOW_HEAD_JAW_OVERLAP',restEnabled:'REST_ENABLED',lightRotation:'LIGHT_ROTATION_ENABLED',diagnosticsEnabled:'DIAGNOSTICS_ENABLED',fairBodyTurns:'FAIR_BODY_TURNS',playbackDiagnostics:'PLAYBACK_DIAGNOSTICS',clockEnabled:'CLOCK_WINDOW_ENABLED'}))add(name,0,1,macro);
  for(const [name,min,prefix] of [['head',32,'HEAD'],['arm',45,'ARM'],['torso',45,'TORSO'],['jaw',22,'MOUTH'],['eyes',15,'EYE'],['compound',45,'COMPOUND_BODY'],['rest',120,'REST']])for(const bound of ['Min','Max'])add(name+bound,min,3600,prefix+'_'+bound.toUpperCase()+'_INTERVAL_MS','v * 1000UL');
  for(const [name,min,max,macro,expr] of [
    ['restDurationMin',15,300,'REST_MIN_DURATION_MS','v * 1000UL'],['restDurationMax',15,300,'REST_MAX_DURATION_MS','v * 1000UL'],
    ['jawFile',1,65535,'MOUTH_FILE_SERIAL'],['jawClipSec',21,120,'MOUTH_CLIP_MS','v * 1000UL'],
    ['jawFollowupMotor',0,3,'JAW_FOLLOWUP_MOTOR'],['jawFollowupDelaySec',2,10,'JAW_FOLLOWUP_DELAY_MS','v * 1000UL'],['eyeJawMode',0,3,'EYE_JAW_MODE'],
    ['lightInterval',15,3600,'LIGHT_ROTATION_INTERVAL_MS','v * 1000UL'],['torsoBrightness',0,255,'TORSO_LIGHT_BRIGHTNESS'],['headBrightness',0,255,'HEAD_LIGHT_BRIGHTNESS'],
    ['torsoEffect',1,3,'TORSO_LIGHT_MODE'],['headEffect',1,3,'HEAD_LIGHT_MODE'],['torsoSpeed',0,254,'TORSO_LIGHT_SPEED','254UL-v'],['headSpeed',0,254,'HEAD_LIGHT_SPEED','254UL-v'],
    ['lightRestoreMode',0,2,'LIGHT_RESTORE_MODE'],['scanRetrySec',5,300,'SCAN_RETRY_MS','v * 1000UL'],['startupRetrySec',5,300,'STARTUP_SCAN_RETRY_MS','v * 1000UL'],['startupWindowSec',0,300,'STARTUP_SCAN_WINDOW_MS','v * 1000UL'],
    ['clockStart',0,1439,'CLOCK_START_MINUTE'],['clockEnd',0,1439,'CLOCK_END_MINUTE'],['clockDays',1,127,'CLOCK_DAYS'],
    ['eyeMask',1,262143],['comboMask',0,15],['lightMask',1,15,'LIGHT_PALETTE_MASK'],['fileCount',1,8],['holdSec',60,3600]
  ])add(name,min,max,macro,expr);
  for(const name of ['torsoColor','headColor',...Array.from({length:4},(_,i)=>['palette'+i+'Torso','palette'+i+'Head']).flat()])add(name,0,16777215);
  for(let i=0;i<8;i++){add('file'+i,0,65535);add('duration'+i,0,120);}
  for(let i=0;i<32;i++)add('sceneLabel'+i,0,4294967295);
  for(let p=0;p<4;p++)for(let i=0;i<24;i++)add('paletteLabel'+p+'_'+i,0,4294967295);
  for(let i=0;i<12;i++)add('name'+i,0,4294967295);
  const api={version:1,maxScenes:4,fields};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window!=='undefined')window.SkellyRuntimeSchema=api;
})();
