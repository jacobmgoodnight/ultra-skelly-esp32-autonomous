const test=require('node:test'),assert=require('node:assert/strict');
const {Capture,Session}=require('../serial.js');
test('identification retries HELLO lost during a USB-triggered boot and accepts split prefixed replies',async()=>{
 const s=new Session(null);s.port={};let attempts=0;
 s.send=async line=>{assert.equal(line,'\nSKELLY HELLO\n');if(++attempts===2){s.ingest(new TextEncoder().encode('[ 1535 ms] USB READY v1 CLOCK\n[ 1540 ms] USB CA'));s.ingest(new TextEncoder().encode('PS v2 settings=1 scenes=4\n'));}};
 const reply=await s.capabilities({timeout:1000,retry:5});assert.equal(attempts,2);assert.match(reply.text,/settings=1/);assert.equal(s.waiters.length,0);
});
test('identification times out with recovery guidance and sends no settings',async()=>{
 const s=new Session(null);s.port={};const sent=[];s.send=async line=>sent.push(line);
 await assert.rejects(s.capabilities({timeout:15,retry:5}),/EN\/Reset/);assert.ok(sent.length>=1);assert.ok(sent.every(line=>line==='\nSKELLY HELLO\n'));assert.equal(s.waiters.length,0);
});
test('identification ignores old capability messages and does not retry a transport error',async()=>{
 const s=new Session(null);s.port={};s.ingest(new TextEncoder().encode('USB CAPS v2 settings=1\n'));
 let count=0;s.send=async()=>{count++;throw Error('unplugged');};await assert.rejects(s.capabilities(),/unplugged/);assert.equal(count,1);assert.equal(s.waiters.length,0);
});
test('raw capture preserves split UTF-8, invalid bytes and bounded prefix',()=>{
  const c=new Capture(7);c.add(Uint8Array.from([0x41,0xe2]));c.add(Uint8Array.from([0x82,0xac,0xff,0,0x42,0x43]));
  assert.deepEqual([...c.bytes()],[0x41,0xe2,0x82,0xac,0xff,0,0x42]);
  assert.equal(c.text,'A€\uFFFD\0B');assert.equal(c.summary().discardedAfterLimit,1);
  c.clear();assert.equal(c.size,0);assert.equal(c.dropped,0);
});
test('clock refuses unknown firmware and releases writer on failure',async()=>{
  const s=new Session({});let released=0,written='';
  s.port={writable:{getWriter:()=>({write:async b=>{written=new TextDecoder().decode(b);},releaseLock:()=>released++})}};
  await assert.rejects(s.syncClock(),/advertised/);
  s.capture.add(new TextEncoder().encode('USB READY v1 CLOCK\n'));
  const at=new Date('2026-10-23T22:00:00Z');await s.syncClock(at);
  assert.equal(written,'SKELLY TIME '+(Math.floor(at.getTime()/1000)-at.getTimezoneOffset()*60)+'\n');assert.equal(released,1);
  s.port.writable.getWriter=()=>({write:async()=>{throw Error('unplugged')},releaseLock:()=>released++});
  await assert.rejects(s.syncClock(),/unplugged/);assert.equal(released,2);
});
test('session reads original bytes and closes locks on explicit disconnect',async()=>{
  let cancel,reads=0,releases=0,closes=0,options;
  const reader={read:async()=>++reads===1?{value:Uint8Array.from([0xff,65]),done:false}:new Promise(r=>cancel=()=>r({done:true})),cancel:async()=>cancel(),releaseLock:()=>releases++};
  const port={open:async o=>options=o,close:async()=>closes++,readable:{getReader:()=>reader}};
  const s=new Session({requestPort:async()=>port});await s.connect();await new Promise(r=>setImmediate(r));await s.disconnect();
  assert.equal(options.baudRate,115200);assert.deepEqual([...s.capture.bytes()],[0xff,65]);assert.equal(releases,1);assert.equal(closes,1);assert.equal(s.port,null);
});
test('canceled port chooser resets busy state',async()=>{
  const s=new Session({requestPort:async()=>{throw Error('canceled')}});
  await assert.rejects(s.connect(),/canceled/);assert.equal(s.busy,false);assert.equal(s.port,null);
});
test('EOF flushes an incomplete UTF-8 sequence without modifying original bytes',()=>{
  const c=new Capture();c.add(Uint8Array.from([0xe2]));c.finish();
  assert.equal(c.text,'\uFFFD');assert.equal(c.summary().decodedReplacementCharacters,1);assert.deepEqual([...c.bytes()],[0xe2]);
});
test('unplug/read failure releases the reader and closes the port',async()=>{
  let released=0,closed=0;
  const port={open:async()=>{},close:async()=>closed++,readable:{getReader:()=>({read:async()=>{throw Error('unplugged')},releaseLock:()=>released++})}};
  const s=new Session({requestPort:async()=>port});await s.connect();await s.readTask;
  assert.equal(s.port,null);assert.equal(released,1);assert.equal(closed,1);assert.equal(s.error,'unplugged');
});
