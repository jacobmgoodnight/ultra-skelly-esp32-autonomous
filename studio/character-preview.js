/* Explicit, local simulation only. Never accesses audio, USB, BLE or network. */
(function () {
  'use strict';
  const root=document.getElementById('characterPreview');
  if (!root || !window.SkellyCharacterDirector) return;
  const select=root.querySelector('select'), button=root.querySelector('button'), result=root.querySelector('[role=status]');
  let director=new window.SkellyCharacterDirector.Director();
  let timer=null, generation=0;
  const steps=[['greet',0],['listen',1200],['think',2600],['speak',4000],['react',6500],['finish',8000]];
  function draw() {
    const d=director.describe();
    result.textContent=d.profile.label+' · '+d.cue+' · '+d.profile.eyes+' · '+d.profile.light+' · '+d.profile.voice+' voice';
  }
  function cancel() { clearTimeout(timer); ++generation; director.stop(); director=new window.SkellyCharacterDirector.Director(); button.disabled=false; select.disabled=false; }
  button.addEventListener('click',()=>{
    cancel(); director.setProfile(select.value); button.disabled=true; select.disabled=true;
    const current=++generation, token=director.generation;
    function run(index) {
      if (current!==generation) return;
      director.step(steps[index][0],token); draw();
      if (index+1<steps.length) timer=setTimeout(()=>run(index+1),steps[index+1][1]-steps[index][1]);
      else { button.disabled=false; select.disabled=false; }
    }
    run(0);
  });
  select.addEventListener('change',()=>{ cancel(); director.setProfile(select.value); draw(); });
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) {cancel(); draw();} });
  draw();
})();
