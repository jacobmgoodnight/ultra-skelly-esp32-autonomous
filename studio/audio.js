/* Optional direct-to-prop audio tools. No port opens on page load.
 * Protocol references: martinecker/SkellyUltraWebController at 871efa15.
 * Original implementation; notifications are bounded and CRC/structure checked.
 */
(function(){
  'use strict';
  const SERVICE='0000ae00-0000-1000-8000-00805f9b34fb',WRITE='0000ae01-0000-1000-8000-00805f9b34fb',NOTIFY='0000ae02-0000-1000-8000-00805f9b34fb';
  const fail=message=>{throw Error(message);};
  function integer(n,min,max){if(!Number.isSafeInteger(n)||n<min||n>max)fail('Invalid audio setting.');return n;}
  function crc(bytes){let c=0;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0x8c:0);}return c;}
  function be(n,width){integer(n,0,width===4?0xffffffff:2**(8*width)-1);return Array.from({length:width},(_,i)=>(n/2**(8*(width-i-1)))&255);}
  function number(bytes,offset,width){let n=0;for(let i=0;i<width;i++)n=n*256+bytes[offset+i];return n;}
  function frame(tag,payload=[],padding=8){const a=[0xaa,tag,...payload];while(a.length<2+padding)a.push(0);return new Uint8Array([...a,crc(a)]);}
  function filename(name,length=false){
    if(typeof name!=='string'||!name.length||name.length>33||!/^[A-Za-z0-9 _.-]+\.mp3$/i.test(name)||name.startsWith('.')||name.includes('..'))fail('Use an MP3 name of at most 33 plain letters, numbers, spaces, dots, underscores or hyphens.');
    const bytes=[0x5c,0x55,...[...name].flatMap(c=>[c.charCodeAt(0),0])];return length?[bytes.length,...bytes]:bytes;
  }
  function inspectMp3(bytes){
    if(!(bytes instanceof Uint8Array)||bytes.length<288||bytes.length>1048576)fail('Choose an MP3 smaller than 1 MiB.');
    let offset=0,end=bytes.length,frames=0;
    if(bytes[0]===73&&bytes[1]===68&&bytes[2]===51){
      if(bytes.slice(6,10).some(b=>b&128))fail('Invalid MP3 tag.');
      offset=10+bytes.slice(6,10).reduce((n,b)=>n*128+b,0)+((bytes[3]===4&&(bytes[5]&16))?10:0);
      if(offset>131082||offset>=end)fail('MP3 tag is too large or incomplete.');
    }
    if(end>=128&&String.fromCharCode(...bytes.slice(end-128,end-125))==='TAG')end-=128;
    while(offset<end){
      if(end-offset<4)fail('Incomplete MP3 frame.');
      const h=number(bytes,offset,4)>>>0;
      if((h>>>21)!==2047||((h>>>19)&3)!==0||((h>>>17)&3)!==1||((h>>>12)&15)!==4||((h>>>10)&3)!==2||((h>>>6)&3)!==3)
        fail('Prepare an 8 kHz, mono, 32 kbps MP3 first. Other audio formats are not converted in this version.');
      const size=288+((h>>>9)&1);if(offset+size>end)fail('Incomplete MP3 frame.');offset+=size;frames++;
    }
    const duration=frames*576/8000,guard=Math.max(21,Math.ceil(duration)+2);
    if(!frames||guard>120)fail('Choose a clip up to 118 seconds so its padded estimate fits 120 seconds.');
    return {duration,guard,bytes:bytes.length};
  }
  function packet(bytes){
    if(!(bytes instanceof Uint8Array)||bytes.length<4||bytes.length>512||bytes[0]!==0xbb||crc(bytes.slice(0,-1))!==bytes[bytes.length-1])return null;
    return {tag:bytes[1],bytes};
  }
  function fileInfo(bytes){
    if(bytes.length<62||bytes[0]!==0xbb||bytes[1]!==0xd0)fail('Incomplete file metadata.');
    const serial=number(bytes,2,2),cluster=number(bytes,4,4),total=number(bytes,8,2),action=bytes[12],eye=bytes[55];
    integer(serial,1,65535);integer(total,1,128);integer(action,0,255);if(action>7&&action!==255)fail('Unsupported saved movements.');integer(eye,1,18);
    let marker=-1;for(let i=57;i<bytes.length-2;i++)if(bytes[i]===0x5c&&bytes[i+1]===0x55){marker=i;break;}
    if(marker<0||(bytes.length-marker-3)%2)fail('Incomplete file name.');
    let name='';for(let i=marker+2;i<bytes.length-1;i+=2){const c=bytes[i]|bytes[i+1]<<8;if(c===0)break;name+=String.fromCharCode(c);}
    if(!name||name.length>128||/[\x00-\x1f\x7f]/.test(name))fail('Invalid file name from Skelly.');
    const lights=[0,1].map(i=>{const o=13+i*7;return {mode:bytes[o],brightness:bytes[o+1],color:'#'+Array.from(bytes.slice(o+2,o+5),b=>b.toString(16).padStart(2,'0')).join(''),cycle:bytes[o+5],speed:bytes[o+6]};});
    return {serial,cluster,total,action,eye,name,lights};
  }
  function settings(value){
    const action=integer(value.action,0,7),eye=integer(value.eye,1,18);
    if(!Array.isArray(value.lights)||value.lights.length!==2)fail('Choose both clip light channels.');
    const lights=value.lights.map(l=>{if(!/^#[0-9a-f]{6}$/i.test(l.color))fail('Choose a clip color.');return {mode:integer(l.mode,1,3),brightness:integer(l.brightness,0,255),color:l.color.toLowerCase(),cycle:integer(Number(l.cycle??0),0,1),speed:integer(l.speed,0,254)};});
    return {action,eye,lights};
  }
  function sameSettings(file,expected){
    return file.action===expected.action&&file.eye===expected.eye&&expected.lights.every((l,i)=>{const a=file.lights[i];return a.mode===l.mode&&a.brightness===l.brightness&&a.color===l.color&&a.cycle===l.cycle&&(l.mode===1||(a.speed===255?0:a.speed)===254-l.speed);});
  }
  function audioRoutine(config,file,guard,min,max){
    integer(file.serial,1,65535);integer(guard,21,120);integer(min,60,3600);integer(max,min,3600);
    return {...config,eyesEnabled:true,lightsEnabled:true,eyeChoices:config.eyeChoices?.length?[...config.eyeChoices]:[1],jawEnabled:true,jawFile:file.serial,jawExtras:'',jawClipSec:guard,jawDurations:'',jawMin:min,jawMax:max,eyeJawMode:3,
      jawProtectBody:true,overlap:false,bodyOverlap:false,jawFollowupMotor:0,jawFollowupRecurring:false,lightRestoreMode:1,fairBodyTurns:true};
  }
  class Session{
    constructor(bluetooth,{onChange=()=>{},sleep=ms=>new Promise(r=>setTimeout(r,ms)),timeout=8000,listTimeout=12000}={}){
      this.bluetooth=bluetooth;this.onChange=onChange;this.sleep=sleep;this.timeout=timeout;this.listTimeout=listTimeout;this.name='';this.device=null;this.writer=null;this.notifier=null;this.busy=false;this.generation=0;this.waiters=new Set();this.listeners=new Set();this.files=[];this.capacity=null;this.controller=null;
    }
    get connected(){return !!this.writer&&!!this.device?.gatt.connected;}
    check(signal){if(signal?.aborted)fail('Audio operation cancelled.');}
    async run(fn){
      if(this.busy)fail('Wait for the current audio operation.');this.busy=true;const controller=new AbortController();this.controller=controller;this.onChange();
      try{return await fn(controller.signal);}catch(e){this.disconnect();throw e;}finally{this.busy=false;this.controller=null;this.onChange();}
    }
    disconnect(){
      this.generation++;const d=this.device,n=this.notifier;this.name='';this.device=this.writer=this.notifier=null;this.files=[];this.capacity=null;
      n?.removeEventListener('characteristicvaluechanged',this.receive);d?.removeEventListener('gattserverdisconnected',this.lost);
      for(const w of [...this.waiters])w.finish(Error('Skelly Bluetooth disconnected.'));
      this.listeners.clear();if(d?.gatt.connected)d.gatt.disconnect();this.onChange();
    }
    cancel(){this.controller?.abort();this.disconnect();}
    async bounded(promise,signal,ms=this.timeout){
      this.check(signal);let timer,abort;
      try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Bluetooth operation timed out. Reconnect before retrying.')),ms);abort=()=>reject(Error('Audio operation cancelled.'));signal?.addEventListener('abort',abort,{once:true});})]);}
      finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
    }
    async connect(name){
      return this.run(async signal=>{
        if(!this.bluetooth)fail('Direct Bluetooth audio tools need a browser with Web Bluetooth support.');
        if(typeof name!=='string'||!name.trim()||name.length>48)fail('Choose your advertised Skelly name.');
        const device=await this.bounded(this.bluetooth.requestDevice({filters:[{name:name.trim()}],optionalServices:[SERVICE]}),signal,120000);this.check(signal);
        this.disconnect();this.device=device;this.name=name.trim();const generation=this.generation;
        this.lost=()=>this.disconnect();device.addEventListener('gattserverdisconnected',this.lost);
        const connecting=device.gatt.connect();
        connecting.then(server=>{if(generation!==this.generation&&server.connected)server.disconnect();}).catch(()=>{});
        const server=await this.bounded(connecting,signal);this.check(signal);if(generation!==this.generation)fail('Bluetooth connection changed.');
        const service=await this.bounded(server.getPrimaryService(SERVICE),signal);this.check(signal);
        const writer=await this.bounded(service.getCharacteristic(WRITE),signal),notifier=await this.bounded(service.getCharacteristic(NOTIFY),signal);this.check(signal);
        if(generation!==this.generation)fail('Bluetooth connection changed.');this.writer=writer;this.notifier=notifier;
        this.receive=event=>{
          if(generation!==this.generation)return;const v=event.target.value;if(!v||v.byteLength>512)return;
          const parsed=packet(new Uint8Array(v.buffer,v.byteOffset,v.byteLength).slice());if(!parsed)return;
          for(const fn of [...this.listeners])fn(parsed);for(const w of [...this.waiters])if(w.test(parsed))w.finish(null,parsed);
        };
        notifier.addEventListener('characteristicvaluechanged',this.receive);await this.bounded(notifier.startNotifications(),signal);this.check(signal);
        return this.refreshInternal(signal);
      });
    }
    wait(test,signal,ms=this.timeout){
      this.check(signal);if(!this.connected)fail('Connect directly to Skelly first.');
      let timer,w;const promise=new Promise((resolve,reject)=>{w={test,finish:(error,value)=>{clearTimeout(timer);this.waiters.delete(w);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);}};
        const abort=()=>w.finish(Error('Audio operation cancelled.'));this.waiters.add(w);signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>w.finish(Error('No usable reply from Skelly. Reconnect and refresh files.')),ms);});
      promise.catch(()=>{});return {promise,cancel:()=>w.finish(Error('Audio request stopped.'))};
    }
    async send(tag,payload,signal,padding=8){
      this.check(signal);if(!this.connected)fail('Connect directly to Skelly first.');const writer=this.writer,generation=this.generation;
      let timer,abort;try{
        await Promise.race([writer.writeValueWithoutResponse(frame(tag,payload,padding)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Bluetooth write timed out. Reconnect before retrying.')),this.timeout);abort=()=>reject(Error('Audio operation cancelled.'));signal?.addEventListener('abort',abort,{once:true});})]);
        this.check(signal);if(generation!==this.generation||!this.connected)fail('Bluetooth disconnected during a write.');
      }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
    }
    async request(tag,payload,response,signal){
      const w=this.wait(p=>p.tag===response,signal);try{await this.send(tag,payload,signal);return (await w.promise).bytes;}finally{w.cancel();}
    }
    async refreshInternal(signal){
      const cap=await this.request(0xd2,[],0xd2,signal);if(cap.length<11)fail('Incomplete storage response.');
      const count=integer(cap[6],0,128),capacity=number(cap,2,4)*1024,found=new Map();
      if(count){
        const w=this.wait(p=>p.tag===0xd0&&found.size===count,signal,this.listTimeout);
        const collect=p=>{if(p.tag!==0xd0)return;try{const f=fileInfo(p.bytes);if(f.total!==count||found.has(f.serial))return;found.set(f.serial,f);}catch{}};
        this.listeners.add(collect);try{await this.send(0xd0,[],signal);await w.promise;}finally{this.listeners.delete(collect);w.cancel();}
      }
      this.files=[...found.values()].sort((a,b)=>a.serial-b.serial);this.capacity=capacity;this.onChange();return this.files;
    }
    refresh(){return this.run(signal=>this.refreshInternal(signal));}
    async upload(bytes,name,onProgress=()=>{}){
      filename(name);const info=inspectMp3(bytes);
      return this.run(async signal=>{
        await this.refreshInternal(signal);
        if(this.files.some(f=>f.name.toLowerCase()===name.toLowerCase()))fail('That name already exists on Skelly. Choose a new name; Studio never overwrites an audio file.');
        if(bytes.length>this.capacity)fail('Not enough reported storage space on Skelly.');
        const chunk=128,total=Math.ceil(bytes.length/chunk);
        const start=await this.request(0xc0,[...be(bytes.length,4),...be(total,2),...filename(name)],0xc0,signal);
        if(start.length<8||start[2]||number(start,3,4)!==0)fail('Skelly rejected a fresh upload. Reconnect and choose a new filename.');
        let dropped=false;const listener=p=>{if(p.tag===0xc1)dropped=true;};this.listeners.add(listener);
        try{for(let i=0;i<total;i++){this.check(signal);if(dropped)fail('Skelly requested a resend. Upload stopped; reconnect, refresh and retry with a new name.');await this.send(0xc1,[...be(i,2),...bytes.subarray(i*chunk,(i+1)*chunk)],signal,0);onProgress(Math.floor((i+1)/total*100));await this.sleep(50);}}
        finally{this.listeners.delete(listener);}
        if(dropped)fail('Skelly requested a resend. Reconnect, refresh and retry with a new name.');
        for(const tag of [0xc2,0xc3]){const ack=await this.request(tag,tag===0xc3?filename(name):[],tag,signal);if(ack.length<4||ack[2])fail('Skelly did not confirm the complete upload. Refresh before retrying.');}
        await this.refreshInternal(signal);const file=this.files.find(f=>f.name===name);if(!file)fail('Upload was acknowledged but the new file was not found. It is not ready for scheduling.');
        return {...file,guard:info.guard};
      });
    }
    save(file,value){
      const expected=settings(value);filename(file.name);
      return this.run(async signal=>{
        await this.refreshInternal(signal);const current=this.files.find(f=>f.serial===file.serial&&f.cluster===file.cluster&&f.name===file.name);if(!current)fail('The selected file changed. Select it again after refresh.');
        const target=data=>[...data,...be(current.cluster,4),...filename(current.name,true)];
        const send=async(tag,data)=>{await this.send(tag,target(data),signal);await this.sleep(60);};
        await send(0xca,[expected.action,0]);await send(0xf9,[expected.eye,0]);
        for(let i=0;i<2;i++){const l=expected.lights[i];await send(0xf3,[i,l.brightness]);await send(0xf2,[i,l.mode]);if(l.mode!==1)await send(0xf6,[i,254-l.speed]);await send(0xf4,[i,...[1,3,5].map(o=>parseInt(l.color.slice(o,o+2),16)),l.cycle]);}
        await this.refreshInternal(signal);const saved=this.files.find(f=>f.serial===current.serial&&f.cluster===current.cluster&&f.name===current.name);
        if(!saved||!sameSettings(saved,expected))fail('Clip settings did not match read-back. Reconnect, refresh and inspect before retrying.');return saved;
      });
    }
  }
  const api={Session,frame,crc,filename,inspectMp3,packet,fileInfo,settings,sameSettings,audioRoutine};
  if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.SkellyAudio=api;
})();
