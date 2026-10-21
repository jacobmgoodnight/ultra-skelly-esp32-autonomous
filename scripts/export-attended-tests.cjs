const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm"),crypto=require("node:crypto");
const {cases,clips}=require("./attended-tests.cjs");
const root=path.resolve(__dirname,"..");
function createPack(outputRoot=path.join(root,".skelly-build/attended-tests")) {
  const context=vm.createContext({window:{}});
  for(const file of ["studio/template.js","studio/app.js"])vm.runInContext(fs.readFileSync(path.join(root,file),"utf8"),context);
  const api=context.window.SkellyStudioGenerator;
  const manifest={version:1,board:"esp32:esp32:esp32",core:"3.3.12",baud:115200,clips,tests:[]};
  fs.mkdirSync(outputRoot,{recursive:true});
  fs.copyFileSync(path.join(root,"docs/attended-test-pack.md"),path.join(outputRoot,"START-HERE.md"));
  for(const test of cases) {
    const config={...api.DEFAULTS,...test.options};
    const header=`// ATTENDED TEST: ${test.name} - ${test.title}\n// Original owner's clips: 12 chatter / 13 long open / 14 whisper and gasp.\n// ${test.optional?"OPTIONAL EXPERIMENT":"ORDERED TEST"}: physical result still untested for this configuration.\n// Read TEST-CARD.md; approximately ${test.minutes} minutes AFTER connection.\n`;
    const source=header+api.generateSketch(config);
    const directory=path.join(outputRoot,test.name);
    fs.mkdirSync(directory,{recursive:true});
    fs.writeFileSync(path.join(directory,test.name+".ino"),source);
    fs.writeFileSync(path.join(directory,"Studio-settings.json"),api.createProfile(config,clips));
    fs.writeFileSync(path.join(directory,"TEST-CARD.md"),`# ${test.name}: ${test.title}\n\nESP32 Dev Module; core 3.3.12; Serial Monitor 115200; Core Debug Level None.\n\nObserve about ${test.minutes} minutes after connection (extend for retries).\n\n${test.observe}\n\nThese are continuous sketches: stop manually when observation is complete. Stop immediately for abnormal movement, binding or unexpected activation. Confirm every used MP3 has saved head/arm/torso flags 0x00; turn the volume knob down for silence.\n\nReport visible behavior separately from logs. A BLE write is not device confirmation. Save complete output from boot and the test name; read START-HERE.md before moving to the next test.\n`);
    manifest.tests.push({...test,config,sha256:crypto.createHash("sha256").update(source).digest("hex")});
  }
  fs.writeFileSync(path.join(outputRoot,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
  return manifest;
}
if(require.main===module) {
  const manifest=createPack(process.argv[2]?path.resolve(process.argv[2]):undefined);
  console.log(`Exported ${manifest.tests.length} attended test sketches (core ${manifest.core}).`);
}
module.exports={createPack};
