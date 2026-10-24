const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),prep=require('../audio-prep.js'),audio=require('../audio.js'),status=require('../controller-state.js'),release=require('../release.js'),model=require('../scene-model.js');
const c=vm.createContext({window:{}});for(const file of ['template.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);const g=c.window.SkellyStudioGenerator;
test('local encoder produces actual Skelly-format MP3 frames and padded estimate',async()=>{
 const v=vm.createContext({console,Int16Array,Int32Array,Float32Array,Float64Array,Uint8Array,ArrayBuffer});vm.runInContext(fs.readFileSync(path.join(root,'vendor/lamejs-1.2.1/lame.min.js'),'utf8'),v);
 const samples=Float32Array.from({length:24000},(_,i)=>Math.sin(2*Math.PI*220*i/8000)*.25),bytes=await prep.encode(samples,v.lamejs.Mp3Encoder,{pause:async()=>{}}),info=audio.inspectMp3(bytes);
 assert.ok(info.duration>=3&&info.duration<3.3);assert.equal(info.guard,21);assert.ok(bytes.length>12000);
 const controller=new AbortController();controller.abort();await assert.rejects(prep.encode(samples,v.lamejs.Mp3Encoder,{signal:controller.signal}),/cancelled/);
});
test('trim bounds, PCM clipping, channel mixing and library provenance are bounded',()=>{
 for(const args of [[3,-1,2],[3,0,4],[130,0,118],[3,1,1],[601,0,1]])assert.throws(()=>prep.range(...args));
 assert.deepEqual(prep.range(120,2,119),{start:2,end:119});assert.deepEqual([...prep.pcm16(Float32Array.of(-2,-1,0,1,2,NaN))],[-32768,-32768,0,32767,32767,0]);
 assert.ok(prep.peaks([Float32Array.of(1,-1),Float32Array.of(-1,1)],2).every(n=>n===0));
 const provenance=JSON.parse(fs.readFileSync(path.join(root,'vendor/lamejs-1.2.1/provenance.json'),'utf8'));for(const [name,hash]of Object.entries(provenance.files))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'vendor/lamejs-1.2.1',name))).digest('hex'),hash);
});
test('friendly audio labels round trip in browser profiles without changing wire settings',()=>{
 const config=audio.audioRoutine({...g.DEFAULTS},{serial:42},32,180,300),ref={name:'Porch greeting.mp3',serial:42,cluster:900,device:config.bleName};
 const profile=g.parseProfile(g.createProfile(config,{},ref));assert.equal(profile.audio.name,ref.name);
 const runtime=require('../runtime.js'),plain=g.parseProfile(g.createProfile(config,{},null));assert.deepEqual(runtime.encode([{name:'A',config:profile.config}],false,g.validate),runtime.encode([{name:'A',config:plain.config}],false,g.validate));
 assert.throws(()=>g.parseProfile(JSON.stringify({...profile,audio:{...ref,serial:1}})),/does not match/);assert.throws(()=>g.normalizeAudioReference({...ref,name:'bad\nfile'}));
 assert.equal(audio.identityChanged(ref,[{...ref}],ref.device),false);assert.equal(audio.identityChanged(ref,[{...ref,serial:43}],ref.device),true);assert.equal(audio.identityChanged(ref,[],ref.device),true);assert.equal(audio.identityChanged(ref,[],'Other'),false);
});
test('scene comparisons use each saved scene and preserve friendly audio names',()=>{
 const a=model.starter('moonlit',g),b=model.starter('haunted',g),config=audio.audioRoutine({...g.DEFAULTS},{serial:42},32,180,300);b.profile=g.parseProfile(g.createProfile(config,{}, {name:'Greeting.mp3',serial:42,cluster:900,device:config.bleName}));
 const rows=model.comparisonRows({scenes:[a,b]});assert.match(rows[0][2],/Head 60–120s/);assert.match(rows[1][2],/Arm 150–240s/);assert.match(rows[1][5],/Greeting.mp3/);assert.equal(rows[0][5],'Off');
});
test('legacy status remains supported; new wait codes and stale views are explicit',()=>{
 const old='USB STATUS v2 connected=1 scene=0 sequence=1 pending=0',data=status.parseStatus(old+' firmware=5 build=2026102401 wait=8 jawMs=56000 accepted=1 acceptedAge=2000');
 assert.match(status.diagnosticView(data).flat().join(' '),/Audio scene protected window/);assert.match(status.diagnosticView(data,true).flat().join(' '),/Last reported/);assert.equal(status.diagnosticView(status.parseStatus(old)).length,0);
 for(const suffix of [' wait=9',' accepted=1',' accepted=2'])assert.throws(()=>status.parseStatus(old+suffix));
 assert.match(release.firmwareView(null,true,true).text,/version not reported/);assert.equal(release.firmwareView(data,true,true).update,false);assert.equal(release.firmwareView({...data,firmware:4},true,true).update,true);
 const canonical=fs.readFileSync(path.join(root,'../firmware/SkellyAutonomous/SkellyAutonomous.ino'),'utf8');assert.match(canonical,new RegExp('FIRMWARE_REVISION = '+release.REVISION));assert.match(canonical,new RegExp('FIRMWARE_BUILD = '+release.BUILD));assert.ok(canonical.includes(release.VERSION));assert.doesNotMatch(canonical,/SKELLY_WIRELESS_STATUS|setupWirelessStatus/);
});
