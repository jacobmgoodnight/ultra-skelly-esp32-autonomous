// These serial numbers were confirmed by the original owner, not universal IDs.
const clips={chatter:12,longOpen:13,gasp:14};
const isolated={headEnabled:false,armEnabled:false,torsoEnabled:false,jawEnabled:true,
  jawFile:clips.longOpen,jawExtras:"",jawMin:60,jawMax:60,eyesEnabled:false,
  restEnabled:false,lightsEnabled:false,compoundEnabled:false,bodyOverlap:false,
  jawFollowupMotor:0,jawFollowupRecurring:false,jawProtectBody:true,diagnosticsEnabled:true,
  torsoColor:"#ff0000",headColor:"#00ff00",torsoBrightness:180,headBrightness:150,lightRestoreMode:1};
const colors={lightsEnabled:true,torsoColor:"#ff0000",headColor:"#00ff00",
  torsoBrightness:180,headBrightness:150,lightRestoreMode:1};
const routine={...isolated,...colors,headEnabled:true,headMin:60,headMax:90,
  armEnabled:true,armMin:120,armMax:180,torsoEnabled:true,torsoMin:150,torsoMax:210,
  jawMin:60,jawMax:90,jawFollowupMotor:3,jawFollowupRecurring:true,jawFollowupDelaySec:2};
const cases=[
  {name:"Test01_JawSerial",title:"Jaw-only serial comparison",minutes:5,
    options:{...isolated},
    observe:"Observe four MP3 starts. Compare the SAME sketch in a second terminal at 115200 with Arduino Monitor closed. Keep cable/port unchanged; save original received bytes if possible. Body motors, eyes and live lighting must stay OFF."},
  {name:"Test02_EyeRestore",title:"Restore one chosen eye expression",minutes:5,
    options:{...isolated,eyesEnabled:true,eyeChoices:[2],eyesMin:300,eyesMax:300,eyeJawMode:1},
    observe:"Watch eye #2 before, during and after four jaw clips. Confirm it returns after any MP3 override. If the MP3 already uses #2, report the comparison as inconclusive. No body movement or live lighting is expected."},
  {name:"Test03_EyeChange",title:"Choose a new eye on jaw playback",minutes:5,
    options:{...isolated,eyesEnabled:true,eyeChoices:[2,6,18],eyesMin:300,eyesMax:300,eyeJawMode:2},
    observe:"Observe eye changes around four jaw clips. Requested designs must stay within #2/#6/#18 and recover after saved MP3 settings. The long regular eye interval helps distinguish the jaw-triggered updates."},
  {name:"Test04_JawMix",title:"Randomly select uploaded jaw clips",minutes:8,
    options:{...isolated,jawFile:clips.chatter,jawExtras:`${clips.longOpen}, ${clips.gasp}`},
    observe:"Match logged file #12/#13/#14 to chatter/long open/whisper-and-gasp. Observe at least six clips. Random choice can repeat; extend if a file has not appeared. Each clip must finish with no head/arm/torso movement."},
  {name:"Test05_IdleBreaks",title:"Pause and resume jaw playback",minutes:8,
    options:{...isolated,restEnabled:true,restMin:120,restMax:120,restDurationMin:30,restDurationMax:30},
    observe:"Observe at least two REST log entries and the following playback. Active jaw playback should finish before each approximately 30-second pause. New jaw requests stop during the break and resume afterward. Pauses can be deferred until the current clip finishes."},
  {name:"Test06_MotorsLights",title:"Protected alternating routine with mode-1 colors",minutes:20,
    options:{...routine},
    observe:"After tests 01-05, attend the first five minutes; continue toward 20 minutes only if normal. Observe standalone head, alternating due arm/torso after jaw, full motor completion, continuing jaw during arm/torso, and red body/green head returning after each clip. Eyes and compound mode stay OFF. Not every clip triggers a body motor."},
  {name:"Test07_AddEyes",title:"Add eye recovery to the combined routine",minutes:20,
    options:{...routine,eyesEnabled:true,eyeChoices:[2,6,18],eyesMin:120,eyesMax:180,eyeJawMode:1},
    observe:"Run only after 02 and 06 pass physically. Repeat test 06 checks while observing eye recovery and rotation within #2/#6/#18. Report motion, eyes and both light channels separately."},
  {name:"Test08_Reconnect",title:"Prop power-cycle recovery without body motors",minutes:12,
    options:{...isolated,...colors},
    observe:"Let one clip and color restoration finish. Turn only Skelly OFF for 30 seconds, turn it back ON, and wait for automatic discovery/reconnect, initial colors and the next jaw clip. Repeat three times. Do not reset the ESP32. Capture counters/heap after each recovery and any unexpected replay; initial jaw scheduling restarts after connection. Existing cached-service behavior is under test, not fixed."},
  {name:"Test09_Compound",title:"Optional recurring combined body motions",minutes:20,optional:true,
    options:{...isolated,jawEnabled:false,headEnabled:true,armEnabled:true,torsoEnabled:true,
      compoundEnabled:true,compoundMasks:[3,5,6,7],compoundMin:180,compoundMax:360},
    observe:"Separate motor experiment: no jaw, eyes or lights. Observe which requested masks 0x03/05/06/07 physically move, their full durations and completion between starts. Random selection need not cover all masks in 20 minutes. Head+arm+torso masks were individually verified; recurring scheduling is the new test."},
  {name:"Test10_DuringLights",title:"Optional color restoration during playback",minutes:5,optional:true,
    options:{...isolated,...colors,lightRestoreMode:2},
    observe:"No body motors or eyes. Record actual colors before MP3, about three seconds into playback, and after playback for four clips. The controller requests colors during and after the modeled 21-second clip; do not infer a physical response from accepted writes."},
  {name:"Test11_LightRegions",title:"Optional head/body LED mapping",minutes:2,optional:true,
    options:{...isolated,...colors,jawEnabled:false},
    observe:"No jaw, body motor or eye requests. After initial lighting, record exactly which LEDs are red (channel 0) and green (channel 1), including any mouth area. This maps protocol Head Light to physical regions; it is not a separate mouth-channel claim."}
];
module.exports={clips,cases};
