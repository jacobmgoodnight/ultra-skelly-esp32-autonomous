// Software-only: real page with simulated devices and playback; no hardware opens.
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const routes={'/':'experiments/pocket-conversation/chat.html','/talkback.js':'studio/talkback.js','/talkback-auto.js':'studio/talkback-auto.js','/adaptive-mic.js':'experiments/pocket-conversation/adaptive-mic.js','/conversation.js':'experiments/pocket-conversation/chat-turn.js','/conversation-ui.js':'experiments/pocket-conversation/chat-ui.js','/live-devices.js':'experiments/pocket-conversation/live-devices.js','/character-director.js':'studio/character-director.js','/character-preview.js':'studio/character-preview.js','/character-events.js':'studio/character-events.js'};
test('operator page starts silent, routes explicit devices and discards a test clip',async()=>{
  let online=true;
  const server=http.createServer((req,res)=>{const route=new URL(req.url,'http://localhost').pathname;if(route==='/api/status'){res.setHeader('Content-Type','application/json');if(!online){res.writeHead(503);res.end('{}');return;}res.end(JSON.stringify({ready:true,conversation:true,familyCatalog:true,token:'test-token',voice:'local test',brain:'local test',tones:['haunt-dry'],modelLoaded:true}));return;}const file=routes[route];if(!file){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html':'text/javascript');res.end(fs.readFileSync(path.join(root,file)));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.testMicCalls=[];window.testSinks=[];
      const media={getUserMedia:async constraints=>{window.testMicCalls.push(constraints);return {getTracks:()=>[{stop(){}}],getAudioTracks:()=>[{label:'FLOW 8'}]};},enumerateDevices:async()=>[{kind:'audioinput',deviceId:'usb',label:'FLOW 8'},{kind:'audiooutput',deviceId:'skelly',label:'Skelly Live Stereo'}],addEventListener(){}};
      Object.defineProperty(navigator,'mediaDevices',{value:media});
      window.MediaRecorder=class {static isTypeSupported(){return true;}constructor(){this.state='inactive';this.mimeType='audio/webm';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['test'])});this.onstop?.();}};
      HTMLMediaElement.prototype.setSinkId=async function(){};
      window.Audio=class {async setSinkId(id){window.testSinks.push(id);}async play(){window.testPlaybackAudio=this;}pause(){}removeAttribute(){}load(){}};
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);assert.equal(await page.evaluate(()=>testMicCalls.length),0);
    await page.click('#check');await page.waitForFunction(()=>document.querySelector('#service').textContent.includes('Connected.'));
    assert.equal(await page.locator('#talk').isDisabled(),true);await page.click('#enableDevices');await page.selectOption('#inputDevice','usb');await page.selectOption('#outputDevice','skelly');
    assert.equal(await page.locator('#talk').isDisabled(),true);await page.locator('#attending').check();assert.equal(await page.locator('#talk').isDisabled(),false);
    if(process.env.SKELLY_LIVE_QA_SCREENSHOT)await page.screenshot({path:process.env.SKELLY_LIVE_QA_SCREENSHOT,fullPage:true});
    await page.click('#testRecording');await page.waitForFunction(()=>document.querySelector('#mic').textContent.includes('Microphone ON'));assert.match(await page.locator('#livePhase').textContent(),/Listening/);await page.waitForFunction(()=>!document.querySelector('#testPlayback').disabled,{timeout:5000});assert.match(await page.locator('#mic').textContent(),/Microphone OFF/);await page.click('#testPlayback');assert.match(await page.locator('#livePhase').textContent(),/Speaking/);
    await page.evaluate(()=>window.testPlaybackAudio.onended());
    try{await page.waitForFunction(()=>document.querySelector('#deviceStatus').textContent.includes('discarded'),null,{timeout:8000});}catch(error){throw Error('Playback did not finish: '+await page.locator('#deviceStatus').textContent()+'; errors: '+errors.join(', '),{cause:error});}
    assert.deepEqual(await page.evaluate(()=>testSinks),['skelly']);assert.equal((await page.evaluate(()=>testMicCalls.at(-1).audio.deviceId.exact)),'usb');assert.equal(await page.locator('#talk').isDisabled(),true);assert.match(await page.locator('#livePhase').textContent(),/Cooldown/);
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    online=false;await page.waitForFunction(()=>document.querySelector('#service').textContent.includes('connection lost'),null,{timeout:16000});assert.match(await page.locator('#localVoiceReady').textContent(),/connection lost/);assert.match(await page.locator('#familyStatus').textContent(),/unavailable/);assert.equal(await page.locator('#talk').isDisabled(),true);
    assert.deepEqual(errors,[]);
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
});
