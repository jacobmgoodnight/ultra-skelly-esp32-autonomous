const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {createPack}=require("../../scripts/export-attended-tests.cjs");
const root=path.resolve(__dirname,"../..");
const output=path.join(root,".skelly-build/attended-pack-test");
test("attended pack keeps isolated tests free of body movement and preserves routine guards",()=>{
  const pack=createPack(output);
  assert.equal(pack.tests.length,11);
  for(const test of pack.tests) {
    const c=test.config;
    const source=fs.readFileSync(path.join(output,test.name,test.name+".ino"),"utf8");
    assert.equal(crypto.createHash("sha256").update(source).digest("hex"),test.sha256);
    assert.match(source,new RegExp("ATTENDED TEST: "+test.name));
    assert.equal(c.diagnosticsEnabled,true);
    assert.equal(c.jawProtectBody,true);
    assert.notEqual(c.jawFollowupMotor,4);
    assert.equal(c.bodyOverlap,false);
    if(!["Test06_MotorsLights","Test07_AddEyes","Test09_Compound"].includes(test.name)) {
      assert.equal(c.headEnabled||c.armEnabled||c.torsoEnabled,false);
      assert.match(source,/const bool HEAD_ENABLED = false;/);
      assert.match(source,/const bool ARM_ENABLED = false;/);
      assert.match(source,/const bool TORSO_ENABLED = false;/);
    }
    if(["Test06_MotorsLights","Test07_AddEyes"].includes(test.name)) {
      assert.equal(c.jawFollowupMotor,3);assert.equal(c.jawFollowupRecurring,true);
      assert.equal(c.compoundEnabled,false);assert.equal(c.lightRestoreMode,1);
    }
  }
  const first=pack.tests[0].config;
  assert.equal(first.jawFile,13);assert.equal(first.jawMin,60);assert.equal(first.jawMax,60);
  assert.equal(first.lightsEnabled||first.eyesEnabled||first.restEnabled,false);
  const compound=pack.tests.find(t=>t.name==="Test09_Compound").config;
  assert.equal(compound.jawEnabled,false);assert.equal(compound.jawFollowupMotor,0);
  assert.equal(compound.compoundMin,180);assert.equal(compound.compoundMax,360);
  const repeated=createPack(output);
  assert.deepEqual(repeated.tests.map(t=>t.sha256),pack.tests.map(t=>t.sha256));
});
