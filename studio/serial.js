/* Local USB capture: explicit user connection, bounded original bytes, no network. */
(function () {
  "use strict";
  class Capture {
    constructor(limit=2*1024*1024) { this.limit=limit;this.clear(); }
    clear() { this.buffer=new Uint8Array(this.limit);this.size=0;this.dropped=0;this.decoder=new TextDecoder();this.text=""; }
    add(bytes) {
      const keep=bytes.slice(0,Math.max(0,this.limit-this.size));
      if(keep.length) {this.buffer.set(keep,this.size);this.size+=keep.length;this.text+=this.decoder.decode(keep,{stream:true});}
      this.dropped+=bytes.length-keep.length;
    }
    bytes() { return this.buffer.slice(0,this.size); }
    finish() { this.text+=this.decoder.decode(); }
    summary() {
      const decoded=new TextDecoder().decode(this.bytes());
      const heaps=[...this.text.matchAll(/(?:^|\s)heap=(\d+)/g)].map(m=>Number(m[1]));
      return {bytes:this.size,discardedAfterLimit:this.dropped,
        decodedReplacementCharacters:(decoded.match(/\uFFFD/g)||[]).length,
        bootLines:(this.text.match(/BOOT /g)||[]).length,
        firstHeap:heaps[0]??null,lastHeap:heaps.at(-1)??null,
        caveat:"Serial bytes only. No actuator, LED, playback completion or root-cause confirmation."};
    }
  }
  class Session {
    constructor(serial,onChange=()=>{}) {this.serial=serial;this.onChange=onChange;this.capture=new Capture();this.port=null;this.reader=null;this.readTask=null;this.writeTask=null;this.closing=false;this.busy=false;this.error="";this.messages=[];this.messageSerial=0;this.partial='';this.protocolDecoder=new TextDecoder();this.waiters=[];this.operation=false;}
    ingest(bytes){
      this.partial+=this.protocolDecoder.decode(bytes,{stream:true});
      let end;while((end=this.partial.indexOf('\n'))>=0){const line=this.partial.slice(0,end).trim();this.partial=this.partial.slice(end+1);const match=/(?:^|\] )(USB (?:CFG|CAPS|STATUS|SCENE|READY) .*)$/.exec(line);if(match){const event={id:++this.messageSerial,text:match[1]};this.messages.push(event);if(this.messages.length>1024)this.messages.shift();for(const w of [...this.waiters])if(event.id>w.after&&w.test(event.text))w.finish(null,event);}}
      if(this.partial.length>1024)this.partial=this.partial.slice(-1024);
    }
    waitFor(test,after=this.messageSerial,timeout=8000,signal){
      const canceled=()=>Object.assign(Error('USB status request canceled.'),{name:'AbortError'});
      if(signal?.aborted)return Promise.reject(canceled());
      const found=this.messages.find(e=>e.id>after&&test(e.text));if(found)return Promise.resolve(found);
      return new Promise((resolve,reject)=>{
        const w={test,after};let done=false;
        const abort=()=>w.finish(canceled());
        w.finish=(error,event)=>{if(done)return;done=true;clearTimeout(w.timer);signal?.removeEventListener('abort',abort);this.waiters=this.waiters.filter(x=>x!==w);if(error)reject(error);else resolve(event);};
        w.timer=setTimeout(()=>{const e=Error('No controller acknowledgment. Retry identification; close Arduino Serial Monitor and other USB tools first.');e.code='ACK_TIMEOUT';w.finish(e);},timeout);
        this.waiters.push(w);signal?.addEventListener('abort',abort,{once:true});
      });
    }
    async request(command,test,timeout=8000,signal){
      if(signal?.aborted)throw Object.assign(Error('USB status request canceled.'),{name:'AbortError'});
      const after=this.messageSerial;await this.send(command+'\n');return this.waitFor(test,after,timeout,signal);
    }
    // A blocking BLE scan/connect may already be running when USB opens.
    async capabilities({timeout=45000,retry=3000,onAttempt=()=>{}}={}){
      // Opening CP210x/CH340 ports can restart the ESP32. A first HELLO may
      // disappear during boot; retry only this harmless, idempotent request.
      const after=this.messageSerial,start=performance.now();let attempt=0;
      while(this.port && performance.now()-start<timeout){
        onAttempt(++attempt);await this.send('\nSKELLY HELLO\n');
        try{return await this.waitFor(s=>s.startsWith('USB CAPS v2 '),after,Math.min(retry,Math.max(1,timeout-(performance.now()-start))));}
        catch(e){if(e.code!=='ACK_TIMEOUT')throw e;}
      }
      throw Error('USB port opened, but firmware identification did not reply. Close Arduino Serial Monitor and other USB tabs, then Retry identification. If needed, press the ESP32 EN/Reset button once and retry. No settings were sent.');
    }
    async status({timeout=45000,signal}={}){return this.request('SKELLY STATUS',s=>s.startsWith('USB STATUS v2 '),timeout,signal);}
    diagnostics(){const last=[...this.messages].reverse().find(e=>e.text.startsWith('USB STATUS v2 '));const allowed=new Set(['runtime','connected','scene','sequence','crc','pending','scans','connects','writes','failures','heap','minHeap','clock','window','firmware','build','wait','jawMs','accepted','acceptedAge']);return {...this.capture.summary(),controller:last?Object.fromEntries(last.text.slice(14).split(' ').filter(s=>/^[A-Za-z]+=[0-9]+$/.test(s)&&allowed.has(s.split('=')[0])).map(s=>{const [k,v]=s.split('=');return [k,Number(v)];})):null,notice:'Controller status is reported transport/model state, not observed motor or LED behavior.'};}
    async configReply(command,id,test,timeout=45000){const r=await this.request(command,s=>s.startsWith('USB CFG ERROR '+id+' ')||test(s),timeout);if(r.text.startsWith('USB CFG ERROR'))throw Error('Controller rejected settings: '+r.text.split(' ').at(-1));return r;}
    async writeSettings(words,crc,onProgress=()=>{}){
      if(this.operation)throw Error('Wait for the current controller operation.');this.operation=true;const id=(Date.now()%1000000000)+1,after=this.messageSerial;
      try{
        await this.configReply('SKELLY CFG BEGIN '+id+' '+words.length,id,s=>s==='USB CFG ACK '+id+' 0');
        for(let at=0;at<words.length;at+=8){const chunk=words.slice(at,at+8);await this.configReply('SKELLY CFG DATA '+id+' '+at+' '+chunk.map(n=>(n>>>0).toString(16).padStart(8,'0')).join(' '),id,s=>s==='USB CFG ACK '+id+' '+(at+chunk.length));onProgress(Math.round((at+chunk.length)/words.length*100));}
        await this.configReply('SKELLY CFG COMMIT '+id+' '+crc,id,s=>s==='USB CFG QUEUED '+id);onProgress('waiting');
        const result=await this.waitFor(s=>s.startsWith('USB CFG APPLIED '+id+' ')||s.startsWith('USB CFG ERROR '+id+' '),after,210000);
        if(result.text.startsWith('USB CFG ERROR'))throw Error(result.text);return result;
      }catch(e){if(this.port)try{await this.send('SKELLY CFG ABORT '+id+'\n');}catch(_){}throw e;}finally{this.operation=false;this.onChange();}
    }
    async readSettings(){
      if(this.operation)throw Error('Wait for the current controller operation.');this.operation=true;const id=(Date.now()%1000000000)+1,after=this.messageSerial;
      try{const start=await this.configReply('SKELLY CFG GET '+id,id,s=>s.startsWith('USB CFG DUMP '+id+' '));const fields=start.text.split(' '),count=Number(fields[4]);if(count<3||count>4096)throw Error('Unsupported controller settings size.');
        const end=await this.waitFor(s=>s==='USB CFG END '+id,after,45000),words=[];
        for(const e of this.messages.filter(e=>e.id>start.id&&e.id<end.id&&e.text.startsWith('USB CFG DATA '+id+' '))){const p=e.text.split(' ');if(Number(p[4])!==words.length)throw Error('Controller settings arrived out of order.');for(const value of p.slice(5)){if(!/^[\da-f]{8}$/i.test(value))throw Error('Malformed controller setting.');words.push(parseInt(value,16));}}
        if(words.length!==count)throw Error('Incomplete settings response.');return {words,sequence:Number(fields[5]),crc:Number(fields[6])};
      }finally{this.operation=false;this.onChange();}
    }
    async connect() {
      if(this.port||this.busy)throw new Error("Close the current USB connection first.");
      this.busy=true;this.error="";this.onChange();
      let port;
      try {port=await this.serial.requestPort();await port.open({baudRate:115200});this.port=port;this.capture.clear();this.messages=[];this.partial='';this.protocolDecoder=new TextDecoder();this.readTask=this.readLoop(port);}
      catch(e){this.error=e.message;if(port)try{await port.close();}catch(_){}throw e;}
      finally {this.busy=false;this.onChange();}
    }
    async readLoop(port) {
      try {
        while(port.readable&&this.port===port) {
          this.reader=port.readable.getReader();
          try {while(true){const {value,done}=await this.reader.read();if(done)break;if(value){this.capture.add(value);this.ingest(value);}this.onChange();}}
          finally {this.reader.releaseLock();this.reader=null;}
          // A normally closed stream is final; do not spin/reopen it.
          break;
        }
      } catch(e){this.error=e.message;}
      finally {this.capture.finish();if(this.port===port)this.port=null;for(const w of [...this.waiters])w.finish(Error('USB disconnected. Read controller settings after reconnecting.'));if(this.writeTask)try{await this.writeTask;}catch(_){}try{await port.close();}catch(_){}this.onChange();}
    }
    async disconnect() {
      this.closing=true;this.onChange();
      try {if(this.writeTask)try{await this.writeTask;}catch(_){}if(this.reader)await this.reader.cancel();if(this.readTask)await this.readTask;this.readTask=null;}
      finally {this.closing=false;this.onChange();}
    }
    async syncClock(now=new Date()) {
      if(!this.port||!this.port.writable)throw new Error("Connect the controller over USB first.");
      if(!this.capture.text.includes("USB READY v1 CLOCK"))throw new Error("This firmware has not advertised USB clock support. Wait for READY or upload the new sketch.");
      // Local civil seconds: weekday/minute arithmetic stays offline. The clock
      // is intentionally invalidated on boot, never restored from browser data.
      const civil=Math.floor(now.getTime()/1000)-now.getTimezoneOffset()*60;
      await this.send("SKELLY TIME "+civil+"\n");
    }
    async identify() { await this.send("SKELLY HELLO\n"); }
    async send(command) {
      if(!this.port||!this.port.writable)throw new Error("Connect the controller over USB first.");
      if(this.closing||this.writeTask)throw new Error("Wait for the current USB operation to finish.");
      const writer=this.port.writable.getWriter();
      try {this.writeTask=writer.write(new TextEncoder().encode(command));await this.writeTask;}
      finally {writer.releaseLock();this.writeTask=null;}
    }
  }
  const api={Capture,Session};
  if(typeof module!=="undefined")module.exports=api;
  if(typeof window!=="undefined")window.SkellySerial=api;
})();
