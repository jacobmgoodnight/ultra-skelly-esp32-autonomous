const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),prep=require('../audio-prep.js');
function page({unsupported=false,decode=null,encoding=null}={}){
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]),nodes=Object.fromEntries(ids.map(id=>[id,{value:'',disabled:false,hidden:false,files:[],textContent:'',pause(){this.paused=true;},load(){},removeAttribute(){},getContext(){return {clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};}}]));
 const events={},sent=[],revoked=[],windowEvents={};let encoded=0,closed=0;
 const source={duration:4,numberOfChannels:2,getChannelData:()=>new Float32Array(16000)};
 const document={getElementById:id=>nodes[id],addEventListener:(id,fn)=>events[id]=fn,dispatchEvent:e=>sent.push(e),createElement:()=>({click(){}})};
 class Audio{async decodeAudioData(){return decode?await decode:source;}async close(){closed++;}}
 class Offline{constructor(_,length){this.length=length;}createBufferSource(){return {connect(){},start(){}};}async startRendering(){return {getChannelData:()=>new Float32Array(this.length)};}}
 const window={SkellyAudioPrep:{...prep,encode:async()=>{encoded++;return encoding?await encoding:new Uint8Array([1,2,3]);}},SkellyAudio:{inspectMp3:()=>({duration:2.2,guard:21})},lamejs:{Mp3Encoder:class{}},AudioContext:unsupported?null:Audio,OfflineAudioContext:Offline,addEventListener:(name,fn)=>windowEvents[name]=fn};
 vm.runInNewContext(fs.readFileSync(path.join(root,'audio-prep-ui.js'),'utf8'),{document,window,AbortController,Uint8Array,Blob,URL:{createObjectURL:()=> 'blob:local-qa',revokeObjectURL:v=>revoked.push(v)},CustomEvent:class{constructor(type,init){this.type=type;this.detail=init.detail;}},Date});events.DOMContentLoaded();
 return {nodes,sent,revoked,windowEvents,get encoded(){return encoded;},get closed(){return closed;},async choose(){nodes.audioPrepSource.files=[{size:1000,name:'Voice.wav',arrayBuffer:async()=>new ArrayBuffer(8)}];return nodes.audioPrepSource.onchange();}};
}
test('conversion is explicit, silent, local and invalidated after trim edits',async()=>{
 const p=page();assert.equal(p.encoded,0);await p.choose();assert.equal(p.closed,1);p.nodes.audioPrepStart.value='0.5';p.nodes.audioPrepEnd.value='2.5';await p.nodes.audioPrepConvert.onclick();
 assert.equal(p.encoded,1);assert.equal(p.nodes.audioPrepPlayer.paused,true);assert.equal(p.nodes.audioPrepUse.disabled,false);assert.equal(p.sent.length,0);
 p.nodes.audioPrepUse.onclick();assert.equal(p.sent[0].type,'skelly-audio-prepared');p.nodes.audioPrepStart.oninput();assert.equal(p.nodes.audioPrepUse.disabled,true);assert.equal(p.nodes.audioPrepPlayer.hidden,true);assert.equal(p.revoked.length,1);
});
test('cancelled decode and encoding cannot publish late results',async()=>{
 let release;const decode=new Promise(r=>release=r),p=page({decode}),pending=p.choose();p.nodes.audioPrepCancel.onclick();release({duration:4,numberOfChannels:1,getChannelData:()=>new Float32Array(16000)});await pending;assert.equal(p.nodes.audioPrepConvert.disabled,true);assert.equal(p.closed,1);
 let finish;const encoding=new Promise(r=>finish=r),q=page({encoding});await q.choose();q.nodes.audioPrepStart.value='0';q.nodes.audioPrepEnd.value='2';const preparing=q.nodes.audioPrepConvert.onclick();await new Promise(r=>setImmediate(r));q.nodes.audioPrepCancel.onclick();finish(new Uint8Array([1]));await preparing;assert.equal(q.nodes.audioPrepUse.disabled,true);assert.equal(q.sent.length,0);assert.match(q.nodes.audioPrepStatus.textContent,/cancelled/);
});
test('unsupported decoders and invalid trim leave prepared actions disabled',async()=>{
 const p=page({unsupported:true});await p.choose();assert.match(p.nodes.audioPrepStatus.textContent,/unavailable/);assert.equal(p.nodes.audioPrepConvert.disabled,true);
 const q=page();await q.choose();q.nodes.audioPrepStart.value='3';q.nodes.audioPrepEnd.value='2';await q.nodes.audioPrepConvert.onclick();assert.equal(q.encoded,0);assert.equal(q.nodes.audioPrepUse.disabled,true);assert.match(q.nodes.audioPrepStatus.textContent,/selection/);
});
