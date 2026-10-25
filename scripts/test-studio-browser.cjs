/* Software-only browser workflows. No real serial/Bluetooth port is requested.
 * Requires Playwright (test tooling only). See docs/testing.md for invocation. */
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'.skelly-build/browser-results');
fs.mkdirSync(artifacts,{recursive:true});
const results=[];

// Exercise the real serial parser and transaction code against a browser mock.
function mockUsb(){
  const mock=window.mockUsb={options:{},commands:[],opens:0,writes:0,words:null};
  const serial={async requestPort(){
    mock.opens++;
    if(mock.options.chooser)throw new DOMException('Simulated USB chooser result',mock.options.chooser);
    let reader,closed=false,partial='',staged=[];
    const emit=line=>{if(!closed)reader.enqueue(new TextEncoder().encode(line+'\n'));};
    const handle=line=>{
      if(!line)return;mock.commands.push(line);
      const r=window.SkellyRuntime,g=window.SkellyStudioGenerator;
      mock.words??=r.encode([{name:'Saved porch',seconds:600,config:{...g.DEFAULTS,headMin:90,headMax:150}}],false,g.validate);
      const fields=line.split(' '),id=fields[3];
      if(line==='SKELLY HELLO')emit('USB CAPS v2 settings=1 scenes=4 randomScenes=1 audioScenes=1');
      else if(line==='SKELLY STATUS')emit('USB STATUS v2 runtime=1 connected=0 scene=0 sequence=2 pending=0 firmware=5 build=2026102402 wait=1 failures=0 heap=140000 clock=0');
      else if(fields[2]==='GET'){
        emit('USB CFG DUMP '+id+' '+mock.words.length+' 2 '+(r.crc(mock.words)+(mock.options.badReadback?1:0)));
        for(let at=0;at<mock.words.length;at+=8)emit('USB CFG DATA '+id+' '+at+' '+mock.words.slice(at,at+8).map(n=>(n>>>0).toString(16).padStart(8,'0')).join(' '));
        emit('USB CFG END '+id);
      }else if(fields[2]==='BEGIN'){staged=[];emit('USB CFG ACK '+id+' 0');}
      else if(fields[2]==='DATA'){
        assertOffset(Number(fields[4]),staged.length);staged.push(...fields.slice(5).map(s=>parseInt(s,16)));emit('USB CFG ACK '+id+' '+staged.length);
      }else if(fields[2]==='COMMIT'){
        if(mock.options.rejectSave){emit('USB CFG ERROR '+id+' STORAGE');return;}
        if(r.crc(staged)!==Number(fields[4]))throw Error('Mock received a bad CRC');
        mock.words=[...staged];mock.writes++;emit('USB CFG QUEUED '+id);emit('USB CFG APPLIED '+id+' 3 '+r.crc(staged));
      }
    };
    function assertOffset(a,b){if(a!==b)throw Error('Mock received an out-of-order chunk');}
    return {
      async open(){if(mock.options.openError)throw new DOMException('Simulated busy USB port',mock.options.openError);},
      async close(){if(!closed){closed=true;reader.close();}},
      readable:new ReadableStream({start(c){reader=c;},cancel(){closed=true;}}),
      writable:new WritableStream({write(bytes){partial+=new TextDecoder().decode(bytes);let end;while((end=partial.indexOf('\n'))!==-1){const line=partial.slice(0,end).trim();partial=partial.slice(end+1);handle(line);}}})
    };
  }};
  Object.defineProperty(navigator,'serial',{configurable:true,value:serial});
}

async function main(){
  const server=http.createServer((req,res)=>{
    let target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
    fs.readFile(target,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'})[path.extname(target)]||'text/plain');res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.SKELLY_BROWSER_CHANNEL?{channel:process.env.SKELLY_BROWSER_CHANNEL}:{})});
    async function run(name,fn,{width=1440,height=1000,unsupported=false}={}){
      const context=await browser.newContext({viewport:{width,height},hasTouch:width<=768,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(mockUsb);
      if(unsupported)await page.addInitScript(()=>Object.defineProperty(navigator,'serial',{configurable:true,value:undefined}));
      // The editor must work without fetching third-party scripts or services.
      await context.route('https://**',route=>route.abort());
      try{
        await page.goto(url+'/studio/');await page.waitForFunction(()=>document.querySelectorAll('#eyeGrid input').length===20);
        await fn(page,context);assert.deepEqual(errors,[],'Browser exceptions');
        results.push({name,result:'pass'});console.log('PASS '+name);
      }catch(error){
        await page.screenshot({path:path.join(artifacts,'failure-'+results.length+'.png'),fullPage:true});
        results.push({name,result:'fail',error:error.message});throw error;
      }finally{await context.close();}
    }
    const message=(page,pattern)=>page.locator('#controllerMessage').filter({hasText:pattern}).waitFor();
    const nav=async(page,hash)=>{
      const link=page.locator('.studio-nav a[href="'+hash+'"]');if(page.viewportSize().width<=768)await link.tap();else await link.click();
      // Native fragment navigation can briefly reset focus before hashchange.
      await page.waitForFunction(hash=>{const target=document.getElementById(hash.slice(1));return location.hash===hash&&target&&(target===document.activeElement||target.contains(document.activeElement));},hash);
    };
    const connect=async page=>{await nav(page,'#controllerPanel');await page.locator('#controllerConnect').click();await page.waitForFunction(()=>document.querySelector('#controllerUsb').textContent==='Ready');};
    const save=async page=>{await page.locator('#controllerConsent').check();await page.locator('#controllerWrite').click();await message(page,/read-back verified/);};
    const toggle=async(page,id,value)=>{if(await page.locator('#'+id).isChecked()!==value)await page.locator('.switch:has(#'+id+')').click();};
    const noOverflow=async page=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No page-level horizontal overflow');

    for(const [name,width,height] of [['desktop',1440,1000],['tablet',768,1024],['mobile',390,844],['narrow',320,740]]){
      await run('responsive, navigation and focus · '+name,async page=>{
        await noOverflow(page);
        if(['desktop','mobile'].includes(name))await page.screenshot({path:path.join(artifacts,'after-'+name+'.png')});
        // First Tab exposes a skip link and Enter moves focus past the masthead.
        await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.className),'skip-link');
        await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'personality');
        for(const hash of ['#movement','#expressions','#lighting','#scenes','#finish','#controllerPanel']){
          await nav(page,hash);
          const position=await page.locator(hash).evaluate(el=>({top:el.getBoundingClientRect().top,focus:el===document.activeElement||el.contains(document.activeElement),open:el.tagName!=='DETAILS'||el.open}));
          const navBottom=await page.locator('.studio-nav').evaluate(el=>el.getBoundingClientRect().bottom);
          assert.ok(position.top>=navBottom-1,hash+' is not covered by sticky navigation');assert.ok(position.top<height,hash+' is reached');assert.equal(position.focus,true,hash+' receives focus');assert.equal(position.open,true,hash+' opens');
        }
        // Open disclosures too: closed panels must not mask field overflow.
        await page.evaluate(()=>document.querySelectorAll('details').forEach(el=>el.open=true));
        await noOverflow(page);
        for(const selector of ['#deviceId','.switch','#sceneList','.eye-grid']){
          const box=await page.locator(selector).first().boundingBox();if(box)assert.ok(box.x+box.width<=width+1,selector+' fits');
        }
        for(const selector of ['.studio-nav a','.switch','.palette-edit','.eye-zoom','#newExample']){
          const boxes=await page.locator(selector).evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect().height));
          assert.ok(boxes.length&&boxes.every(h=>h>=44),selector+' has a 44px target');
        }
        assert.equal(await page.locator('.demo-moving').first().evaluate(el=>getComputedStyle(el).animationName),'none');
        await page.goto(url+'/studio/#controllerDiagnostics');assert.equal(await page.locator('#advanced').getAttribute('open'),'');assert.equal(await page.locator('#controllerDiagnostics').getAttribute('open'),'');
        await page.goto(url+'/studio/install.html');await noOverflow(page);
      },{width,height});
    }

    await run('beginner · find installation, configure and verify a simulated save',async page=>{
      assert.match(await page.locator('.hero p').textContent(),/ESP32 over USB/);
      await page.locator('[data-browser-install]').click();assert.match(page.url(),/install\.html$/);
      assert.match(await page.locator('h1').textContent(),/Set up your ESP32/);
      await page.locator('#prepareInstall').click();assert.match(await page.locator('#installerStatus').textContent(),/Confirm the board/);
      assert.equal(await page.evaluate(()=>mockUsb.opens),0);
      await page.locator('#configureSkelly').click();await nav(page,'#personality');await page.locator('[data-preset="subtle"]').click();
      assert.equal(await page.locator('#headMin').inputValue(),'60');assert.equal(await page.locator('#jawEnabled').isChecked(),false);
      await nav(page,'#finish');assert.equal(await page.locator('#previewWindow').count(),0);assert.equal(await page.locator('#finish .save-comparison').count(),0);assert.equal(await page.getByText('Coordination details',{exact:true}).count(),0);assert.equal(await page.getByText('Timing details',{exact:true}).count(),0);assert.equal(await page.locator('#timelineTitle').textContent(),'15-minute timing preview');assert.equal(await page.locator('#timelineMid').textContent(),'7:30');assert.equal(await page.locator('#timelineEnd').textContent(),'15:00');await page.locator('#newExample').click();assert.equal(await page.locator('[data-preset="subtle"]').getAttribute('aria-pressed'),'true');
      await connect(page);await save(page);assert.equal(await page.evaluate(()=>mockUsb.writes),1);
      assert.equal(await page.locator('[data-preset="subtle"]').getAttribute('aria-pressed'),'true');
      assert.match(await page.locator('#deviceSaveStatus').textContent(),/matches verified/);
      assert.equal(await page.locator('#controllerSkelly').textContent(),'Not connected yet');
    },{width:390,height:844});

    await run('returning user · read, edit head intervals, validate and save',async page=>{
      await connect(page);assert.equal(await page.locator('#first-run').getAttribute('open'),null);
      await page.locator('#controllerRead').click();await message(page,/Read 1 saved/);
      assert.equal(await page.locator('.preset[aria-pressed="true"]').count(),0);
      assert.equal(await page.evaluate(()=>new Promise(resolve=>{
        const node=document.querySelector('#deviceSaveStatus'),observer=new MutationObserver(()=>{});observer.observe(node,{childList:true,subtree:true});
        document.dispatchEvent(new CustomEvent('skelly-config-changed'));const count=observer.takeRecords().length;observer.disconnect();resolve(count);
      })),0,'Unchanged comparisons do not repeat live-region announcements');
      assert.equal(await page.locator('#headMin').inputValue(),'90');await nav(page,'#movement');
      await page.locator('#headMin').fill('1');assert.equal(await page.locator('#controllerWrite').isDisabled(),true);
      assert.equal(await page.locator('#validationJump').isVisible(),true);
      await nav(page,'#controllerPanel');assert.match(await page.locator('#error').textContent(),/Head/);assert.equal(await page.locator('#controllerScenes').isEnabled(),true);
      await nav(page,'#movement');await page.locator('#headMin').fill('120');await page.locator('#headMax').fill('180');
      assert.match(await page.locator('#deviceSaveStatus').textContent(),/editor changes are not in it/);
      await nav(page,'#controllerPanel');await save(page);
      assert.equal(await page.evaluate(()=>SkellyRuntime.decode(mockUsb.words,SkellyStudioGenerator.DEFAULTS).scenes[0].config.headMin),120);
      await page.locator('#controllerDisconnect').click();assert.match(await page.locator('#deviceSaveStatus').textContent(),/connect and read/);
    });

    await run('personality · customize eyes and lights, preview and save',async page=>{
      await page.locator('[data-preset="haunted"]').click();await nav(page,'#expressions');await page.locator('#eyeChoicesPanel>summary').click();
      assert.equal(await page.locator('[data-preset="haunted"]').getAttribute('aria-pressed'),'true');
      await page.locator('#eyeBehavior').selectOption('fixed');await page.locator('.eye-choice:has(input[value="8"])').click();
      assert.equal(await page.locator('.preset[aria-pressed="true"]').count(),0);
      await nav(page,'#lighting');await toggle(page,'lightsEnabled',true);await page.locator('[data-palette="haunted"]').click();
      await page.locator('#lightingChoicesPanel>summary').click();await page.locator('#torsoEffect').selectOption('3');await page.locator('#headEffect').selectOption('3');
      await nav(page,'#finish');assert.match(await page.locator('#lightSummary').textContent(),/Pulsing/);assert.match(await page.locator('#summaryEyeImage').getAttribute('src'),/eye_icon_8/);
      assert.match(await page.locator('#timeline').getAttribute('aria-label'),/not actual movement/);
      await connect(page);await save(page);
      const saved=await page.evaluate(()=>SkellyRuntime.decode(mockUsb.words,SkellyStudioGenerator.DEFAULTS).scenes[0].config);
      assert.equal(saved.eyesEnabled,true);assert.deepEqual(saved.eyeChoices,[8]);assert.equal(saved.torsoEffect,3);assert.equal(saved.lightsEnabled,true);
    },{width:390,height:844});

    for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]])await run('advanced scenes · create, edit, reorder and save · '+name,async page=>{
      await nav(page,'#scenes');await page.locator('#sceneName').fill('Porch');await page.locator('#sceneSave').click();
      await page.locator('#sceneName').fill('Late night');await nav(page,'#movement');await page.locator('#headMin').fill('120');await page.locator('#headMax').fill('180');
      await nav(page,'#scenes');await page.locator('#sceneSave').click();assert.equal(await page.locator('.scene-card').count(),2);
      await page.locator('.scene-card').filter({hasText:'Late night'}).locator('summary').click();await page.getByRole('button',{name:'Move scene Late night up',exact:true}).click();
      assert.equal(await page.locator('.scene-card-head strong').first().textContent(),'Late night');
      await page.getByRole('button',{name:'Edit scene Late night',exact:true}).click();await nav(page,'#movement');await page.locator('#headMin').fill('135');
      await nav(page,'#scenes');await page.locator('#sceneUpdate').click();await page.locator('#sceneRotate').check();await page.locator('#sceneOrder').selectOption('random');
      await connect(page);await page.locator('#controllerConsent').check();await page.locator('#controllerScenes').click();await message(page,/read-back verified/);
      const saved=await page.evaluate(()=>SkellyRuntime.decode(mockUsb.words,SkellyStudioGenerator.DEFAULTS));
      assert.deepEqual(saved.scenes.map(s=>s.name),['Late night','Porch']);assert.equal(saved.scenes[0].config.headMin,135);assert.equal(saved.random,true);assert.equal(saved.rotate,true);
      await page.reload();await nav(page,'#scenes');assert.equal(await page.locator('.scene-card-head strong').first().textContent(),'Late night');
    },{width,height});

    await run('recovery · unsupported USB browser retains offline editing and source export',async(page,context)=>{
      assert.equal(await page.locator('#controllerConnect').isDisabled(),true);assert.match(await page.locator('#controllerMessage').textContent(),/desktop Chrome or Edge/);
      await context.setOffline(true);await page.locator('[data-preset="subtle"]').click();await nav(page,'#finish');
      const pending=page.waitForEvent('download');await page.locator('#download').click();const download=await pending;
      const source=fs.readFileSync(await download.path(),'utf8');assert.match(source,/const bool HEAD_ENABLED = true/);assert.match(source,/#include <BLEDevice.h>/);
    },{unsupported:true});

    await run('recovery · chooser cancellation, busy port, rejected save and unverified read-back',async page=>{
      await page.evaluate(()=>mockUsb.options.chooser='NotFoundError');await page.locator('#controllerConnect').click();await message(page,/No USB port selected/);assert.equal(await page.evaluate(()=>mockUsb.commands.length),0);
      await page.evaluate(()=>{delete mockUsb.options.chooser;mockUsb.options.openError='NetworkError';});await page.locator('#controllerConnect').click();await message(page,/Close Arduino Serial Monitor/);
      await page.evaluate(()=>delete mockUsb.options.openError);await connect(page);await page.locator('#controllerConsent').check();
      await page.evaluate(()=>mockUsb.options.rejectSave=true);await page.locator('#controllerWrite').click();await message(page,/Save was not verified.*Read saved settings/);assert.equal(await page.evaluate(()=>mockUsb.writes),0);
      await page.evaluate(()=>delete mockUsb.options.rejectSave);await save(page);assert.equal(await page.locator('#deviceSaveStatus').getAttribute('data-state'),'ready');
      await page.evaluate(()=>mockUsb.options.badReadback=true);await page.locator('#controllerWrite').click();await message(page,/Read-back did not match/);
      assert.equal(await page.locator('#deviceSaveStatus').getAttribute('data-state'),'info');assert.equal(await page.locator('#controllerMessage').getAttribute('data-state'),'error');
      assert.equal(await page.evaluate(()=>mockUsb.commands.filter(c=>c.startsWith('SKELLY CFG COMMIT')).length),3);
    });

    await run('experimental model · setup links follow selection without opening a device',async page=>{
      await page.goto(url+'/studio/#advanced');await page.getByText('Experimental device compatibility',{exact:true}).click();await page.locator('#deviceId').selectOption('skelly12');
      assert.match(await page.locator('[data-browser-install]').getAttribute('href'),/device=skelly12/);assert.equal(await page.locator('#mouth').isVisible(),false);
      assert.equal(await page.evaluate(()=>mockUsb.opens),0);
    },{width:320,height:740});
  }finally{
    await browser?.close();await new Promise(resolve=>server.close(resolve));
    fs.writeFileSync(path.join(artifacts,'results.json'),JSON.stringify({evidence:'Software-only; all USB interactions simulated',results},null,2));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
