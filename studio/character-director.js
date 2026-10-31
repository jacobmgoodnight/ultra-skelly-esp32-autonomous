/* Software-only character rehearsal. It has no transport or actuator interface. */
(function () {
  'use strict';
  const PROFILES = Object.freeze({
    friendly: Object.freeze({label:'Friendly Trick-or-Treater', eyes:'welcoming eyes', light:'warm glow', voice:'bright', motion:'gentle head turn'}),
    mischief: Object.freeze({label:'Mischievous Skeleton', eyes:'playful eyes', light:'pumpkin glow', voice:'playful', motion:'curious head turn'}),
    guardian: Object.freeze({label:'Haunted Guardian', eyes:'watchful eyes', light:'cool glow', voice:'measured', motion:'slow head turn'}),
    storyteller: Object.freeze({label:'Creepy Storyteller', eyes:'thoughtful eyes', light:'moonlit glow', voice:'quiet', motion:'slow head turn'})
  });
  const NEXT = Object.freeze({idle:['greet'], greeting:['listen'], listening:['think'], thinking:['speak'], speaking:['react'], reacting:['listen','finish'], cooldown:['ready'], recovery:['ready']});
  const TARGET = Object.freeze({greet:'greeting', listen:'listening', think:'thinking', speak:'speaking', react:'reacting', finish:'cooldown', ready:'idle'});
  const EVENT = Object.freeze({greet:'visitor_greeted', speak:'speaking_started', finish:'conversation_finished'});
  const CUES = Object.freeze({
    idle:'Watching', greeting:'Greet: eyes and lighting; a head cue is illustrated', listening:'Listen: hold still',
    thinking:'Think: hold still', speaking:'Voice and jaw follow speech; body remains still',
    reacting:'React: an illustrative head cue after speech', cooldown:'Return: wait for cooldown', recovery:'Recovery: discard the rehearsal'
  });
  class Director {
    constructor({now=()=>Date.now(), events=false}={}) {
      this.now=now; this.events=events===true; this.profile='friendly'; this.state='idle'; this.generation=0; this.queue=[]; this.until=0;
    }
    setProfile(profile) {
      if (!Object.hasOwn(PROFILES,profile) || this.state!=='idle') throw Error('Choose a known character while idle.');
      this.profile=profile;
    }
    step(action, generation=this.generation) {
      if (generation!==this.generation || !(NEXT[this.state]||[]).includes(action)) return false;
      if (action==='ready' && this.now()<this.until) return false;
      this.state=TARGET[action];
      if (action==='finish') this.until=this.now()+45000;
      if (this.events && EVENT[action]) {
        if (this.queue.length===16) this.queue.shift();
        this.queue.push(Object.freeze({type:EVENT[action], profile:this.profile}));
      }
      return true;
    }
    stop() {
      ++this.generation; this.queue=[]; this.state='recovery';
      // Never shorten an already owed cooldown.
      this.until=Math.max(this.until,this.now());
    }
    drainEvents() { const events=this.queue.slice(); this.queue=[]; return events; }
    describe() { return {state:this.state, profile:PROFILES[this.profile], cue:CUES[this.state], cooldownMs:Math.max(0,this.until-this.now()), generation:this.generation}; }
  }
  const api={Director,PROFILES};
  if (typeof module!=='undefined') module.exports=api;
  if (typeof window!=='undefined') window.SkellyCharacterDirector=api;
})();
