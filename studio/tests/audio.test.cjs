const test=require('node:test'),assert=require('node:assert/strict');
const a=require('../audio.js');
function reply(tag,payload=[],padding=8){const b=[0xbb,tag,...payload];while(b.length<2+padding)b.push(0);return new Uint8Array([...b,a.crc(b)]);}
function be(n,w){return Array.from({length:w},(_,i)=>(n/2**(8*(w-i-1)))&255);}
function record(file,total){const p=[...be(file.serial,2),...be(file.cluster,4),...be(total,2),0,0,file.action];
 for(let i=0;i<6;i++){const l=file.lights[i]??file.lights[0];p.push(l.mode,l.brightness,...[1,3,5].map(o=>parseInt(l.color.slice(o,o+2),16)),l.cycle??0,l.speed);}
 p.push(file.eye,0,0x5c,0x55,...[...file.name].flatMap(c=>[c.charCodeAt(0),0]));return reply(0xd0,p,0);}
function clip(name='Greeting.mp3'){return {serial:7,cluster:42,name,action:0,eye:1,lights:[0,1].map(()=>({mode:1,brightness:255,color:'#b28df9',speed:129,cycle:0}))};}
function mp3(frames=300){const b=new Uint8Array(frames*288);for(let i=0;i<frames;i++)b.set([255,227,72,192],i*288);return b;}
function fake({files=[clip()],dropChunk=false,endFail=false,ignoreSettings=false,noCapacity=false,holdConnect=false}={}){
 const writes=[],events=new Map(),notifications=new Set();let pending=null,connecting;
 const notify={addEventListener:(_,fn)=>notifications.add(fn),removeEventListener:(_,fn)=>notifications.delete(fn),async startNotifications(){}};
 function emit(bytes){const padded=new Uint8Array(bytes.length+4);padded.set(bytes,2);for(const fn of [...notifications])fn({target:{value:new DataView(padded.buffer,2,bytes.length)}});}
 const writer={async writeValueWithoutResponse(bytes){
  writes.push(bytes.slice());assert.equal(a.crc(bytes.slice(0,-1)),bytes.at(-1));const tag=bytes[1];
  if(tag===0xd2){if(!noCapacity)emit(reply(tag,[...be(10000,4),files.length]));}
  else if(tag===0xd0){for(const file of files)emit(record(file,files.length));}
  else if(tag===0xc0){let name='';for(let i=10;i<bytes.length-1;i+=2)name+=String.fromCharCode(bytes[i]);pending={...clip(name),serial:8,cluster:43};emit(reply(tag,[0,0,0,0,0]));}
  else if(tag===0xc1){if(dropChunk)emit(reply(tag,[0,0]));}
  else if(tag===0xc2)emit(reply(tag,[endFail?1:0]));
  else if(tag===0xc3){files.push(pending);emit(reply(tag,[0]));}
  else if(!ignoreSettings){const f=files[0];if(tag===0xca)f.action=bytes[2];if(tag===0xf9)f.eye=bytes[2];
    const l=f.lights[bytes[2]];if(tag===0xf2)l.mode=bytes[3];if(tag===0xf3)l.brightness=bytes[3];if(tag===0xf6)l.speed=bytes[3];if(tag===0xf4){l.color='#'+Array.from(bytes.slice(3,6),b=>b.toString(16).padStart(2,'0')).join('');l.cycle=bytes[6];}}
 }};
 const gatt={connected:false,async connect(){if(holdConnect)await new Promise(r=>connecting=r);this.connected=true;return this;},disconnect(){this.connected=false;events.get('gattserverdisconnected')?.();},async getPrimaryService(){return {getCharacteristic:async uuid=>uuid.includes('ae01')?writer:notify};}};
 const device={gatt,addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name);}};
 const bluetooth={async requestDevice(options){assert.deepEqual(options.filters,[{name:'Ultra Skelly v2'}]);return device;}};
 const session=new a.Session(bluetooth,{sleep:async()=>{},timeout:25,listTimeout:30});return {session,writes,emit,files,device,releaseConnect:()=>connecting?.(),listeners:notifications};
}
test('prepared MP3 inspection validates complete frames, supported encoding, duration and tags',()=>{
 assert.deepEqual(a.inspectMp3(mp3()),{duration:21.6,guard:24,bytes:86400});assert.equal(a.inspectMp3(mp3(1)).guard,21);
 const bad=mp3();bad[2]=80;assert.throws(()=>a.inspectMp3(bad),/8 kHz/);assert.throws(()=>a.inspectMp3(mp3().subarray(0,500)),/Incomplete/);assert.throws(()=>a.inspectMp3(mp3(1700)),/118 seconds/);
 const tagged=new Uint8Array(10+mp3().length);tagged.set([73,68,51,4,0,0,0,0,0,0]);tagged.set(mp3(),10);assert.equal(a.inspectMp3(tagged).guard,24);
 assert.throws(()=>a.filename('../x.mp3'));assert.throws(()=>a.filename('x'.repeat(33)+'.mp3'));assert.throws(()=>a.inspectMp3(new Uint8Array(1048577)));
});
test('notifications require CRC and full bounded metadata; offset DataViews preserve exact bytes',async()=>{
 const p=fake();await p.session.connect('Ultra Skelly v2');assert.equal(p.session.files[0].name,'Greeting.mp3');assert.equal(p.session.capacity,10240000);
 const b=record(clip(),1);assert.equal(a.fileInfo(b).cluster,42);b[b.length-1]^=1;assert.equal(a.packet(b),null);assert.throws(()=>a.fileInfo(new Uint8Array(5)));p.session.disconnect();assert.equal(p.listeners.size,0);
});
test('empty file lists complete without hanging or inventing a file serial',async()=>{const p=fake({files:[]});await p.session.connect('Ultra Skelly v2');assert.deepEqual(p.session.files,[]);assert.equal(p.writes.filter(b=>b[1]===0xd0).length,0);p.session.disconnect();});
test('new upload uses actual device serial after commit and complete refreshed list',async()=>{
 const p=fake();await p.session.connect('Ultra Skelly v2');const progress=[];const file=await p.session.upload(mp3(10),'New.mp3',n=>progress.push(n));assert.equal(file.serial,8);assert.equal(file.cluster,43);assert.equal(file.guard,21);assert.equal(progress.at(-1),100);
 const tags=p.writes.map(b=>b[1]);assert.ok(tags.indexOf(0xc0)<tags.indexOf(0xc1));assert.ok(tags.indexOf(0xc1)<tags.indexOf(0xc2));assert.ok(tags.indexOf(0xc2)<tags.indexOf(0xc3));p.session.disconnect();
});
test('existing names never overwrite; dropped chunks and rejected completion never report success',async()=>{
 for(const options of [{},{dropChunk:true},{endFail:true}]){const p=fake(options);await p.session.connect('Ultra Skelly v2');await assert.rejects(p.session.upload(mp3(2),Object.keys(options).length?'New.mp3':'greeting.MP3'));assert.equal(p.session.connected,false);if(!Object.keys(options).length)assert.equal(p.writes.some(b=>b[1]===0xc0),false);assert.equal(p.files.length,1);}
});
test('clip settings save motor flags, eyes, both channel effects and verify read-back',async()=>{
 const p=fake();await p.session.connect('Ultra Skelly v2');const expected={action:7,eye:8,lights:[{mode:3,brightness:155,color:'#001122',speed:125},{mode:2,brightness:200,color:'#aabbcc',speed:250}]};
 const saved=await p.session.save(p.session.files[0],expected);assert.ok(a.sameSettings(saved,a.settings(expected)));assert.equal(saved.lights[0].speed,129);assert.equal(saved.action,7);p.session.disconnect();
});
test('metadata mismatch and changed file identity fail closed without claiming saved',async()=>{
 const p=fake({ignoreSettings:true});await p.session.connect('Ultra Skelly v2');await assert.rejects(p.session.save(p.session.files[0],{action:1,eye:9,lights:[0,1].map(()=>({mode:1,brightness:255,color:'#112233',speed:125}))}),/read-back/);assert.equal(p.session.connected,false);
 const q=fake();await q.session.connect('Ultra Skelly v2');const old={...q.session.files[0]};q.files[0].cluster=88;await assert.rejects(q.session.save(old,{action:0,eye:1,lights:[0,1].map(()=>({mode:1,brightness:255,color:'#112233',speed:125}))}),/changed/);assert.equal(q.writes.some(b=>b[1]===0xca),false);
});
test('timeout and cancellation clear waiters and ignore late replies; operations remain exclusive',async()=>{
 const p=fake({noCapacity:true});const connecting=p.session.connect('Ultra Skelly v2');await assert.rejects(p.session.refresh(),/current audio operation/);await assert.rejects(connecting,/reply/);assert.equal(p.session.waiters.size,0);assert.equal(p.session.connected,false);p.emit(reply(0xd2,[0,0,1,0,0]));assert.deepEqual(p.session.files,[]);
 const q=fake({holdConnect:true});const waiting=q.session.connect('Ultra Skelly v2');await new Promise(r=>setImmediate(r));q.session.cancel();await assert.rejects(waiting,/cancelled/);q.releaseConnect();await new Promise(r=>setImmediate(r));assert.equal(q.device.gatt.connected,false);assert.equal(q.session.busy,false);
});
test('explicit audio routine uses selected own-device serial and safe ownership settings without replacing ordinary look',()=>{
 const c={headEnabled:true,headMin:60,eyesEnabled:true,eyeChoices:[4],torsoColor:'#123456',overlap:true,jawFollowupMotor:3};const next=a.audioRoutine(c,{serial:27},32,180,300);
 assert.equal(next.jawFile,27);assert.equal(next.eyeJawMode,3);assert.equal(next.overlap,false);assert.equal(next.jawFollowupMotor,0);assert.equal(next.lightRestoreMode,1);assert.equal(next.headMin,60);assert.equal(next.torsoColor,'#123456');assert.equal(c.overlap,true);assert.throws(()=>a.audioRoutine(c,{serial:0},32,180,300));assert.throws(()=>a.audioRoutine(c,{serial:27},20,180,300));
});

test('incomplete duplicate file lists and cancellation during upload never enable a completed file',async()=>{
 const p=fake({files:[clip(),clip()]});await assert.rejects(p.session.connect('Ultra Skelly v2'),/reply/);assert.deepEqual(p.session.files,[]);
 const q=fake();await q.session.connect('Ultra Skelly v2');q.session.sleep=async()=>q.session.cancel();await assert.rejects(q.session.upload(mp3(5),'New.mp3'),/cancelled|disconnected/);assert.equal(q.writes.some(b=>b[1]===0xc3),false);assert.equal(q.session.waiters.size,0);
});

test('read-back accepts the device’s equivalent fastest effect speed encodings',()=>{
 const expected=a.settings({action:0,eye:1,lights:[0,1].map(()=>({mode:3,brightness:255,color:'#b28df9',speed:254}))});
 const f=clip();f.lights=f.lights.map(l=>({...l,mode:3,speed:255}));assert.equal(a.sameSettings(f,expected),true);
});
