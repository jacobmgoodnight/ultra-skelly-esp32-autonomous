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
    constructor(serial,onChange=()=>{}) {this.serial=serial;this.onChange=onChange;this.capture=new Capture();this.port=null;this.reader=null;this.readTask=null;this.writeTask=null;this.closing=false;this.busy=false;this.error="";}
    async connect() {
      if(this.port||this.busy)throw new Error("Close the current USB connection first.");
      this.busy=true;this.error="";this.onChange();
      let port;
      try {port=await this.serial.requestPort();await port.open({baudRate:115200});this.port=port;this.capture.clear();this.readTask=this.readLoop(port);}
      catch(e){this.error=e.message;if(port)try{await port.close();}catch(_){}throw e;}
      finally {this.busy=false;this.onChange();}
    }
    async readLoop(port) {
      try {
        while(port.readable&&this.port===port) {
          this.reader=port.readable.getReader();
          try {while(true){const {value,done}=await this.reader.read();if(done)break;if(value)this.capture.add(value);this.onChange();}}
          finally {this.reader.releaseLock();this.reader=null;}
          // A normally closed stream is final; do not spin/reopen it.
          break;
        }
      } catch(e){this.error=e.message;}
      finally {this.capture.finish();if(this.port===port)this.port=null;if(this.writeTask)try{await this.writeTask;}catch(_){}try{await port.close();}catch(_){}this.onChange();}
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
