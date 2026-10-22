/* Pure bounded USB program encoding; no serial port opens here. */
(function(){
  const schema=typeof module!=='undefined'?require('./runtime-schema.js'):window.SkellyRuntimeSchema;
  function crc(words){let c=0xffffffff;for(const word of words)for(let b=0;b<4;b++){c^=(word>>>(8*b))&255;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
  function packText(values,prefix,text,count){const bytes=new TextEncoder().encode(text);if(bytes.length>count*4)throw Error('A scene or palette name is too long.');for(let i=0;i<count;i++){let n=0;for(let b=0;b<4;b++)n|=(bytes[i*4+b]??0)<<(b*8);values[prefix+i]=n>>>0;}}
  function unpackText(values,prefix,count){const bytes=[];for(let i=0;i<count;i++)for(let b=0;b<4;b++){const n=(values[prefix+i]>>>(b*8))&255;if(!n)return new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes));bytes.push(n);}return new TextDecoder('utf-8',{fatal:true}).decode(new Uint8Array(bytes));}
  function encode(scenes,rotate,validate){
    if(!Array.isArray(scenes)||!scenes.length||scenes.length>4)throw Error('Choose one to four scenes.');
    const words=[schema.version,scenes.length,rotate?1:0];
    let name;const sceneNames=new Set();
    for(const [sceneIndex,scene] of scenes.entries()){
      const c=scene.config,errors=validate(c);if(errors.length)throw Error(errors.join('\n'));
      if(c.jawFollowupMotor===4)throw Error('The failed head-after-jaw diagnostic requires its separate generated sketch.');
      const bytes=new TextEncoder().encode(c.bleName.trim());
      if(!bytes.length||bytes.length>48)throw Error('USB device names must fit 48 UTF-8 bytes.');
      if(name!==undefined&&name!==c.bleName.trim())throw Error('All scenes must use the same Skelly Bluetooth name.');name=c.bleName.trim();
      const files=[c.jawFile,...c.jawExtras.split(',').filter(s=>s.trim()).map(Number)];
      const durations=new Map(c.jawDurations.split(',').filter(s=>s.trim()).map(s=>s.split(':').map(Number)));
      const values={...c,holdSec:scene.seconds??300,eyeMask:c.eyeChoices.reduce((m,i)=>m|1<<(i-1),0)||1,comboMask:c.compoundMasks.reduce((m,i)=>m|1<<([3,5,6,7].indexOf(i)),0),lightMask:c.lightPalettes.reduce((m,i)=>m|1<<i,0)||1,fileCount:files.length};
      for(let i=0;i<8;i++){values['file'+i]=files[i]??0;values['duration'+i]=durations.get(files[i])??0;}
      for(let i=0;i<12;i++){let n=0;for(let j=0;j<4;j++)n|=(bytes[i*4+j]??0)<<(j*8);values['name'+i]=n>>>0;}
      const label=scene.name??'Scene '+(sceneIndex+1);if(typeof label!=='string'||!label.trim()||label.length>32||/[\x00-\x1f]/.test(label)||sceneNames.has(label.trim()))throw Error('Use unique scene names with 1–32 characters.');sceneNames.add(label.trim());
      packText(values,'sceneLabel',label.trim(),32);
      for(let i=0;i<4;i++)packText(values,'paletteLabel'+i+'_',c['palette'+i+'Name'],24);
      for(const f of schema.fields){let n=values[f.name];if(typeof n==='boolean')n=Number(n);if(f.name.endsWith('Color')||/^palette\d(Torso|Head)$/.test(f.name))n=parseInt(n.slice(1),16);if(!Number.isSafeInteger(n)||n<f.min||n>f.max)throw Error('Invalid USB setting: '+f.name);words.push(n);}
    }
    return words;
  }
  function decode(words,defaults){
    if(words[0]!==1||!Number.isInteger(words[1])||words[1]<1||words[1]>4||![0,1].includes(words[2])||words.length!==3+words[1]*schema.fields.length)throw Error('Unsupported controller settings.');
    const scenes=[];
    for(let n=0;n<words[1];n++){
      const values=Object.fromEntries(schema.fields.map((f,i)=>[f.name,words[3+n*schema.fields.length+i]]));
      for(const f of schema.fields)if(!Number.isSafeInteger(values[f.name])||values[f.name]<f.min||values[f.name]>f.max)throw Error('Invalid controller setting: '+f.name);
      const c={...defaults};for(const [key,value] of Object.entries(defaults))if(Object.hasOwn(values,key))c[key]=typeof value==='boolean'?!!values[key]:values[key];
      for(const key of ['torsoColor','headColor',...Array.from({length:4},(_,i)=>['palette'+i+'Torso','palette'+i+'Head']).flat()])c[key]='#'+values[key].toString(16).padStart(6,'0');
      c.eyeChoices=Array.from({length:18},(_,i)=>i+1).filter(i=>values.eyeMask&(1<<(i-1)));c.compoundMasks=[3,5,6,7].filter((_,i)=>values.comboMask&(1<<i));c.lightPalettes=[0,1,2,3].filter(i=>values.lightMask&(1<<i));
      c.jawFile=values.file0;c.jawExtras=Array.from({length:values.fileCount-1},(_,i)=>values['file'+(i+1)]).join(', ');c.jawDurations=Array.from({length:values.fileCount},(_,i)=>values['duration'+i]?values['file'+i]+':'+values['duration'+i]:null).filter(Boolean).join(', ');
      const bytes=[];for(let i=0;i<12;i++)for(let j=0;j<4;j++){const b=(values['name'+i]>>>(j*8))&255;if(b)bytes.push(b);}c.bleName=new TextDecoder().decode(new Uint8Array(bytes));
      for(let i=0;i<4;i++)c['palette'+i+'Name']=unpackText(values,'paletteLabel'+i+'_',24);
      scenes.push({name:unpackText(values,'sceneLabel',32)||'Controller scene '+(n+1),seconds:values.holdSec,config:c});
    }
    return {scenes,rotate:!!words[2]};
  }
  const api={schema,crc,encode,decode};if(typeof module!=='undefined')module.exports=api;if(typeof window!=='undefined')window.SkellyRuntime=api;
})();
