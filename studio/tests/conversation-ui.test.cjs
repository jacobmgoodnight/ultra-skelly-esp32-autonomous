const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../conversation.html'),'utf8'),source=fs.readFileSync(path.join(__dirname,'../conversation-ui.js'),'utf8');
function fixture({supported=true}={}){
 const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],{disabled:false,checked:false,value:match[1]==='voice'?'original':match[1]==='sensitivity'?'0.025':'',textContent:''}]));
 const events={},mediaEvents={},windowEvents={},timers=new Map(),requests=[],calls=[];let next=0,turn,repeat;
 class Repeat{constructor({onChange}){repeat=this;this.state='idle';this.draw=onChange;}stop(){calls.push('discard');this.state='idle';this.draw();}}
 class Turn{constructor(options){turn=this;this.options=options;this.active=false;this.remaining=0;this.message='Ready';}async start(value){calls.push('start:'+value);this.active=true;this.capture={stream:{getAudioTracks:()=>[{label:'Laptop mic'}]}};this.options.onChange();}stop(){this.active=false;this.capture=null;this.replyText='';this.options.onLevel(0,0,'off');repeat.stop();this.options.onChange();}changed(){}}
 const document={hidden:false,getElementById:id=>{assert.ok(nodes[id],id);return nodes[id];},addEventListener:(name,fn)=>events[name]=fn};
 const window={isSecureContext:supported,MediaRecorder:{},AudioContext:supported?{}:null,AudioWorkletNode:supported?{}:null,SkellyTalkback:{RepeatBack:Repeat},SkellyTalkbackAuto:{wav(){},SpeechGate:class{},PcmCapture:class{}},SkellyConversation:{Conversation:Turn,readJSON:async response=>response.value},addEventListener:(name,fn)=>windowEvents[name]=fn};
 vm.runInNewContext(source,{document,window,navigator:{mediaDevices:{getUserMedia(){calls.push('unexpected mic');},addEventListener:(name,fn)=>mediaEvents[name]=fn}},AbortController,fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})),setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimeout:id=>timers.delete(id)});
 return {nodes,document,events,windowEvents,mediaEvents,requests,calls,timers,turn,repeat};
}
test('conversation page stays silent until local check, attendance and an explicit Talk',async()=>{
 const p=fixture();assert.deepEqual(p.requests,[]);assert.deepEqual(p.calls,[]);assert.equal(p.nodes.talk.disabled,true);p.nodes.talk.onclick();assert.deepEqual(p.calls,[]);
 const check=p.nodes.check.onclick();assert.equal(p.requests[0].url,'/api/status');p.requests[0].resolve({ok:true,value:{ready:true,token:'test-only'}});await check;assert.equal(p.nodes.talk.disabled,true);
 p.nodes.attending.checked=true;p.nodes.attending.onchange();assert.equal(p.nodes.talk.disabled,false);p.nodes.talk.onclick();assert.ok(p.calls.includes('start:0.025'));assert.match(p.nodes.mic.textContent,/Laptop mic/);assert.equal(p.nodes.voice.disabled,true);assert.equal(p.nodes.check.disabled,true);
});
test('late service checks cannot rearm Talk after Stop or hidden page',async()=>{
 for(const mode of ['stop','hide']){
  const p=fixture(),check=p.nodes.check.onclick();p.nodes.attending.checked=true;if(mode==='stop')p.nodes.stop.onclick();else{p.document.hidden=true;p.events.visibilitychange();}
  assert.equal(p.requests[0].options.signal.aborted,true);p.requests[0].resolve({ok:true,value:{ready:true,token:'late'}});await check;assert.equal(p.nodes.talk.disabled,true);assert.equal(p.turn.active,false);
 }
});
test('device changes stop a turn and approved reply text is always rendered literally',()=>{
 const p=fixture();p.turn.replyText='<img src=x onerror=bad()> Hi, Emma!';p.turn.options.onChange();assert.equal(p.nodes.reply.textContent,p.turn.replyText);
 p.turn.active=true;p.mediaEvents.devicechange();assert.equal(p.turn.active,false);assert.equal(p.nodes.reply.textContent,'');assert.equal(p.nodes.mic.textContent,'Microphone OFF');
});
test('local service failure and unsupported capture leave Talk disabled',async()=>{
 const p=fixture(),check=p.nodes.check.onclick();p.requests[0].resolve({ok:false,value:{}});await check;assert.equal(p.nodes.talk.disabled,true);assert.match(p.nodes.service.textContent,/8766/);
 const unsupported=fixture({supported:false});assert.equal(unsupported.nodes.talk.disabled,true);assert.match(unsupported.nodes.service.textContent,/Chrome/);
});
test('local shutdown stops the turn and uses only the authenticated local endpoint',async()=>{
 const p=fixture(),check=p.nodes.check.onclick();p.requests[0].resolve({ok:true,value:{ready:true,token:'test-only'}});await check;
 const stopping=p.nodes.shutdown.onclick();assert.equal(p.requests[1].url,'/api/shutdown');assert.equal(p.requests[1].options.headers['X-Skelly-Token'],'test-only');assert.equal(p.turn.active,false);assert.equal(p.nodes.talk.disabled,true);
 p.requests[1].resolve({ok:true});await stopping;assert.match(p.nodes.service.textContent,/is stopping/);assert.equal(p.nodes.shutdown.disabled,true);
});
