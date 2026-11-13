/* Optional same-origin event channel. This never sends actuator commands. */
(function () {
  'use strict';
  const TYPES=new Set(['visitor_greeted','speaking_started','approved_surprise','conversation_finished']);
  const PROFILES=new Set(['friendly','mischief','guardian','storyteller']);
  const CHANNEL='skelly-character-events-v1', MAX_BATCH=16, TTL_MS=5000;
  class LocalEvents {
    constructor({channelFactory=name=>new BroadcastChannel(name),
      createSession=()=>crypto.randomUUID(), now=()=>Date.now()}={}) {
      Object.assign(this,{channelFactory,createSession,now});
      this.channel=null;this.session='';this.sequence=0;
    }
    enable() {
      if(this.channel) return true;
      try {
        const session=this.createSession();
        if(typeof session!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(session)) return false;
        const channel=this.channelFactory(CHANNEL);
        if(!channel||typeof channel.postMessage!=='function'||typeof channel.close!=='function') {
          try {channel?.close?.();} catch { /* best effort */ }
          return false;
        }
        this.session=session;this.sequence=0;this.channel=channel;return true;
      } catch {this.channel=null;this.session='';return false;}
    }
    publish(events) {
      if(!this.channel||!Array.isArray(events)) return;
      for(const event of events.slice(0,MAX_BATCH)) {
        if(!event||!TYPES.has(event.type)||!PROFILES.has(event.profile)) continue;
        let now;try {now=this.now();} catch {this.close();return;}
        if(!Number.isSafeInteger(now)||now<0||now>Number.MAX_SAFE_INTEGER-TTL_MS) continue;
        // Never copy arbitrary payload fields, visitor text, names, or addresses.
        const message={version:1,type:event.type,profile:event.profile,session:this.session,
          sequence:++this.sequence,expiresAt:now+TTL_MS};
        try {this.channel.postMessage(message);} catch {this.close();return;}
      }
    }
    close() {
      const channel=this.channel, session=this.session, sequence=this.sequence+1;
      this.channel=null;this.session='';this.sequence=0;
      if(channel) {
        // A receiver can invalidate outstanding cues for this session. Delivery
        // is best-effort; expiry remains necessary if the page crashes.
        try {const now=this.now();if(Number.isSafeInteger(now)&&now>=0&&now<=Number.MAX_SAFE_INTEGER-TTL_MS)
          channel.postMessage({version:1,type:'session_ended',session,sequence,expiresAt:now+TTL_MS});} catch { /* best effort */ }
        try {channel.close();} catch { /* best effort */ }
      }
    }
  }
  const api={LocalEvents,CHANNEL,MAX_BATCH,TTL_MS};
  if(typeof module!=='undefined') module.exports=api;
  if(typeof window!=='undefined') window.SkellyCharacterEvents=api;
})();
