const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../experiments/pocket-conversation/live-devices.js');
function fixture(saved={}){
  const nodes={};for(const id of ['enableDevices','inputDevice','outputDevice','deviceStatus','testRecording','testPlayback'])nodes[id]={value:'',disabled:false,textContent:''};
  for(const select of [nodes.inputDevice,nodes.outputDevice]){select.options=[];select.replaceChildren=()=>select.options=[];select.append=o=>select.options.push(o);}
  global.document={createElement:()=>({value:'',textContent:''})};
  const stored={...saved},calls=[];let repeat,devices=[{kind:'audioinput',deviceId:'usb',label:'FLOW 8'},{kind:'audiooutput',deviceId:'skelly',label:'Skelly Live Stereo'}],pending;
  const media={enumerateDevices:async()=>devices,getUserMedia:async options=>{calls.push(options);return pending?await pending:{getTracks:()=>[{stop:()=>calls.push('closed')}]};}};
  class Repeat {constructor({onChange}){repeat=this;this.onChange=onChange;this.state='idle';}stop(message='Stopped'){this.state='idle';this.clip=null;this.message=message;this.onChange();}async record(){this.state='recording';this.onChange();}finish(){this.state='ready';this.clip={};this.onChange();}async play(){this.state='playing';this.onChange();}end(){this.state='ready';this.onChange();}}
  const live=create({media,RepeatBack:Repeat,Recorder:{},storage:{getItem:k=>stored[k],setItem:(k,v)=>stored[k]=v},nodes,onChange:()=>{},isBusy:()=>false,outputSupported:true});
  return {nodes,live,calls,stored,repeat,setDevices:v=>devices=v,setPending:p=>pending=p};
}
test('no microphone opens at launch and both devices must be explicitly selected',async()=>{
  const p=fixture();assert.equal(p.live.ready(),false);assert.deepEqual(p.calls,[]);await p.nodes.enableDevices.onclick();assert.equal(p.calls[1],'closed');
  p.nodes.inputDevice.value='usb';p.nodes.inputDevice.onchange();assert.equal(p.live.ready(),false);
  p.nodes.outputDevice.value='skelly';p.nodes.outputDevice.onchange();assert.equal(p.live.ready(),true);assert.equal(p.live.input(),'usb');assert.equal(p.live.output(),'skelly');
  assert.equal(p.stored['skelly-live-input'],'usb');assert.equal(p.stored['skelly-live-output'],'skelly');
});
test('remembered microphone is requested exactly and device loss fails closed',async()=>{
  const p=fixture({'skelly-live-input':'usb','skelly-live-output':'skelly'});await p.nodes.enableDevices.onclick();assert.deepEqual(p.calls[0].audio,{deviceId:{exact:'usb'}});assert.equal(p.live.ready(),true);
  p.live.changed();p.setDevices([{kind:'audiooutput',deviceId:'skelly',label:'Skelly'}]);await p.nodes.enableDevices.onclick();assert.equal(p.live.ready(),false);assert.match(p.nodes.deviceStatus.textContent,/microphone is unavailable/);
});
test('Stop while permission is pending closes a late stream without enabling devices',async()=>{
  const p=fixture();let resolve;p.setPending(new Promise(r=>resolve=r));const request=p.nodes.enableDevices.onclick();p.live.stop();resolve({getTracks:()=>[{stop:()=>p.calls.push('late closed')}]});await request;assert.equal(p.live.ready(),false);assert.ok(p.calls.includes('late closed'));
});
test('test recording uses selected devices and is discarded after playback',async()=>{
  const p=fixture();await p.nodes.enableDevices.onclick();p.nodes.inputDevice.value='usb';p.nodes.inputDevice.onchange();p.nodes.outputDevice.value='skelly';p.nodes.outputDevice.onchange();
  p.nodes.testRecording.onclick();await Promise.resolve();assert.equal(p.repeat.input,'usb');assert.equal(p.repeat.sink,'skelly');p.repeat.finish();p.nodes.testPlayback.onclick();p.repeat.end();assert.equal(p.repeat.state,'idle');assert.equal(p.repeat.clip,null);p.live.stop();
});
