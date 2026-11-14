const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../experiments/pocket-conversation/chat.html'),'utf8'),source=fs.readFileSync(path.join(__dirname,'../experiments/pocket-conversation/chat-ui.js'),'utf8');
const {CueSchedule,ConversationSession}=require('../experiments/pocket-conversation/chat-turn.js');
function fixture({supported=true,mode}={}){
 const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],{disabled:false,checked:false,value:match[1]==='conversationMode'?'open':match[1]==='personality'?'friendly':match[1]==='tone'?'haunt-dry':match[1]==='voice'?'original':match[1]==='engine'?'local':match[1]==='sensitivity'?'0.025':'',textContent:''}]));
 const events={},mediaEvents={},windowEvents={},timers=new Map(),requests=[],calls=[];let next=0,turn,repeat;
 class Repeat{constructor({onChange}){repeat=this;this.state='idle';this.draw=onChange;}stop(){calls.push('discard');this.state='idle';this.draw();}}
 class Turn{constructor(options){turn=this;this.options=options;this.active=false;this.phase='idle';this.completed=0;this.generation=0;this.remaining=0;this.message='Ready';}async start(value,options){calls.push('start:'+value);this.startOptions=options;++this.generation;this.active=true;this.phase='requesting';this.capture={stream:{getAudioTracks:()=>[{label:'Laptop mic'}]}};this.options.onChange();}stop(){++this.generation;this.active=false;this.phase='idle';this.capture=null;this.replyText='';this.options.onLevel(0,0,'off');repeat.stop();this.options.onChange();}changed(){}}
 const document={hidden:false,getElementById:id=>{assert.ok(nodes[id],id);return nodes[id];},addEventListener:(name,fn)=>events[name]=fn};
 const window={crypto:{randomUUID:()=> 'browser-id-'+String(++next).padStart(16,'0')},isSecureContext:supported,MediaRecorder:{},AudioContext:supported?{}:null,AudioWorkletNode:supported?{}:null,SkellyTalkback:{RepeatBack:Repeat},SkellyTalkbackAuto:{wav(){},PcmCapture:class{}},SkellyAdaptiveMic:{gainManagedMedia:m=>m,AdaptiveSpeechGate:class{},normalizePhrase:s=>s},SkellyConversation:{Conversation:Turn,ConversationSession,ThinkingCue:class{},CueSchedule:class extends CueSchedule{constructor(){super({random:()=>0,now:()=>100000});}},decodeCue:value=>new Blob([value.audio]),readJSON:async response=>response.value},addEventListener:(name,fn)=>windowEvents[name]=fn};
 vm.runInNewContext(source,{document,window,navigator:{mediaDevices:{getUserMedia(){calls.push('unexpected mic');},addEventListener:(name,fn)=>mediaEvents[name]=fn}},AbortController,fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})),setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimeout:id=>timers.delete(id)});
 if(mode)nodes.conversationMode.value=mode; // as if the operator had already chosen it in Advanced
 return {nodes,document,events,windowEvents,mediaEvents,requests,calls,timers,turn,repeat};
}


async function ready(p,status={}){const checking=p.nodes.check.onclick();p.requests[0].resolve({ok:true,value:{ready:true,token:'test-only',conversation:true,familyCatalog:true,brain:'local test',voice:'Pocket E',...status}});await checking;p.nodes.attending.checked=true;p.nodes.attending.onchange();}
test('family mode resets the visit, requires local services, and labels reviewed replies',async()=>{
 const p=fixture();await ready(p,{cloud:{brain:true,voice:true}});p.nodes.conversationMode.value='family';p.nodes.conversationMode.onchange();
 assert.equal(p.requests[1].url,'/api/forget');assert.equal(p.nodes.brainMode.disabled,true);assert.equal(p.nodes.engine.disabled,true);
 p.nodes.talk.onclick();const pending=p.turn.options.request(new Blob(['audio']),new AbortController().signal);
 const request=p.requests.find(r=>r.url==='/api/reply');assert.equal(request.options.headers['X-Skelly-Conversation'],'family');request.resolve({ok:true,value:{responseMode:'family'}});await pending;
 p.nodes.stop.onclick();p.nodes.brainMode.value='cloud';p.nodes.cloudConsent.checked=true;p.nodes.cloudConsent.onchange();assert.equal(p.nodes.talk.disabled,true);
});
test('a fresh page starts in Family mode and sends only family turns',async()=>{
 const p=fixture();assert.equal(p.nodes.conversationMode.value,'family');await ready(p);
 assert.equal(p.nodes.profileGuardian.disabled,false);assert.equal(p.nodes.brainMode.disabled,true);assert.equal(p.nodes.talk.disabled,false);
 p.nodes.talk.onclick();const pending=p.turn.options.request(new Blob(['audio']),new AbortController().signal);
 const request=p.requests.find(r=>r.url==='/api/reply');assert.equal(request.options.headers['X-Skelly-Conversation'],'family');assert.equal(request.options.headers['X-Skelly-Brain'],'local');
 request.resolve({ok:true,value:{responseMode:'family'}});await pending;
});
test('a reviewed recording is labelled as the reviewed take, not as synthesis',async()=>{
 const p=fixture();await ready(p);p.nodes.talk.onclick();const pending=p.turn.options.request(new Blob(['audio']),new AbortController().signal);
 p.requests.find(r=>r.url==='/api/reply').resolve({ok:true,value:{responseMode:'family',source:'Reviewed recording · Qwen matched MOSS'}});await pending;
 assert.equal(p.nodes.voiceSource.textContent,'Last reply: Reviewed recording · Qwen matched MOSS. Reviewed family reply.');
});
test('without reviewed replies the default Family page explains the problem and never talks',async()=>{
 const p=fixture();await ready(p,{familyCatalog:false});assert.equal(p.nodes.talk.disabled,true);assert.match(p.nodes.service.textContent,/family replies are unavailable/i);
 p.nodes.talk.onclick();assert.ok(!p.calls.some(x=>x.startsWith('start:')));
});
test('an older companion without the family capability cannot enable family mode',async()=>{
 const p=fixture();await ready(p,{familyCatalog:undefined});assert.equal(p.nodes.familyModeOption.disabled,true);assert.match(p.nodes.familyStatus.textContent,/unavailable/);
 p.nodes.conversationMode.value='family';p.nodes.conversationMode.onchange();assert.equal(p.nodes.talk.disabled,true);p.nodes.talk.onclick();assert.ok(!p.calls.some(x=>x.startsWith('start:')));
});
test('family mode rejects a generated or missing response mode before playback',async()=>{
 for(const mode of ['generated',undefined]){
  const p=fixture();await ready(p);p.nodes.conversationMode.value='family';p.nodes.conversationMode.onchange();p.nodes.talk.onclick();p.turn.phase='thinking';p.turn.options.onChange();
  const pending=p.turn.options.request(new Blob(['audio']),new AbortController().signal),request=p.requests.find(r=>r.url==='/api/reply');request.resolve({ok:true,value:{responseMode:mode,responseReason:'greeting'}});
  await assert.rejects(pending,/did not return a reviewed family reply/);assert.equal(p.turn.phase,'thinking');
 }
});
test('guardian and storyteller are family-only and switching back resets the profile',async()=>{
 const p=fixture({mode:'open'});await ready(p);assert.equal(p.nodes.profileGuardian.disabled,true);p.nodes.conversationMode.value='family';p.nodes.conversationMode.onchange();
 assert.equal(p.nodes.profileGuardian.disabled,false);p.nodes.personality.value='guardian';p.nodes.personality.onchange();assert.equal(p.nodes.talk.disabled,false);
 p.nodes.conversationMode.value='open';p.nodes.conversationMode.onchange();assert.equal(p.nodes.personality.value,'friendly');assert.equal(p.nodes.profileGuardian.disabled,true);
 p.nodes.personality.value='storyteller';p.nodes.attending.onchange();assert.equal(p.nodes.talk.disabled,true);
});
test('chat stays silent and exposes both personalities only after readiness and attendance',async()=>{
 const p=fixture();assert.deepEqual(p.requests,[]);assert.deepEqual(p.calls,[]);assert.equal(p.nodes.talk.disabled,true);assert.equal(p.nodes.personality.value,'friendly');
 await ready(p);assert.equal(p.nodes.talk.disabled,false);p.nodes.talk.onclick();assert.equal(p.nodes.personality.disabled,true);assert.equal(p.turn.active,true);
});
test('completed turns keep context, but New visitor rotates the session and clears the old one',async()=>{
 const p=fixture({mode:'open'});await ready(p);p.nodes.talk.onclick();const a=p.turn.options.request(new Blob(['audio']),new AbortController().signal);const first=p.requests[1].options.headers;
 p.requests[1].resolve({ok:true,value:{responseMode:'generated',source:'pocket-e'}});await a;
 const b=p.turn.options.request(new Blob(['audio']),new AbortController().signal);assert.equal(p.requests[2].options.headers['X-Skelly-Session'],first['X-Skelly-Session']);p.requests[2].resolve({ok:true,value:{}});await b;
 p.nodes.forget.onclick();assert.equal(p.requests[3].url,'/api/forget');assert.equal(p.requests[3].options.headers['X-Skelly-Session'],first['X-Skelly-Session']);assert.equal(p.requests[3].options.headers['X-Skelly-Token'],'test-only');p.requests[3].resolve({ok:true});
 const c=p.turn.options.request(new Blob(['audio']),new AbortController().signal);assert.notEqual(p.requests[4].options.headers['X-Skelly-Session'],first['X-Skelly-Session']);p.requests[4].resolve({ok:true,value:{}});await c;
});
test('Stop preserves the visit, while a hidden page forgets; both cancel without adopting late results',async()=>{
 for(const mode of ['stop','hide']){
  const p=fixture({mode:'open'});await ready(p);p.nodes.talk.onclick();const abort=new AbortController();p.turn.stop=()=>{abort.abort();p.turn.active=false;};
  const pending=p.turn.options.request(new Blob(['audio']),abort.signal),identity=p.requests[1].options.headers['X-Skelly-Turn'];
  if(mode==='stop')p.nodes.stop.onclick();else{p.document.hidden=true;p.events.visibilitychange();}
  const reset=p.requests.find(x=>x.url==='/api/forget'),cancel=p.requests.find(x=>x.url==='/api/cancel');assert.equal(!!reset,mode==='hide');assert.ok(cancel);assert.equal(cancel.options.headers['X-Skelly-Turn'],identity);
  reset?.resolve({ok:true});cancel.resolve({ok:true});p.requests[1].resolve({ok:true,value:{source:'pocket-e'}});await pending;assert.doesNotMatch(p.nodes.voiceSource.textContent,/Last reply/);
 }
});
test('personality choice is sent as an enum with a fresh session',async()=>{
 const p=fixture({mode:'open'});await ready(p);p.nodes.personality.value='mischief';p.nodes.personality.onchange();p.requests[1].resolve({ok:true});p.nodes.talk.onclick();
 const pending=p.turn.options.request(new Blob(['audio']),new AbortController().signal);assert.equal(p.requests[2].options.headers['X-Skelly-Personality'],'mischief');p.requests[2].resolve({ok:true,value:{}});await pending;
});
test('a catalog-only server cannot enable the conversational UI',async()=>{
 const p=fixture(),checking=p.nodes.check.onclick();p.requests[0].resolve({ok:true,value:{ready:true,token:'wrong-mode'}});await checking;assert.equal(p.nodes.talk.disabled,true);
});
test('readiness caches cues silently, and the explicit checkbox controls the next Talk',async()=>{
 const p=fixture({mode:'open'}),checking=p.nodes.check.onclick();p.requests[0].resolve({ok:true,value:{ready:true,token:'test-only',conversation:true,thinkingCuesReady:true}});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(p.requests[1].url,'/api/thinking-cues');assert.deepEqual(p.calls,[]);
 p.requests[1].resolve({ok:true,value:{cues:[{id:'thinking',audio:'thinking'},{id:'moment',audio:'moment'},{id:'well',audio:'well'}]}});await checking;
 p.nodes.attending.checked=true;p.nodes.attending.onchange();p.nodes.thinkingCue.checked=true;p.nodes.talk.onclick();assert.equal(p.turn.startOptions.thinkingClip,null);assert.equal(p.nodes.thinkingCue.disabled,true);
 p.turn.stop();p.nodes.talk.onclick();assert.equal(p.turn.startOptions.thinkingClip.size,8);
 p.turn.stop();p.nodes.thinkingCue.checked=false;p.nodes.talk.onclick();assert.equal(p.turn.startOptions.thinkingClip,null);
});

test('hands-free is opt-in and starts short-gap turns only after attendance and Talk',async()=>{
 const p=fixture();assert.equal(p.nodes.handsFree.checked,false);await ready(p);p.nodes.handsFree.checked=true;p.nodes.handsFree.onchange();assert.equal(p.nodes.talk.textContent,'Start conversation');assert.deepEqual(p.calls,[]);
 try{p.nodes.talk.onclick();await Promise.resolve();assert.equal(p.turn.startOptions.noPause,true);assert.equal(p.nodes.handsFree.disabled,true);assert.equal(p.nodes.talk.disabled,true);}
 finally{p.nodes.stop.onclick();}
 assert.equal(p.turn.active,false);
});

test('preview playback is exclusive, stops before capture and cannot overlap an active turn',async()=>{
 const p=fixture();const stopped=[];for(const key of ['previewDry','previewCroaky','previewCrypt'])p.nodes[key].pause=()=>stopped.push(key);
 p.nodes.previewDry.onplay();assert.deepEqual(stopped,['previewCroaky','previewCrypt']);stopped.length=0;
 await ready(p);p.nodes.talk.onclick();assert.equal(stopped.length,3);stopped.length=0;p.nodes.previewDry.onplay();assert.equal(stopped.length,3);p.nodes.stop.onclick();
});

test('cloud configuration is checked locally while every new page defaults to local without permission',async()=>{
 const p=fixture({mode:'open'});assert.equal(p.nodes.brainMode.value,'local');assert.equal(p.nodes.engine.value,'local');assert.equal(p.nodes.cloudConsent.checked,false);assert.equal(p.nodes.cloudConsent.disabled,true);assert.deepEqual(p.requests,[]);assert.deepEqual(p.calls,[]);
 await ready(p,{cloud:{brain:true,voice:true}});assert.deepEqual(p.requests.map(r=>r.url),['/api/status']);assert.equal(p.nodes.cloudBrainOption.disabled,false);assert.equal(p.nodes.cloudVoiceOption.disabled,false);assert.equal(p.nodes.brainMode.value,'local');assert.equal(p.nodes.engine.value,'local');assert.equal(p.nodes.cloudConsent.checked,false);assert.equal(p.nodes.talk.disabled,false);
 assert.match(html,/raw microphone audio stays local/);assert.match(html,/Provider billing and retention terms apply/);assert.doesNotMatch(html,/id="cloudVoiceOption"[^>]*hidden/);
});

test('unconfigured and forged cloud selections cannot enable Talk or hands-free',async()=>{
 const p=fixture();await ready(p,{elevenlabs:true});assert.equal(p.nodes.cloudBrainOption.disabled,true);assert.equal(p.nodes.cloudVoiceOption.disabled,true);
 for(const [brain,voice] of [['cloud','local'],['local','elevenlabs'],['forged','local'],['local','forged']]){
  p.nodes.brainMode.value=brain;p.nodes.engine.value=voice;p.nodes.cloudConsent.checked=true;p.nodes.cloudConsent.onchange();p.nodes.talk.onclick();assert.equal(p.nodes.talk.disabled,true);assert.ok(!p.calls.some(c=>c.startsWith('start:')));
 }
 p.nodes.handsFree.checked=true;p.nodes.handsFree.onchange();p.nodes.talk.onclick();assert.ok(!p.calls.some(c=>c.startsWith('start:')));assert.ok(p.requests.every(r=>r.url==='/api/status'));
});

test('selected cloud services need per-chat permission and send explicit bounded mode headers',async()=>{
 const p=fixture({mode:'open'});await ready(p,{cloud:{brain:true,voice:true}});p.nodes.brainMode.value='cloud';p.nodes.brainMode.onchange();assert.equal(p.requests[1].url,'/api/forget');assert.equal(p.nodes.talk.disabled,true);assert.equal(p.nodes.cloudConsent.checked,false);assert.equal(p.nodes.cloudConsent.disabled,false);assert.deepEqual(p.calls.filter(c=>c.startsWith('start:')),[]);assert.match(p.nodes.cloudDisclosure.textContent,/Claude receives recognized speech and recent chat/);
 p.nodes.engine.value='elevenlabs';p.nodes.engine.onchange();p.nodes.cloudDelivery.value='whispering';assert.equal(p.nodes.talk.disabled,true);assert.match(p.nodes.cloudDisclosure.textContent,/ElevenLabs receives Skelly/);
 p.nodes.cloudConsent.checked=true;p.nodes.cloudConsent.onchange();assert.equal(p.nodes.talk.disabled,false);p.nodes.talk.onclick();assert.equal(p.nodes.cloudConsent.disabled,true);assert.equal(p.nodes.brainMode.disabled,true);assert.equal(p.nodes.cloudDelivery.disabled,true);
 const pending=p.turn.options.request(new Blob(['audio']),new AbortController().signal),request=p.requests.find(r=>r.url==='/api/reply');assert.ok(request);assert.equal(request.options.headers['X-Skelly-Brain'],'cloud');assert.equal(request.options.headers['X-Skelly-Voice'],'elevenlabs');assert.equal(request.options.headers['X-Skelly-Cloud-Consent'],'yes');assert.equal(request.options.headers['X-Skelly-Delivery'],'whispering');request.resolve({ok:true,value:{source:'elevenlabs-v3',brainSource:'claude',responseMode:'generated'}});await pending;assert.match(p.nodes.voiceSource.textContent,/ElevenLabs · v3 · cloud voice\. Claude conversation/);assert.doesNotMatch(p.nodes.voiceSource.textContent,/Pocket|crypt skeleton/);
 p.nodes.stop.onclick();assert.equal(p.nodes.cloudConsent.checked,false);assert.equal(p.nodes.talk.disabled,true);
});

test('cloud voice uses normal playback and suppresses local thinking remarks',async()=>{
 const p=fixture({mode:'open'});await ready(p,{cloud:{brain:false,voice:true}});p.nodes.voice.value='deep';p.nodes.engine.value='elevenlabs';p.nodes.engine.onchange();p.nodes.cloudConsent.checked=true;p.nodes.cloudConsent.onchange();p.nodes.thinkingCue.checked=true;assert.equal(p.nodes.voice.value,'original');assert.equal(p.nodes.voice.disabled,true);assert.equal(p.nodes.tone.disabled,true);assert.equal(p.nodes.thinkingCue.disabled,true);assert.equal(p.nodes.cloudDelivery.disabled,false);
 p.nodes.talk.onclick();assert.equal(p.repeat.voice,'original');assert.equal(p.turn.startOptions.thinkingClip,null);p.turn.stop();p.nodes.talk.onclick();assert.equal(p.turn.startOptions.thinkingClip,null);p.nodes.stop.onclick();
});

test('cloud permission is cleared on new visitor, personality, service change, hidden page and Stop',async()=>{
 for(const change of ['forget','personality','brainMode','engine','hide','stop']){
  const p=fixture({mode:'open'});await ready(p,{cloud:{brain:true,voice:true}});p.nodes.brainMode.value='cloud';p.nodes.brainMode.onchange();p.nodes.cloudConsent.checked=true;p.nodes.cloudConsent.onchange();assert.equal(p.nodes.talk.disabled,false);
  if(change==='hide'){p.document.hidden=true;p.events.visibilitychange();}else if(['personality','brainMode','engine'].includes(change))p.nodes[change].onchange();else p.nodes[change].onclick();
  assert.equal(p.nodes.cloudConsent.checked,false,change);assert.equal(p.nodes.talk.disabled,true,change);assert.equal(p.requests.filter(r=>r.url==='/api/forget').length,change==='stop'?1:2,change);assert.ok(!p.calls.some(c=>c.startsWith('start:')),change);
 }
});

test('Stop keeps the completed page session so a later turn can still recall the visitor',async()=>{
 const p=fixture({mode:'open'});await ready(p);p.nodes.talk.onclick();
 const first=p.turn.options.request(new Blob(['audio']),new AbortController().signal),session=p.requests[1].options.headers['X-Skelly-Session'];p.requests[1].resolve({ok:true,value:{}});await first;
 p.nodes.stop.onclick();assert.equal(p.requests.some(r=>r.url==='/api/forget'),false);
 const next=p.turn.options.request(new Blob(['audio']),new AbortController().signal);assert.equal(p.requests[2].options.headers['X-Skelly-Session'],session);p.requests[2].resolve({ok:true,value:{}});await next;
});

test('cloud consent stays visible when needed, while irrelevant voice settings are hidden',async()=>{
 const p=fixture();assert.equal(p.nodes.cloudPanel.hidden,true);assert.equal(p.nodes.cloudDeliveryField.hidden,true);assert.equal(p.nodes.localControls.hidden,false);
 await ready(p,{cloud:{brain:true,voice:true}});p.nodes.engine.value='elevenlabs';p.nodes.engine.onchange();assert.equal(p.nodes.cloudPanel.hidden,false);assert.equal(p.nodes.cloudDeliveryField.hidden,false);assert.equal(p.nodes.localControls.hidden,true);assert.equal(p.nodes.cloudConsent.checked,false);
 p.nodes.engine.value='local';p.nodes.engine.onchange();assert.equal(p.nodes.cloudPanel.hidden,true);assert.equal(p.nodes.cloudDeliveryField.hidden,true);assert.equal(p.nodes.localControls.hidden,false);
});

test('hybrid cloud conversation keeps local voice controls while local mode sends no cloud permission',async()=>{
 const p=fixture({mode:'open'});await ready(p,{cloud:{brain:true,voice:true}});p.nodes.brainMode.value='cloud';p.nodes.brainMode.onchange();p.nodes.cloudConsent.checked=true;p.nodes.cloudConsent.onchange();assert.equal(p.nodes.voice.disabled,false);assert.equal(p.nodes.tone.disabled,false);assert.equal(p.nodes.thinkingCue.disabled,false);assert.equal(p.nodes.cloudDelivery.disabled,true);
 p.nodes.talk.onclick();const pending=p.turn.options.request(new Blob(['audio']),new AbortController().signal),request=p.requests.find(r=>r.url==='/api/reply');assert.equal(request.options.headers['X-Skelly-Voice'],'local');assert.equal(request.options.headers['X-Skelly-Brain'],'cloud');request.resolve({ok:true,value:{source:'pocket-haunt-dry',brainSource:'claude',responseMode:'generated'}});await pending;p.nodes.stop.onclick();p.nodes.brainMode.value='local';p.nodes.brainMode.onchange();p.nodes.talk.onclick();const local=p.turn.options.request(new Blob(['audio']),new AbortController().signal),localRequest=p.requests.filter(r=>r.url==='/api/reply').at(-1);assert.equal(localRequest.options.headers['X-Skelly-Brain'],'local');assert.equal(localRequest.options.headers['X-Skelly-Cloud-Consent'],undefined);localRequest.resolve({ok:true,value:{source:'pocket-haunt-dry',brainSource:'local',responseMode:'generated'}});await local;p.nodes.stop.onclick();
});

test('withdrawn cloud permission blocks a pending upload before making any reply request',async()=>{
 const p=fixture({mode:'open'});await ready(p,{cloud:{brain:true,voice:true}});p.nodes.brainMode.value='cloud';p.nodes.brainMode.onchange();p.nodes.cloudConsent.checked=true;p.nodes.cloudConsent.onchange();p.nodes.talk.onclick();p.nodes.cloudConsent.checked=false;await assert.rejects(p.turn.options.request(new Blob(['audio']),new AbortController().signal),/Nothing sent/);assert.equal(p.requests.some(r=>r.url==='/api/reply'),false);p.nodes.stop.onclick();
});
