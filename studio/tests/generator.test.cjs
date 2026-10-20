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
  assert.doesNotMatch(sketch, /uint8_t frame\[11\] = \{0xAA, 0xCA, 0x04/);
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
  assert.doesNotMatch(sketch, /uint8_t frame\[11\] = \{0xAA, 0xCA, 0x04/);
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
  assert.match(sketch, /reached\(now, headMovingUntil\) && reached\(now, mouthPlayingUntil\)/);
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
