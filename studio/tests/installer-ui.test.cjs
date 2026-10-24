const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../install.html'),'utf8'),source=fs.readFileSync(path.join(__dirname,'../installer.js'),'utf8');
function page({serial=true,secure=true,search='',busy=false,dialog=false}={}){
 const nodes=Object.fromEntries([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],{dataset:{},checked:false,disabled:false,hidden:false,children:[],replaceChildren(...children){this.children=children;},addEventListener(){}}]));
 let requests=0,ports=0;
 const document={getElementById:id=>{assert.ok(nodes[id],id);return nodes[id];},querySelector:()=>dialog?{}:null};
 const window={isSecureContext:secure,SkellyRelease:require('../release.js'),SkellyUsbPortOpen:()=>busy,addEventListener(){}};
 const context=vm.createContext({document,window,location:{href:'https://example.org/studio/install.html'+search},navigator:{serial:serial?{requestPort(){ports++;throw Error('No USB access in tests');}}:null},URL,URLSearchParams,TextDecoder,AbortController,Uint8Array,crypto:globalThis.crypto,setTimeout:()=>1,clearTimeout(){},fetch:async()=>{requests++;return new Response('',{status:404});}});
 vm.runInContext(source,context);return {nodes,get requests(){return requests;},get ports(){return ports;}};
}
test('installer opens no USB or network on load and explicit overwrite consent gates preparation',async()=>{
 const p=page();assert.equal(p.requests,0);assert.equal(p.ports,0);await p.nodes.prepareInstall.onclick();assert.match(p.nodes.installerStatus.textContent,/Confirm/);assert.equal(p.requests,0);
 p.nodes.installConsent.checked=true;await p.nodes.prepareInstall.onclick();assert.equal(p.requests,1);assert.equal(p.ports,0);assert.match(p.nodes.installerStatus.textContent,/404.*No firmware was written/);assert.equal(p.nodes.prepareInstall.disabled,false);
});
test('unsupported browsers, insecure origins and unknown models fail closed before download or USB',async()=>{
 for(const options of [{serial:false},{secure:false},{search:'?device=unknown'}]){const p=page(options);assert.equal(p.nodes.prepareInstall.disabled,true);p.nodes.installConsent.checked=true;await p.nodes.prepareInstall.onclick();assert.equal(p.requests,0);assert.equal(p.ports,0);}
});
test('existing port sessions and open install dialogs block replacement packages',async()=>{
 for(const options of [{busy:true},{dialog:true}]){const p=page(options);p.nodes.installConsent.checked=true;await p.nodes.prepareInstall.onclick();assert.equal(p.requests,0);assert.equal(p.ports,0);assert.equal(p.nodes.installer.children.length,0);}
});
test('configuration handoff preserves deliberate experimental model and keeps its warning visible',()=>{
 const ultra=page(),experimental=page({search:'?device=skelly12'});assert.equal(ultra.nodes.installExperimental.hidden,true);assert.equal(ultra.nodes.configureSkelly.href,'./index.html#controllerPanel');
 assert.equal(experimental.nodes.installExperimental.hidden,false);assert.match(experimental.nodes.installModel.textContent,/Not Hardware Tested/);assert.equal(experimental.nodes.configureSkelly.href,'./index.html?device=skelly12#controllerPanel');
});
