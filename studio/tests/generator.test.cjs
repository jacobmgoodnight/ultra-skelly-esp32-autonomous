const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const context = vm.createContext({ window: {} });
for (const name of ["template.js", "app.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, name), "utf8"), context, { filename: name });
}
const api = context.window.SkellyStudioGenerator;
assert.ok(api && typeof api.generateSketch === "function");

function sample(changes = {}) {
  const defaults = api.DEFAULTS;
  return {
    ...defaults,
    eyeChoices: [...defaults.eyeChoices],
    ...changes
  };
}

test("default settings generate conservative head-and-jaw sketch", () => {
  const sketch = api.generateSketch(sample());
  assert.match(sketch, /const bool HEAD_ENABLED = true;/);
  assert.match(sketch, /const bool MOUTH_ENABLED = true;/);
  assert.match(sketch, /const bool EYES_ENABLED = false;/);
  assert.match(sketch, /const bool REST_ENABLED = false;/);
  assert.match(sketch, /const uint32_t HEAD_MIN_INTERVAL_MS = 32000;/);
  assert.match(sketch, /const uint32_t MOUTH_MIN_INTERVAL_MS = 45000;/);
  assert.match(sketch, /const uint16_t MOUTH_FILE_SERIAL = 12;/);
  assert.doesNotMatch(sketch, /const uint16_t JAW_FILE_POOL\[\]/);
  assert.match(sketch, /void startHead\(uint32_t now\)/);
  assert.match(sketch, /void startMouth\(uint32_t now\)/);
  assert.match(sketch, /uint8_t frame\[11\] = \{0xAA, 0xCA, 0x01/);
  assert.match(sketch, /const bool TORSO_ENABLED = false;/);
  assert.match(sketch, /const bool ARM_ENABLED = false;/);
  assert.match(sketch, /const uint32_t TORSO_MIN_INTERVAL_MS = 240000;/);
  assert.match(sketch, /const uint32_t ARM_MIN_INTERVAL_MS = 360000;/);
});

test("eyes option respects selected eye designs and avoids forced torso animation", () => {
  const sketch = api.generateSketch(sample({
    eyesEnabled: true, eyeChoices: [2, 6, 18], eyesMin: 60, eyesMax: 150
  }));
  assert.match(sketch, /const bool EYES_ENABLED = true;/);
  assert.match(sketch, /const uint8_t EYE_OPTIONS\[\] = \{2, 6, 18\};/);
  assert.match(sketch, /const uint32_t EYE_MIN_INTERVAL_MS = 60000;/);
  assert.match(sketch, /const uint32_t EYE_MAX_INTERVAL_MS = 150000;/);
  assert.match(sketch, /0xAA, 0xF9/);
  assert.match(sketch, /const bool TORSO_ENABLED = false;/);
  assert.match(sketch, /const bool ARM_ENABLED = false;/);
  assert.match(sketch, /const uint32_t TORSO_MIN_INTERVAL_MS = 240000;/);
  assert.match(sketch, /const uint32_t ARM_MIN_INTERVAL_MS = 360000;/);
});

test("Haunted enables verified torso and arm but keeps advanced overlap OFF", () => {
  assert.equal(api.PRESETS.haunted.torsoEnabled, true);
  assert.equal(api.PRESETS.haunted.armEnabled, true);
  assert.equal(api.PRESETS.haunted.bodyOverlap, false);
  assert.equal(api.PRESETS.normal.torsoEnabled, false);
  assert.equal(api.PRESETS.subtle.torsoEnabled, false);
  const sketch = api.generateSketch(sample({...api.PRESETS.haunted}));
  assert.match(sketch, /const bool TORSO_ENABLED = true;/);
  assert.match(sketch, /const bool ARM_ENABLED = true;/);
  assert.match(sketch, /const bool ALLOW_BODY_MOTOR_OVERLAP = false;/);
  assert.match(sketch, /const uint32_t TORSO_MIN_INTERVAL_MS = 180000;/);
  assert.match(sketch, /const uint32_t TORSO_MAX_INTERVAL_MS = 360000;/);
  assert.match(sketch, /if \(TORSO_ENABLED && reached\(now, nextTorsoAt\)/);
  assert.match(sketch, /ALLOW_BODY_MOTOR_OVERLAP \|\| reached\(now, bodySafeAfter\)/);
});
test("Verified 22-second arm uses 0x02 motor bit and per-part cooldown", () => {
  const sketch = api.generateSketch(sample({
    headEnabled:false, jawEnabled:false, eyesEnabled:false,
    armEnabled:true, armMin:300,armMax:600
  }));
  assert.match(sketch, /const bool HEAD_ENABLED = false;/);
  assert.match(sketch, /const bool ARM_ENABLED = true;/);
  assert.match(sketch, /const uint32_t ARM_MIN_INTERVAL_MS = 300000;/);
  assert.match(sketch, /0xAA, 0xCA, 0x02/);
  assert.match(sketch, /bodySafeAfter = now \+ ARM_ANIMATION_MS \+ ARM_BUFFER_MS/);
  assert.match(sketch, /const uint32_t ARM_ANIMATION_MS = 22000;/);
  assert.match(sketch, /const uint32_t ARM_BUFFER_MS = 10000;/);
  assert.match(sketch, /armSafeAfter = bodySafeAfter;/);
});
test("Reject dangerously fast body motor intervals", () => {
  assert.throws(() => api.generateSketch(sample({torsoEnabled:true,torsoMin:40})), /Torso:/);
  assert.throws(() => api.generateSketch(sample({armEnabled:true,armMin:40})), /Arm:/);
});

test("Arm and torso input minimums are conservative 45s, not hardcoded 90s/120s", () => {
  const sketch=api.generateSketch(sample({
    torsoEnabled:true,torsoMin:45,torsoMax:55,
    armEnabled:true,armMin:45,armMax:65
  }));
  assert.match(sketch, /const uint32_t TORSO_MIN_INTERVAL_MS = 45000;/);
  assert.match(sketch, /const uint32_t ARM_MIN_INTERVAL_MS = 45000;/);
});
test("Default jaw MP3 protects arm/torso from 0x00 playback metadata", () => {
  const protectedSketch=api.generateSketch(sample({torsoEnabled:true,armEnabled:true}));
  assert.match(protectedSketch, /const bool JAW_PROTECTS_ARM_TORSO = true;/);
  assert.match(protectedSketch, /JAW deferred: waiting for head\/arm\/torso cooldown/);
  assert.match(protectedSketch, /!blockArmTorsoForJaw/);
  assert.match(protectedSketch, /reached\(jawNow, torsoSafeAfter\)/);
  assert.match(protectedSketch, /reached\(jawNow, armSafeAfter\)/);
  const unprotected=api.generateSketch(sample({jawProtectBody:false}));
  assert.match(unprotected, /const bool JAW_PROTECTS_ARM_TORSO = false;/);
});
test("MP3 protection now includes the head, to preserve arm/torso follow-ups", () => {
  const config=sample({
    headEnabled:true, jawEnabled:true, armEnabled:true,torsoEnabled:true,
    jawProtectBody:true,overlap:true,bodyOverlap:false,
    jawFile:13,jawFollowupMotor:3,jawFollowupRecurring:true
  });
  const sketch=api.generateSketch(config);
  assert.match(sketch, /const bool JAW_PROTECTS_ARM_TORSO = true;/);
  assert.match(sketch, /!blockBodyForJaw/);
  assert.match(sketch, /const bool blockBodyForJaw =/);
  assert.match(sketch, /reached\(jawNow, headSafeAfter\)/);
  assert.match(sketch, /reached\(jawNow, torsoSafeAfter\)/);
  assert.match(sketch, /reached\(jawNow, armSafeAfter\)/);
  assert.match(sketch, /reached\(jawNow, bodySafeAfter\)/);
  assert.match(sketch, /JAW deferred: waiting for head\/arm\/torso cooldown/);
  assert.match(sketch, /reached\(now, headSafeAfter\) && !blockBodyForJaw/);
  assert.match(sketch, /JAW-FIRST RECURRING/);
  const sampleSchedule=api.simulateSchedule(config);
  const head=sampleSchedule.filter(x=>x.kind==="head");
  const jaw=sampleSchedule.filter(x=>x.kind==="jaw");
  for(const h of head)for(const j of jaw)
    assert.ok(h.time + 25 <= j.time || j.time + 21 <= h.time,
      "Timeline should not imply overlapping head+jaw when protection is on");
});

test("Jaw-first experiment is disabled by default and sends one selected motor after AAC6", () => {
  const normal=api.generateSketch(sample());
  assert.match(normal, /const uint8_t JAW_FOLLOWUP_MOTOR = 0;/);
  assert.match(normal, /const bool JAW_FOLLOWUP_RECURRING = false;/);
  assert.match(normal, /const uint32_t JAW_FOLLOWUP_DELAY_MS = 2000;/);
  const arm=api.generateSketch(sample({
    jawEnabled:true,armEnabled:true,jawFollowupMotor:1,jawFollowupDelaySec:2,
    headEnabled:false,torsoEnabled:false
  }));
  assert.match(arm, /const uint8_t JAW_FOLLOWUP_MOTOR = 1;/);
  assert.match(arm, /jawFollowupPending = jawFollowupChosenMotor != 0 &&/);
  assert.match(arm, /jawFollowupChosenMotor = chooseJawFollowupMotor\(now\);/);
  assert.match(arm, /bool jawFollowupTestDone = false;/);
  assert.match(arm, /if \(!JAW_FOLLOWUP_RECURRING\) jawFollowupTestDone = true;/);
  assert.match(arm, /jawFollowupAt = now \+ JAW_FOLLOWUP_DELAY_MS;/);
  assert.match(arm, /JAW-FIRST: sending ARM after MP3 start/);
  assert.match(arm, /startArm\(t\);/);
  assert.match(arm, /const bool clipActive = !reached\(t, mouthPlayingUntil\);/);
  const torso=api.generateSketch(sample({
    jawEnabled:true,torsoEnabled:true,jawFollowupMotor:2,jawFollowupDelaySec:4,
    headEnabled:false,armEnabled:false
  }));
  assert.match(torso, /const uint8_t JAW_FOLLOWUP_MOTOR = 2;/);
  assert.match(torso, /const uint32_t JAW_FOLLOWUP_DELAY_MS = 4000;/);
  assert.match(torso, /JAW-FIRST: sending TORSO after MP3 start/);
  assert.match(torso, /startTorso\(t\);/);
});
test("Recurring jaw-first coordinates to the motor's configured interval", () => {
  const arm=api.generateSketch(sample({
    headEnabled:false,armEnabled:true,jawEnabled:true,
    jawFile:13,jawFollowupMotor:1,jawFollowupRecurring:true,
    armMin:180,armMax:300
  }));
  assert.match(arm, /const bool JAW_FOLLOWUP_RECURRING = true;/);
  assert.match(arm, /if \(JAW_FOLLOWUP_MOTOR == 1\) return armDue \? 1 : 0;/);
  assert.match(arm, /JAW_FOLLOWUP_MOTOR == 1 \|\|/);
  assert.match(arm, /JAW-FIRST %s: scheduled/);
  assert.match(arm, /JAW_FOLLOWUP_RECURRING \? "RECURRING" : "ONE-SHOT"/);
  assert.match(arm, /const uint32_t ARM_MIN_INTERVAL_MS = 180000;/);
  const torso=api.generateSketch(sample({
    headEnabled:false,torsoEnabled:true,jawEnabled:true,
    jawFile:14,jawFollowupMotor:2,jawFollowupRecurring:true,
    torsoMin:120,torsoMax:240
  }));
  assert.match(torso, /const bool JAW_FOLLOWUP_RECURRING = true;/);
  assert.match(torso, /if \(JAW_FOLLOWUP_MOTOR == 2\) return torsoDue \? 2 : 0;/);
  assert.match(torso, /JAW_FOLLOWUP_MOTOR == 2 \|\|/);
  assert.match(torso, /const uint32_t TORSO_MIN_INTERVAL_MS = 120000;/);
});
test("Alternating jaw-first respects independent motor due times and remembers previous selection", () => {
  const sketch=api.generateSketch(sample({
    jawEnabled:true,headEnabled:false,armEnabled:true,torsoEnabled:true,
    jawFollowupMotor:3,jawFollowupRecurring:true,
    armMin:90,armMax:150,torsoMin:90,torsoMax:150,jawFile:13
  }));
  assert.match(sketch, /const uint8_t JAW_FOLLOWUP_MOTOR = 3;/);
  assert.match(sketch, /const bool JAW_FOLLOWUP_RECURRING = true;/);
  assert.match(sketch, /const bool armDue = ARM_ENABLED &&/);
  assert.match(sketch, /const bool torsoDue = TORSO_ENABLED &&/);
  assert.match(sketch, /lastJawFollowupMotor == 1 \? 2 : 1/);
  assert.match(sketch, /if \(JAW_FOLLOWUP_MOTOR == 3\)/);
  assert.match(sketch, /lastJawFollowupMotor = 1;/);
  assert.match(sketch, /lastJawFollowupMotor = 2;/);
  assert.match(sketch, /JAW_FOLLOWUP_MOTOR == 3\)\) &&/);
});

test("Jaw-first validates motor enable and sensible delay", () => {
  assert.throws(() => api.generateSketch(sample({jawFollowupMotor:1})), /Enable the arm switch/);
  assert.throws(() => api.generateSketch(sample({jawFollowupMotor:2})), /Enable the torso switch/);
  assert.throws(() => api.generateSketch(sample({jawEnabled:false,jawFollowupMotor:1,armEnabled:true})), /Enable silent jaw playback/);
  assert.throws(() => api.generateSketch(sample({jawFollowupMotor:4})), /jaw-first response/);
  assert.throws(() => api.generateSketch(sample({jawFollowupMotor:3,armEnabled:true,torsoEnabled:true})), /Enable recurring mode/);
  assert.throws(() => api.generateSketch(sample({jawFollowupMotor:3,jawFollowupRecurring:true,armEnabled:true})), /Enable both arm and torso/);
  assert.throws(() => api.generateSketch(sample({jawFollowupDelaySec:0})), /whole number/);
});
test("Subtle deliberately disables silent jaw by default", () => {
  assert.equal(api.PRESETS.subtle.jawEnabled, false);
  const sketch=api.generateSketch(sample({...api.PRESETS.subtle}));
  assert.match(sketch, /const bool MOUTH_ENABLED = false;/);
  assert.match(sketch, /const bool TORSO_ENABLED = false;/);
  assert.match(sketch, /const bool ARM_ENABLED = false;/);
  assert.equal(api.PRESETS.normal.jawEnabled, true);
  assert.equal(api.PRESETS.haunted.jawEnabled, true);
});
test("Advanced body overlap permits independent motor timers but defaults off", () => {
  const normal=api.generateSketch(sample());
  assert.match(normal, /const bool ALLOW_BODY_MOTOR_OVERLAP = false;/);
  const advanced=api.generateSketch(sample({bodyOverlap:true,torsoEnabled:true,armEnabled:true}));
  assert.match(advanced, /const bool ALLOW_BODY_MOTOR_OVERLAP = true;/);
  assert.match(advanced, /const uint32_t BODY_WRITE_SPACING_MS = 600;/);
  assert.match(advanced, /reached\(now, torsoSafeAfter\)/);
  assert.match(advanced, /reached\(now, armSafeAfter\)/);
  assert.match(advanced, /reached\(now, headSafeAfter\)/);
});
test("jaw playback can restore selected eyes or coordinate a new eye", () => {
  const restored = api.generateSketch(sample({eyesEnabled:true,eyeJawMode:1}));
  assert.match(restored, /const uint8_t EYE_JAW_MODE = 1;/);
  assert.match(restored, /jawEyeStartAt = now \+ EYE_JAW_START_DELAY_MS;/);
  assert.match(restored, /jawEyeEndAt = mouthPlayingUntil \+ EYE_JAW_END_GRACE_MS;/);
  assert.match(restored, /sendEyeIcon\(lastEye, "restored after jaw starts"\)/);
  assert.match(restored, /sendEyeIcon\(lastEye, "restored after jaw ends"\)/);
  const coordinated = api.generateSketch(sample({eyesEnabled:true,eyeJawMode:2}));
  assert.match(coordinated, /const uint8_t EYE_JAW_MODE = 2;/);
  assert.match(coordinated, /EYE_JAW_MODE == 2 \|\| lastEye == 0/);
  const mp3Controls = api.generateSketch(sample({eyesEnabled:true,eyeJawMode:0}));
  assert.match(mp3Controls, /const uint8_t EYE_JAW_MODE = 0;/);
  assert.throws(() => api.generateSketch(sample({eyeJawMode:3})), /eye\/jaw behavior/);
});

test("jaw file pool uses user-configured serials in AAC6 packets", () => {
  const sketch = api.generateSketch(sample({
    jawFile: 12, jawExtras: "13, 14", overlap: false
  }));
  assert.match(sketch, /const uint16_t JAW_FILE_POOL\[\] = \{12, 13, 14\};/);
  assert.match(sketch, /const uint16_t chosenJawFile = JAW_FILE_POOL/);
  assert.match(sketch, /\(uint8_t\)\(chosenJawFile >> 8\)/);
  assert.match(sketch, /\(uint8_t\)\(chosenJawFile & 0xFF\)/);
  assert.match(sketch, /const bool ALLOW_HEAD_JAW_OVERLAP = false;/);
});

test("rest mode schedules only after active animations finish", () => {
  const sketch = api.generateSketch(sample({
    restEnabled: true, restMin: 180, restMax: 420,
    restDurationMin: 25, restDurationMax: 60
  }));
  assert.match(sketch, /const bool REST_ENABLED = true;/);
  assert.match(sketch, /reached\(now, bodySafeAfter\) && reached\(now, mouthPlayingUntil\)/);
  assert.match(sketch, /nextRestAt = restUntil \+ random\(/);
});

test("invalid timing and file serials fail closed", () => {
  assert.throws(() => api.generateSketch(sample({headMin:31})), /Head:/);
  assert.throws(() => api.generateSketch(sample({jawFile:0})), /MP3 serial/);
  assert.throws(() => api.generateSketch(sample({jawExtras:"12"})), /unique file serials/);
  assert.throws(() => api.generateSketch(sample({jawExtras:"13, nope"})), /unique file serials/);
  assert.throws(() => api.generateSketch(sample({eyesEnabled:true,eyeChoices:[]})), /eye design/);
  assert.throws(() => api.generateSketch(sample({restEnabled:true,restMin:10})), /Rest frequency/);
});

test("the sample timeline is deterministic and within five minutes", () => {
  const events = api.simulateSchedule(sample());
  assert.ok(events.length > 3);
  assert.ok(events.every(x => x.time > 0 && x.time < 300));
  assert.deepEqual(events.map(x => x.time), api.simulateSchedule(sample()).map(x => x.time));
});
