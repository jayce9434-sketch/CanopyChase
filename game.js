(() => {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const TAU = Math.PI * 2;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[(Math.random()*a.length)|0];
const now=()=>Date.now();
const chance=p=>Math.random()<p;
const fmt=s=>String(s??'').trim();

let W=innerWidth,H=innerHeight,DPR=1,last=performance.now(),time=0,started=false,deferredInstall=null;
const WORLD={w:2600,h:1800};
const MAPS={
  forest:{name:'FOREST',x:110,y:100,w:1340,h:1420,spawn:{x:640,y:720},theme:'forest'},
  plaza:{name:'HAT PLAZA',x:1560,y:200,w:830,h:620,spawn:{x:1920,y:520},theme:'plaza'},
  cave:{name:'DARK CAVES',x:1560,y:930,w:830,h:700,spawn:{x:1920,y:1250},theme:'cave'},
  boards:{name:'LEADERBOARDS',x:1540,y:40,w:900,h:620,spawn:{x:1930,y:360},theme:'boards'}
};

const POIS={
  forest:[
    {id:'bigTree',name:'big tree',x:1160,y:430},{id:'log',name:'big log',x:650,y:650},
    {id:'river',name:'forest path',x:760,y:760},{id:'corner',name:'quiet corner',x:320,y:1260}
  ],
  plaza:[
    {id:'hats',name:'hat stand',x:1740,y:410},{id:'mirror',name:'mirror',x:2210,y:610},
    {id:'center',name:'plaza center',x:1940,y:520},{id:'shop',name:'shop',x:1810,y:690}
  ],
  cave:[
    {id:'entrance',name:'cave entrance',x:1650,y:1060},{id:'deep',name:'deep cave',x:2230,y:1470},
    {id:'rocks',name:'rock pile',x:1930,y:1280},{id:'dark',name:'dark corner',x:2280,y:1080}
  ],
  boards:[
    {id:'board',name:'leaderboard',x:1870,y:110},{id:'ring',name:'practice ring',x:2200,y:110}
  ]
};

const defaults={
  acorns:650, room:'PUBLIC', mode:'Tag', map:'forest', colorCode:'597', volume:.58, skill:.68,
  reducedMotion:false, voices:true, playerName:'YOU', eventStart:now(), lastSeen:now(), bannedUntil:0,
  owned:['bare','ownerBeacon'], equipped:{hat:'bare',holdable:null,shirt:null,back:null,face:null},
  stats:{tags:0,wins:0,rounds:0,bestSurvival:0}
};
let save={...defaults,stats:{...defaults.stats},equipped:{...defaults.equipped}};
try{
  const s=JSON.parse(localStorage.getItem('canopyChaseSave')||'null');
  if(s){
    save={...defaults,...s,stats:{...defaults.stats,...(s.stats||{})},equipped:{...defaults.equipped,...(s.equipped||{})}};
    if(typeof s.equipped==='string'){save.equipped={...defaults.equipped,hat:s.equipped};}
    if(!Array.isArray(save.owned))save.owned=['bare','ownerBeacon'];
    if(!save.owned.includes('ownerBeacon'))save.owned.push('ownerBeacon');
  }
}catch(e){}
function persist(){save.lastSeen=now();localStorage.setItem('canopyChaseSave',JSON.stringify(save));updateHud();}

const cosmetics=[
  {id:'bare',name:'No Hat',cat:'hat',emoji:'🙂',price:0},
  {id:'leaf',name:'Leaf Crown',cat:'hat',emoji:'🍃',price:120},
  {id:'cap',name:'Trail Cap',cat:'hat',emoji:'🧢',price:140},
  {id:'wizard',name:'Moss Wizard',cat:'hat',emoji:'🧙',price:210},
  {id:'cowboy',name:'Twig Cowboy',cat:'hat',emoji:'🤠',price:180},
  {id:'shades',name:'Leaf Shades',cat:'face',emoji:'😎',price:170},
  {id:'mask',name:'Runner Mask',cat:'face',emoji:'🥷',price:185},
  {id:'moustache',name:'Fake Mustache',cat:'face',emoji:'🥸',price:150},
  {id:'stick',name:'Legendary Stick',cat:'holdable',emoji:'🪵',price:130},
  {id:'lantern',name:'Glow Lantern',cat:'holdable',emoji:'🏮',price:220},
  {id:'banana',name:'Emergency Banana',cat:'holdable',emoji:'🍌',price:145},
  {id:'hoodie',name:'Canopy Hoodie',cat:'shirt',emoji:'🥼',price:200},
  {id:'hawaii',name:'Jungle Shirt',cat:'shirt',emoji:'👕',price:175},
  {id:'runner',name:'Tag Runner Jersey',cat:'shirt',emoji:'🎽',price:195},
  {id:'pack',name:'Explorer Pack',cat:'back',emoji:'🎒',price:230},
  {id:'wings',name:'Leaf Wings',cat:'back',emoji:'🪽',price:275},
  {id:'ownerBeacon',name:'OWNER BEACON',cat:'back',emoji:'📡',price:0,special:true}
];
const eventCosmetics=[
  {id:'haunted',name:'Haunted Hood',cat:'hat',emoji:'👻',price:280,event:true},
  {id:'pumpkin',name:'Pumpkin Visor',cat:'face',emoji:'🎃',price:300,event:true},
  {id:'phantom',name:'Phantom Cape',cat:'back',emoji:'🟣',price:360,event:true},
  {id:'spider',name:'Spider Buddy',cat:'holdable',emoji:'🕷️',price:330,event:true}
];
const eventLength=3*24*60*60*1000;
const eventActive=()=>now()<save.eventStart+eventLength;
const allCos=()=>cosmetics.concat(eventActive()?eventCosmetics:[]);
const cosmeticById=id=>cosmetics.concat(eventCosmetics).find(c=>c.id===id);

const userPool=['MOSSY','TreeJuice','BananaOrbit','N0BRANCH','EchoCub','TwigRunner','SpookyLeaf','BlueMango','VineKid','FroggyVR','PineconeX','CloudChimp','Sappy','MintMonke','BarkByte','RootRacer','Shroomie','PebbleTag','LeafLag','AcornAce','LimeLoop','CavePop','BirchBoy','MoonVine','BugHat','FernFever','NoSleepVR','ToastBranch','GreenBean','GoofyLog'];
const botColors=['#ff7369','#6edbff','#ffcc67','#b286ff','#71ef8b','#ff88d2','#f2f2f2','#ff9f61','#75a7ff','#d5ff6a'];
const botBanUntil=new Map();
const botConversation={topic:'lobby',lastSpeaker:null,nextAt:7};
let lastPlayerSpeakAt=-999;

const obstacles=[];
function addTree(x,y,r=38){obstacles.push({type:'tree',x,y,r,map:'forest'});}
function addRock(x,y,r=45,map='forest'){obstacles.push({type:'rock',x,y,r,map});}
for(let i=0;i<31;i++)addTree(rand(200,1360),rand(200,1400),rand(26,48));
[[260,300,42],[520,490,54],[860,330,35],[1080,570,46],[350,900,34],[760,990,52],[1160,1120,48]].forEach(v=>addRock(...v));
obstacles.push({type:'log',x:650,y:650,w:210,h:42,map:'forest'},{type:'log',x:1040,y:830,w:180,h:38,map:'forest'});
for(let i=0;i<12;i++)addRock(rand(1630,2310),rand(1030,1550),rand(34,70),'cave');

const player={
  x:MAPS.forest.spawn.x,y:MAPS.forest.spawn.y,vx:0,vy:0,r:28,angle:0,color:'#70d98b',
  left:{x:-42,y:28,grip:false,index:false},right:{x:42,y:28,grip:false,index:false},
  tagger:false,infected:false,chat:'',chatUntil:0,ghostShell:null,soloWhileBanned:false,
  mods:{longArms:false,platforms:false,ghost:false,invisible:false,kickGun:false,banGun:false,soundboard:false}
};
function colorFromCode(code){
  const d=String(code||'597').padEnd(3,'5').slice(0,3).split('').map(n=>clamp(+n||0,0,9));
  return `rgb(${Math.round(40+d[0]/9*210)},${Math.round(40+d[1]/9*210)},${Math.round(40+d[2]/9*210)})`;
}
player.color=colorFromCode(save.colorCode);
let platforms=[],bots=[],roundTimer=0,activeGlowFraction=0,morse=null,morseRollDone=false;

function randomOutfit(forceBeacon=false){
  const items=cosmetics.concat(eventActive()?eventCosmetics:[]);
  const out={hat:'bare',face:null,holdable:null,shirt:null,back:null};
  for(const cat of ['hat','face','holdable','shirt','back']){
    const pool=items.filter(c=>c.cat===cat && c.id!=='ownerBeacon');
    if(cat==='hat'||chance(.55))out[cat]=pick(pool).id;
  }
  if(forceBeacon||chance(.015))out.back='ownerBeacon';
  return out;
}
function safeSpawn(mapKey=save.map){
  const m=MAPS[mapKey]||MAPS.forest;
  for(let tries=0;tries<30;tries++){
    const p={x:rand(m.x+80,m.x+m.w-80),y:rand(m.y+80,m.y+m.h-80)};
    if(!obstacles.some(o=>o.map===mapKey && Math.hypot(p.x-o.x,p.y-o.y)<(o.r||80)+55))return p;
  }
  return {...m.spawn};
}
function newBot(id,respawn=false){
  const p=safeSpawn(save.map);
  const b={
    id,name:pick(userPool)+(chance(.18)?String((Math.random()*99)|0):''),x:p.x,y:p.y,vx:0,vy:0,r:25,color:pick(botColors),outfit:randomOutfit(),
    tagger:false,infected:false,state:'roam',think:rand(.15,.6),skill:clamp(save.skill+rand(-.17,.17),.32,.96),fear:save.room==='666'?rand(.12,.35):0,
    chat:'',chatUntil:0,score:(Math.random()*18)|0,lastTag:0,pathAngle:rand(0,TAU),wanderTarget:safeSpawn(save.map),
    joinFlash:respawn?1.6:0,stuckTime:0,lastX:p.x,lastY:p.y,followUntil:0,followPlayer:false,followAngle:rand(0,TAU),followRadius:rand(105,185),lastHeard:'',socialCooldown:rand(3,8),memory:{topic:'lobby',lastUser:'',lastReply:''},
    map:save.map,travel:null,waitUntil:0,goal:null,goalUntil:0,fleePlayerUntil:0,
    personality:pick(['friendly','chaotic','cautious','competitive','chill']),favoriteMap:pick(['forest','plaza','cave','boards']),
    knowsMorse:chance(save.room==='666'?.72:.46),morseSeen:false,
    memory:{playerName:save.playerName,lastTopic:'lobby',lastPlayerLine:'',lastPromise:'',lastBotLine:'',metAt:time}
  };
  return b;
}
function fillBots(){
  if(player.soloWhileBanned)return;
  while(bots.length<9){
    const b=newBot((Math.random()*1e7)|0,true);
    if(botBanUntil.get(b.name)>now())continue;
    bots.push(b);
  }
}
fillBots();

function teleportEntity(e,mapKey){const p=safeSpawn(mapKey);e.x=p.x;e.y=p.y;e.vx=e.vy=0;}
function botMap(bot){return bot?.map||save.map;}
function botsHere(mapKey=save.map){return bots.filter(b=>botMap(b)===mapKey&&(!b.travel||b.travel.departAt&&time<b.travel.departAt));}
function sendBotToMap(bot,mapKey,reason='going there'){
  if(!bot||!MAPS[mapKey])return false;
  if(botMap(bot)===mapKey&&!bot.travel){bot.wanderTarget=safeSpawn(mapKey);bot.goal=null;return true;}
  bot.travel={to:mapKey,departAt:time+1.05,arriveAt:time+rand(2.0,3.3),reason};bot.state='travel';bot.goal=null;bot.memory.lastPromise=`go to ${MAPS[mapKey].name}`;return true;
}
function setMap(mapKey){
  if(!MAPS[mapKey])return;
  const previousMap=save.map;
  save.map=mapKey;persist();teleportEntity(player,mapKey);
  if(save.mode==='Casual'){
    const followers=bots.filter(b=>b.followPlayer&&time<b.followUntil);
    followers.forEach((b,i)=>{b.travel={to:mapKey,arriveAt:time+.45+i*.12+rand(0,.45),reason:'following you'};});
    const already=bots.filter(b=>botMap(b)===mapKey&&!b.travel).length+followers.length;
    if(already<4){
      bots.filter(b=>!followers.includes(b)&&botMap(b)!==mapKey&&!b.travel).sort(()=>Math.random()-.5).slice(0,4-already).forEach((b,i)=>{b.travel={to:mapKey,arriveAt:time+.7+i*.18+rand(0,.8),reason:'changing maps'};});
    }
  }else{
    bots.forEach(b=>{b.map=mapKey;b.travel=null;teleportEntity(b,mapKey);});
  }
  $('#panel').classList.add('hidden');toast(`TRAVELED TO ${MAPS[mapKey].name}`);
  if(previousMap==='cave'&&mapKey!=='cave'){morse=null;morseRollDone=false;}
  if(mapKey==='cave'&&previousMap!=='cave'){
    morseRollDone=false;setTimeout(rollMorseForCave,450);
    if(save.room==='666')setTimeout(()=>scarySound(pick(['whisper','drone','scrape']),true),900);
  }
}

function resetMode(){
  player.tagger=false;player.infected=false;roundTimer=0;
  bots.forEach(b=>{b.tagger=false;b.infected=false;b.state='roam';b.waitUntil=0;b.fleePlayerUntil=0;});
  if(player.soloWhileBanned||save.mode==='Casual')return;
  bots.forEach(b=>{b.map=save.map;b.travel=null;teleportEntity(b,save.map);});
  if(save.mode==='Tag'){chance(.2)?player.tagger=true:pick(bots).tagger=true;}
  else if(save.mode==='Infection'&&bots.length)pick(bots).infected=true;
  else if(save.mode==='Echo Hunt'&&bots.length)pick(bots).tagger=true;
}

const input={keys:{},left:{x:0,y:0},right:{x:0,y:0}};
addEventListener('keydown',e=>{input.keys[e.key.toLowerCase()]=true;if(e.key==='Escape')$('#panel').classList.toggle('hidden');});
addEventListener('keyup',e=>input.keys[e.key.toLowerCase()]=false);
function bindStick(el,key){
  const knob=el.querySelector('.stickKnob');let pid=null;
  const reset=()=>{input[key].x=input[key].y=0;knob.style.transform='translate(0px,0px)';pid=null;};
  const move=e=>{const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,m=Math.hypot(dx,dy)||1;if(m>max){dx=dx/m*max;dy=dy/m*max;}input[key].x=dx/max;input[key].y=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`;};
  el.addEventListener('pointerdown',e=>{pid=e.pointerId;el.setPointerCapture(pid);move(e);});el.addEventListener('pointermove',e=>{if(e.pointerId===pid)move(e)});el.addEventListener('pointerup',e=>{if(e.pointerId===pid)reset()});el.addEventListener('pointercancel',reset);
}
bindStick($('#leftStick'),'left');bindStick($('#rightStick'),'right');

$$('[data-finger]').forEach(btn=>btn.addEventListener('pointerdown',()=>{
  const k=btn.dataset.finger,on=!btn.classList.contains('on');btn.classList.toggle('on',on);
  const h=k[0]==='l'?player.left:player.right;if(k.includes('Index'))h.index=on;else h.grip=on;
  if(k==='rIndex'&&on){if(player.mods.banGun)fireGun(true);else if(player.mods.kickGun)fireGun(false);}
}));

function handWorld(hand){return{x:player.x+hand.x,y:player.y+hand.y};}
function targetedBot(){
  const h=handWorld(player.right),dir={x:Math.cos(player.angle),y:Math.sin(player.angle)};let best=null,bestScore=1e9;
  for(const b of botsHere()){const vx=b.x-h.x,vy=b.y-h.y,t=vx*dir.x+vy*dir.y;if(t<0||t>700)continue;const side=Math.abs(vx*dir.y-vy*dir.x);const score=side+t*.035;if(side<65&&score<bestScore){best=b;bestScore=score;}}
  return best;
}
function fireGun(isBan){const b=targetedBot();if(!b){toast(`${isBan?'BAN':'KICK'} GUN: NO TARGET`);sfx('click');return;}isBan?banBot(b,4*60*1000,'YOU'):kickBot(b,'YOU');}
function kickBot(bot,by='MORSE'){
  const name=bot.name;bots=bots.filter(b=>b!==bot);toast(`${name} KICKED BY ${by}`);sfx('kick');
  setTimeout(()=>{fillBots();if(!player.soloWhileBanned)toast('A NEW BOT JOINED');},1600);
}
function banBot(bot,ms=240000,by='MORSE'){
  botBanUntil.set(bot.name,now()+ms);const name=bot.name;bots=bots.filter(b=>b!==bot);toast(`${name} BANNED 4 MIN • ${by}`);sfx('kick');setTimeout(fillBots,1700);
}

const audio={ctx:null,master:null,musicTimer:null};
function ensureAudio(){if(audio.ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;audio.ctx=new AC();audio.master=audio.ctx.createGain();audio.master.gain.value=save.volume;audio.master.connect(audio.ctx.destination);startMusic();}
function tone(freq=300,dur=.12,type='sine',vol=.07,slide=0){ensureAudio();if(!audio.ctx)return;const c=audio.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),c.currentTime+dur);g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+dur);o.connect(g);g.connect(audio.master);o.start();o.stop(c.currentTime+dur);}
function noise(dur=.25,vol=.05,filter=900){ensureAudio();if(!audio.ctx)return;const c=audio.ctx,buf=c.createBuffer(1,Math.max(1,c.sampleRate*dur|0),c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const s=c.createBufferSource(),g=c.createGain(),f=c.createBiquadFilter();s.buffer=buf;f.type='lowpass';f.frequency.value=filter;g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+dur);s.connect(f);f.connect(g);g.connect(audio.master);s.start();}
function sfx(kind){if(kind==='tag'){tone(520,.08,'square',.06,180);setTimeout(()=>tone(760,.09,'sine',.05,160),45)}else if(kind==='kick'){tone(130,.16,'sawtooth',.08,-65);noise(.18,.05,400)}else if(kind==='buy'){tone(420,.1,'triangle',.05,220);setTimeout(()=>tone(700,.16,'triangle',.05,240),80)}else if(kind==='join')tone(300,.1,'sine',.035,180);else tone(300,.05,'square',.025,40);}
function startMusic(){if(audio.musicTimer)return;let step=0;audio.musicTimer=setInterval(()=>{if(!started||document.hidden||save.volume<=0)return;const cave=save.map==='cave',scale=cave?[98,110,92,82,98,73]:[196,220,247,294,247,220,196,165];tone(scale[step++%scale.length],.34,cave?'sine':'triangle',cave?.008:.013,0);},520);}
function scarySound(kind,ambient=false){
  ensureAudio();
  if(kind==='static'){for(let i=0;i<4;i++)setTimeout(()=>noise(.22,.1,rand(300,2200)),i*140)}
  if(kind==='whisper'){noise(1.2,.045,500);tone(92,1.3,'sine',.025,-25)}
  if(kind==='alarm'){for(let i=0;i<5;i++)setTimeout(()=>tone(i%2?980:650,.18,'square',.055),i*190)}
  if(kind==='heartbeat'){for(let i=0;i<4;i++)setTimeout(()=>{tone(74,.11,'sine',.09,-18);setTimeout(()=>tone(62,.13,'sine',.07,-12),120)},i*560)}
  if(kind==='scrape'){noise(1,.08,1500);tone(180,.9,'sawtooth',.025,520)}
  if(kind==='drone'){tone(58,2.4,'sawtooth',.045,-14);tone(87,2.4,'sine',.03,-22)}
  botsHere().forEach(b=>{b.fear=clamp(b.fear+rand(.65,1.15),0,2);b.state='flee';if(chance(.58)&&time>b.chatUntil)botSpeak(b,pick(['WHAT WAS THAT?!','NOPE NOPE NOPE','turn that OFF 😭','I HEARD THAT','RUNNN','that sound came from the cave']))});
  if(!ambient)toast('SOUNDBOARD • THE LOBBY HEARD THAT');
}
function morseBeep(){
  const seq=pick(['... --- ...','-- --- .-. ... .','..-. --- .-.. .-.. --- .--','.-. ..- -.']);let delay=0;
  for(const ch of seq){if(ch===' '){delay+=120;continue;}setTimeout(()=>tone(ch==='.'?760:430,ch==='.'?.08:.23,'square',.045),delay);delay+=ch==='.'?130:270;}
}

function speakText(text,bot=null){
  if(!save.voices||!('speechSynthesis' in window))return;
  const u=new SpeechSynthesisUtterance(String(text).replace(/[😭👻💀]/g,''));
  const vibe=bot?.personality||'friendly';
  const voiceStyle={friendly:[1.02,1.08],chaotic:[1.08,1.18],cautious:[.94,.93],competitive:[1.06,1.02],chill:[.92,.98]}[vibe]||[1,1];
  u.rate=voiceStyle[0]+rand(-.035,.035);u.pitch=voiceStyle[1]+rand(-.04,.04);u.volume=save.volume*.68;speechSynthesis.speak(u);
}
function botSpeak(bot,text,voice=false){
  if(!bot)return;const full=String(text).slice(0,240);bot.chat=full.slice(0,112);bot.chatUntil=time+Math.max(3.2,bot.chat.length*.052);bot.lastHeard=full;
  if(bot.memory)bot.memory.lastBotLine=full;
  if(botMap(bot)===save.map)addChatMessage(bot.name,full,'bot');
  if(voice)speakText(full,bot);
}

function addChatMessage(name,message,kind='bot'){
  const log=$('#chatLog');if(!log)return;
  const d=document.createElement('div');d.className='chatMsg '+(kind||'bot');
  if(kind==='system'){d.textContent=String(message);}
  else{const b=document.createElement('b');b.textContent=name;const span=document.createElement('span');span.textContent=String(message);d.append(b,span);}
  log.appendChild(d);while(log.children.length>70)log.firstChild.remove();log.scrollTop=log.scrollHeight;
}
function meaningfulWords(text){return text.toLowerCase().replace(/[^a-z0-9' ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!['that','this','with','have','just','what','when','where','there','your','youre','about','really','from','would','could','should','into','then','than','they','them','were','been','will'].includes(w));}
function mapMention(text){
  const s=String(text).toLowerCase();
  if(/leader|boards?|score hall|practice ring/.test(s))return'boards';
  if(/hat plaza|plaza|shop|market|cosmetic/.test(s))return'plaza';
  if(/dark cave|caves?|deep cave/.test(s))return'cave';
  if(/forest|woods?|trees?/.test(s))return'forest';
  return null;
}
function poiMention(text,mapKey){
  const s=String(text).toLowerCase(), list=POIS[mapKey]||[];
  const aliases={bigTree:['big tree','tree'],log:['big log','log'],river:['forest path','path','river'],corner:['quiet corner','corner'],hats:['hat stand','hats'],mirror:['mirror'],center:['plaza center','center'],shop:['shop','store'],entrance:['cave entrance','entrance'],deep:['deep cave','deep'],rocks:['rock pile','rocks'],dark:['dark corner'],board:['leaderboard','board'],ring:['practice ring','ring']};
  return list.find(p=>(aliases[p.id]||[p.name]).some(a=>s.includes(a)))||null;
}
function classify(text){
  const s=text.toLowerCase().replace(/[!?.,]/g,' ').replace(/\s+/g,' ').trim();
  if(/\b(morse is here|morse is right here|i saw morse|i see morse|morse spawned|morse appeared|morse is in|there'?s morse|there is morse|black 000|long armed ghost|long arms.*black)\b/.test(s))return'morseReport';
  if(/\b(i[' ]?m|i am|i feel|im feeling) (really |so |kinda |kind of |pretty )?(scared|afraid|terrified|nervous|creeped out|freaked out|spooked)\b|\bthis is scary\b|\bim scared\b/.test(s))return'playerFear';
  if(/\b(i[' ]?m|i am|i feel|im feeling) (really |so |pretty )?(happy|good|great|awesome|excited|hyped|glad)\b/.test(s))return'playerHappy';
  if(/\b(i[' ]?m|i am|i feel|im feeling) (really |so |pretty )?(sad|upset|down|lonely|bad)\b/.test(s))return'playerSad';
  if(/\b(i[' ]?m|i am|i feel|im feeling) (really |so |pretty )?(mad|angry|annoyed|frustrated|furious)\b/.test(s))return'playerAngry';
  if(/\b(i[' ]?m|i am|i feel) (really |so )?(confused|lost)\b|\bi (dont|don't) understand\b/.test(s))return'playerConfused';
  if(/\b(i[' ]?m|i am|i feel) (really |so )?(tired|sleepy|exhausted)\b/.test(s))return'playerTired';
  if(/\b(i[' ]?m|i am|i feel) (really |so |pretty )?(bored|restless)\b|\bthis is boring\b/.test(s))return'playerBored';
  if(/\b(i love|i like|i really like|i kinda like|this is cool|this is awesome|this is fun)\b/.test(s))return'like';
  if(/\b(i hate|i dont like|i don't like|this sucks|this is awful|this is annoying)\b/.test(s))return'dislike';
  if(/\b(i (can )?hear|i heard|did you hear|can you hear|listen|hearing|sound|noise)\b/.test(s))return'senseHear';
  if(/\b(i (can )?see|i saw|did you see|can you see|look|looking at|over there)\b/.test(s))return'senseSee';
  if(/^\s*(hi|hey|hello|yo|sup|hiya|wassup|what'?s up|whats up)(\s+\w+)?\s*$/.test(s)||/\b(good morning|good afternoon|good evening)\b/.test(s))return'greet';
  if(/\b(bye|goodbye|cya|see ya|later|gtg|gotta go)\b/.test(s))return'bye';
  if(/what('?s| is) your name|who are you/.test(s))return'name';
  if(/what are you doing|what you doing|wyd\b/.test(s))return'doing';
  if(/what do you want to do|what do you wanna do|wanna do something|want to go somewhere|pick somewhere|where should we go/.test(s))return'plan';
  if(/where are you going|where you going|where you headed/.test(s))return'wheregoing';
  if(/\b(follow me|come with me|stay with me|stick with me|come here|come over here)\b/.test(s))return'follow';
  if(/\b(stop following|leave me alone|dont follow|don't follow|stop coming with me)\b/.test(s))return'unfollow';
  if(/\b(wait here|stay here|hold here|dont move|don't move|stay put)\b/.test(s))return'wait';
  if(/\b(run away|get away|go away|back up|run from me|leave)\b/.test(s))return'flee';
  if(/\b(meet me|go to|head to|walk to|run to|race to|come to|let'?s go|wanna go|want to go|go over to|come with me to)\b/.test(s)&&mapMention(s))return'goMap';
  if(/\b(go to|head to|walk to|run to|stand by|wait by|meet me at|go by|come to)\b/.test(s))return'goPlace';
  if(/where.*(cave|forest|plaza|leaderboard|shop)|how.*get.*(cave|forest|plaza|leaderboard)/.test(s))return'directions';
  if(/\b(morse|ghost|haunt|haunted|creepy|scary|spooky)\b/.test(s))return'ghost';
  if(/room 666|\b666\b/.test(s))return'666';
  if(/cosmetic|hat|shirt|back|face|holdable|outfit|wearing|wear/.test(s))return'cosmetic';
  if(/glow stone|currency|money|stone/.test(s))return'currency';
  if(/tagger|infection|tag|chase|echo hunt/.test(s))return'tag';
  if(/map|forest|cave|plaza|leaderboard/.test(s))return'map';
  if(/owner|beacon/.test(s))return'beacon';
  if(/how are you|you good|doing okay|are you okay|how you doing/.test(s))return'mood';
  if(/are you scared|you scared|afraid|nervous/.test(s))return'fear';
  if(/thank|thanks|tysm|\bty\b/.test(s))return'thanks';
  if(/sorry|my bad/.test(s))return'sorry';
  if(/funny|joke/.test(s))return'joke';
  if(/^\s*(yes|yeah|yep|yup|sure|okay|ok|bet|alright)\s*$/.test(s))return'yes';
  if(/^\s*(no|nope|nah|not really|dont|don't)\s*$/.test(s))return'no';
  if(/\bhelp\b|how do i|how can i/.test(s))return'help';
  if(/\bwhy\b/.test(s))return'why';
  if(/\bhow\b/.test(s))return'how';
  if(/\bwhere\b/.test(s))return'where';
  if(/\bwho\b/.test(s))return'who';
  if(/can you|could you|will you|would you/.test(s))return'request';
  if(/\?$/.test(text)||/\b(do|does|did|is|are|am|was|were|can|could|would|will)\b/.test(s))return'question';
  return'statement';
}
function cosmeticName(id){return cosmeticById(id)?.name||'nothing';}
function outfitSummary(bot){
  const worn=['hat','face','holdable','shirt','back'].map(k=>bot.outfit?.[k]).filter(Boolean).filter(id=>id!=='bare').map(cosmeticName);
  return worn.length?worn.slice(0,4).join(', '):'nothing special';
}
function setBotGoal(bot,poi,seconds=55){
  if(!bot||!poi)return;bot.travel=null;bot.goal={x:poi.x,y:poi.y,name:poi.name};bot.goalUntil=time+seconds;bot.followPlayer=false;bot.waitUntil=0;bot.state='goal';bot.memory.lastPromise=`go to ${poi.name}`;
}
function botActionFromPlayer(bot,text,intent){
  const s=text.toLowerCase(), current=botMap(bot), mentionedMap=mapMention(s), poi=poiMention(s,current);
  if(intent==='follow'){
    bot.travel=null;bot.followPlayer=true;bot.followUntil=time+180;bot.waitUntil=0;bot.goal=null;bot.fleePlayerUntil=0;
    if(mentionedMap&&mentionedMap!==current){sendBotToMap(bot,mentionedMap,'following you');bot.followPlayer=true;bot.followUntil=time+180;return{type:'travel',map:mentionedMap,follow:true};}
    if(current!==save.map)sendBotToMap(bot,save.map,'following you');
    return{type:'follow'};
  }
  if(intent==='unfollow'){bot.followPlayer=false;bot.followUntil=0;bot.goal=null;if(bot.state==='follow')bot.state='roam';return{type:'unfollow'};}
  if(intent==='wait'){bot.followPlayer=false;bot.followUntil=0;bot.travel=null;bot.goal={x:bot.x,y:bot.y,name:'here'};bot.waitUntil=time+90;bot.state='wait';return{type:'wait'};}
  if(intent==='flee'){bot.followPlayer=false;bot.followUntil=0;bot.fleePlayerUntil=time+10;bot.state='fleePlayer';return{type:'flee'};}
  if((intent==='goMap'||(/\b(go|head|walk|run|meet|race|come)\b/.test(s)&&mentionedMap))&&mentionedMap){
    sendBotToMap(bot,mentionedMap,'you asked');
    if(/with me|follow me|come with me|lets go|let's go/.test(s)){bot.followPlayer=true;bot.followUntil=time+180;}
    return{type:'travel',map:mentionedMap};
  }
  if((intent==='goPlace'||/\b(go|head|walk|run|stand|wait|meet)\b/.test(s))&&poi){setBotGoal(bot,poi);return{type:'goal',poi};}
  if(intent==='morseReport'){
    bot.knowsMorse=true;bot.morseSeen=true;bot.fear=Math.max(bot.fear,1.55);bot.state='flee';
    if(botMap(bot)==='cave'&&chance(.66)){sendBotToMap(bot,'forest','escaping Morse');return{type:'escapeMorse',map:'forest'};}
    return{type:'panicMorse'};
  }
  if(intent==='playerFear'&&morse&&botMap(bot)==='cave'){bot.knowsMorse=true;bot.fear=Math.max(bot.fear,1.05);}
  if(intent==='plan')return chooseBotPlan(bot,false);
  return null;
}
function chooseBotPlan(bot,announce=true){
  const here=botMap(bot);
  if(morse&&here==='cave'&&bot.knowsMorse){
    sendBotToMap(bot,'forest','getting away from Morse');const a={type:'travel',map:'forest',line:'NOPE. im getting out of the cave before Morse finds me 😭'};if(announce)botSpeak(bot,a.line);return a;
  }
  if(save.room==='666'&&here==='cave'&&(bot.personality==='cautious'||chance(.48))){
    sendBotToMap(bot,'forest','room 666 is freaking me out');const a={type:'travel',map:'forest',line:'im leaving this cave for a minute, room 666 is freaking me out 😭'};if(announce)botSpeak(bot,a.line);return a;
  }
  if(chance(.42)){
    let dest=bot.favoriteMap||pick(Object.keys(MAPS));if(dest===here)dest=pick(Object.keys(MAPS).filter(k=>k!==here));
    sendBotToMap(bot,dest,'wanted to explore');const a={type:'travel',map:dest,line:`im gonna head to ${MAPS[dest].name.toLowerCase()} for a bit`};if(announce)botSpeak(bot,a.line);return a;
  }
  const poi=pick(POIS[here]||[]);if(poi){setBotGoal(bot,poi);const a={type:'goal',poi,line:`im gonna go chill by the ${poi.name}`};if(announce)botSpeak(bot,a.line);return a;}
  const a={type:'none',line:'honestly im just chilling here'};if(announce)botSpeak(bot,a.line);return a;
}
function currentBotActivity(bot){
  if(bot.travel)return`heading to ${MAPS[bot.travel.to].name}`;
  if(bot.followPlayer)return`following ${save.playerName}`;
  if(bot.waitUntil>time)return'waiting here';
  if(bot.fleePlayerUntil>time)return'running away from you 😭';
  if(bot.goal&&bot.goalUntil>time)return`going to the ${bot.goal.name}`;
  if(bot.tagger||bot.infected)return'chasing people';
  if(bot.state==='flee')return'running from danger';
  return'chilling around';
}
function knowsGameAnswer(bot,text,intent){
  const s=text.toLowerCase();
  if(/what game|name of (the )?game|what is canopy chase|canopy chase/.test(s))return pick(['this is Canopy Chase — arm-run, tag, explore, buy cosmetics, and try not to get haunted 😭','Canopy Chase. movement, rooms, tag modes, Glow Stone, cosmetics, and the cave being suspicious as usual']);
  if(/how many (maps|areas)|what maps|maps are there|name the maps/.test(s))return'four maps: Forest, Hat Plaza, Dark Caves, and Leaderboards.';
  if(/what modes|game modes|how does (tag|infection|echo hunt|casual)|what is (tag|infection|echo hunt|casual)/.test(s))return'Casual is hangout/explore. Tag has one tagger. Infection spreads taggers. Echo Hunt has a hunter that chases everyone.';
  if(/glow stone|currency|how.*(earn|get).*stone|100.*hour|offline reward/.test(s))return'Glow Stone is the currency. Active play earns about 100 per hour. You need to actually come back and play, so being gone for weeks does not dump a huge offline reward on you.';
  if(/mini.?event|event cosmetic|three.?day|3.?day|event end/.test(s))return'the mini-event lasts 3 real days. The event items disappear from the shop after that, but anything you bought stays owned forever.';
  if(/owner beacon|beacon/.test(s))return bot.outfit.back==='ownerBeacon'?'I spawned with an Owner Beacon too. Bots only have a 1.5% chance to get one 😭':'the Owner Beacon is your special back cosmetic. Bots get excited and follow whoever has it. A bot only has a 1.5% chance to spawn with one.';
  if(/private room|room code|make a room|join room|new room/.test(s))return'use the menu to type a room code and JOIN, or press NEW for a random private code. Room 666 is special and makes the cave way creepier.';
  if(/color code|change color|monke color|body color/.test(s))return'the menu has a 3-digit color code. Each digit changes part of your RGB color. 000 is black.';
  if(/change.*name|rename|name changer|player name/.test(s))return'Settings has the name changer. Type a name and press RENAME.';
  if(/bot skill|skill slider|difficulty/.test(s))return'Settings has Bot Skill. Higher skill improves movement and decisions, but bots still make mistakes so they are not impossible.';
  if(/long arms|platforms|ghost monke|invisible monke|kick gun|ban gun|mod menu|thumb menu/.test(s))return'press the thumb button for your sandbox mod menu: Long Arms, Platforms, Ghost Monke, Invisible Monke, Kick Gun, Ban Gun, and the soundboard. Kick replaces a bot. Ban removes that bot for 4 real minutes.';
  if(/how.*(move|run)|joystick|hands|controls|finger/.test(s))return'on mobile, move both hand joysticks to swing and push yourself around. INDEX and GRIP control your fingers. R INDEX also fires Kick Gun or Ban Gun if one is selected.';
  if(/cosmetic|hat|shirt|holdable|face|back/.test(s)&&/what|how many|types|slot|equip|unequip/.test(s))return'cosmetics have five slots: hat, holdable, shirt, back, and face. Open the shop to equip or unequip things. Owner Beacon is a back cosmetic.';
  if(/ban screen|banned|ban timer|solo casual/.test(s))return'if Morse bans you, multiplayer locks for 2 real minutes. The timer keeps counting while the game is closed. You can use Solo Casual while you wait.';
  if(/kick(ed)? by morse|morse kick/.test(s))return'Morse can randomly kick you. A kick throws you out of the room for a few seconds, then you rejoin. A ban is longer and gives you the ban screen.';
  if(/morse/.test(s)&&/(6\.66|chance|percent|%|how often|spawn rate|appear rate)/.test(s))return'Morse has a 6.66% chance to appear on each fresh entry into Dark Caves.';
  if(/morse/.test(s)&&/(where.*spawn|where.*appear|where.*live|which map)/.test(s))return'Morse appears in Dark Caves. Every fresh cave entry rolls a 6.66% chance.';
  if(/morse/.test(s)&&/(what can|what does|powers|abilities|do to)/.test(s))return'Morse can vanish, move like Ghost Monke, use scary Morse-code sounds, kick bots, ban bots for 4 minutes, and can randomly kick or ban you too.';
  if(/morse/.test(s)){
    if(morse&&botMap(bot)==='cave')return null;
    if(!bot.knowsMorse)return pick(['Morse? who is that?','I keep hearing that name but I genuinely do not know who Morse is.','no idea who Morse is. is that another player?']);
    return pick(['Morse is the black 000 ghost in Dark Caves. Long arms, Morse-code beeps, scary audio, invisibility, Ghost Monke, Kick Gun, Ban Gun... basically run.','yeah I know Morse. black color 000, long arms, weird beeps, and mod powers. If Morse appears, do NOT stand around.','Morse is the cave ghost. It can vanish, use ghost/invisible, kick people, and ban them. I wish I did not know that 😭']);
  }
  if(/forest/.test(s)&&/what|where|like|in|there/.test(s))return'Forest is the open movement map with trees, logs, a path, a big tree, and lots of room to juke taggers.';
  if(/hat plaza|plaza/.test(s)&&/what|where|like|in|there/.test(s))return'Hat Plaza is the cosmetic area with the hat stand, mirror, center, and shop.';
  if(/dark caves?|cave/.test(s)&&/what|where|like|in|there/.test(s))return'Dark Caves is the creepy map with an entrance, deep cave, rock pile, dark corner, scary ambience, and a 6.66% Morse roll on each fresh cave entry.';
  if(/leaderboard|boards/.test(s)&&/what|where|like|in|there/.test(s))return'Leaderboards has the room scoreboard and a practice ring.';
  if(/voice|talk out loud|bot voices/.test(s))return'bot voice is text-to-speech only. You chat by typing; there is no microphone input.';
  if(/save|saving|data/.test(s))return'your name, currency, cosmetics, settings, room stuff, and timers are saved locally on this device.';
  if(/daily|three weeks|3 weeks|gone for/.test(s)&&/glow|reward|currency|stone/.test(s))return'you only build Glow Stone from active play. If you disappear for weeks, you do not come back to a giant pile for doing nothing.';
  return null;
}
function responseFor(bot,text,intent,action=null){
  const map=MAPS[botMap(bot)]?.name||MAPS[save.map].name,n=save.playerName||'you',v=bot.personality,s=text.toLowerCase(),mem=bot.memory||{};
  if(action?.type==='follow')return pick([`yeah, im with you ${n}`,`bet. lead the way`,`okay im following you — dont lose me 😭`]);
  if(action?.type==='unfollow')return pick([`okay okay, ill stop 😭`,`got you, im staying back`,`alright, doing my own thing`]);
  if(action?.type==='wait')return pick([`yeah ill wait right here`,`okay, im not moving`,`bet. ill stay here till you come back`]);
  if(action?.type==='flee')return pick([`BRO OKAY IM GOING 😭`,`fine fine im backing up`,`alright im outta here`]);
  if(action?.type==='travel')return pick([`yeah, im heading to ${MAPS[action.map].name.toLowerCase()} now`,`bet, meet you at ${MAPS[action.map].name.toLowerCase()}`,`okay im going to ${MAPS[action.map].name.toLowerCase()} — come find me`]);
  if(action?.type==='goal')return pick([`yeah, going to the ${action.poi.name} now`,`bet, ill be by the ${action.poi.name}`,`okay im heading over there`]);
  if(action?.type==='escapeMorse')return pick(['MORSE IS HERE?! IM LEAVING THE CAVE RIGHT NOW 😭','NOPE. RUN. im going to Forest.','GET OUT OF THE CAVE, MORSE IS HERE 😭']);
  if(action?.type==='panicMorse')return pick(['WAIT MORSE IS ACTUALLY HERE?? RUN 😭','NO NO NO I HEARD THE BEEPS TOO','MORSE?? stay away from the black 000 monke, im serious']);
  if(action?.line)return action.line;
  const knowledge=knowsGameAnswer(bot,text,intent);if(knowledge)return knowledge;
  const state=currentBotActivity(bot), scared=bot.fear>.45||(save.room==='666'&&botMap(bot)==='cave');

  if(intent==='yes'){
    const last=(mem.lastBotLine||'').toLowerCase();
    if(/wanna leave|move maps|go somewhere|where you wanna go|want to go/.test(last)){const a=chooseBotPlan(bot,false);return a.line||'okay, lets go';}
    if(/stay near|hang around|with you/.test(last)){bot.followPlayer=true;bot.followUntil=time+150;return pick(['okay, im staying with you','bet, im right here','yeah, I got you']);}
    return pick(['okay bet 😭','alright, lets do it','got you']);
  }
  if(intent==='no'){
    const last=(mem.lastBotLine||'').toLowerCase();
    if(/wanna leave|move maps|go somewhere/.test(last))return pick(['okay, we can stay here','bet, staying put','alright. tell me if you change your mind']);
    return pick(['fair enough','okay 😭','got you']);
  }
  if(intent==='playerFear'){
    bot.memory.lastTopic='fear';
    if(morse&&botMap(bot)==='cave'){bot.knowsMorse=true;bot.fear=Math.max(bot.fear,1.4);return pick(['ME TOO. Morse is literally here — get toward the cave entrance NOW 😭','DONT STOP MOVING 😭 Morse is here. Im getting out of this cave.','same. I heard the beeps. stay near us and RUN.']);}
    if(save.room==='666'&&botMap(bot)==='cave'){
      bot.fear=Math.max(bot.fear,.6);
      if((v==='friendly'||v==='cautious')&&!bot.travel){bot.followPlayer=true;bot.followUntil=time+55;}
      return v==='chaotic'?pick(['BRO SAME 😭 if I hear ONE beep im GONE','nahhh this cave feels wrong. stay moving 😭']):
             v==='cautious'?pick(['yeah... me too. stay close to me and keep listening for beeps.','I dont blame you. I keep checking the cave entrance.']):
             v==='chill'?pick(['yeah this room is creepy. we can just leave if you want.','I get it. lets not stay in the dark corner.']):
             pick(['yeah, I get it. Room 666 feels wrong. stay by me if you want.','same honestly. If we hear Morse-code beeps, we are leaving.','I dont blame you 😭 wanna go back to Forest with me?']);
    }
    if((v==='friendly'||v==='cautious')&&!bot.travel){bot.followPlayer=true;bot.followUntil=time+40;}
    return v==='chaotic'?pick(['WAIT WHAT HAPPENED 😭 did you see something??','okay WHO scared you 😭 point them out']):
           v==='cautious'?pick(['what scared you? did you hear something or see something?','stay close for a sec. tell me what happened.']):
           v==='competitive'?pick(['youre good. tell me what happened and we can move if we need to.','what got you scared? I can run with you.']):
           v==='chill'?pick(['I get it. wanna just stay here together for a minute?','yeah, thats fair. wanna leave this area or keep going?']):
           pick(['what scared you? did you hear something or see something?','stay near me for a sec. If it gets weird, we can leave the map.','I get it. wanna tell me what happened?']);
  }
  if(intent==='playerHappy')return pick(['AYYY good 😭 what happened?','W. what are we doing now?','nicee 😭 wanna run around Forest or go shop?']);
  if(intent==='playerSad')return pick(['aw man. wanna just chill here with me for a bit?','that sucks. I can follow you around if you dont wanna be alone.','we can take it easy. Casual is perfect for that.']);
  if(intent==='playerAngry')return pick(['yeah I can tell 😭 what happened?','okay who made you mad 😭','wanna run it off in Forest or just chill?']);
  if(intent==='playerConfused')return pick(['tell me what part. I know the maps, modes, rooms, cosmetics, controls, Morse, currency, and settings.','what are you trying to do? I can explain it or actually go with you.','say the thing youre stuck on and Ill help.']);
  if(intent==='playerTired')return pick(['then lets just chill in Casual 😭','Hat Plaza is calm if you wanna stop running for a bit.','you can just hang out. no need to sweat tag.']);
  if(intent==='playerBored')return pick(['lets do something then 😭 race me to another map','switch modes. Tag or Echo Hunt gets chaotic fast','come to Forest, I wanna try a route','go Dark Caves if you want the game to stop being boring real quick 😭']);
  if(intent==='like'){
    if(/forest/.test(s))return pick(['same, Forest is probably my favorite map','W 😭 the tree routes are actually fun','yeah Forest is where I spend most of my time']);
    if(/cave/.test(s))return pick(['the cave IS cool, until the sounds start 😭','same. I like it when Morse is not involved','yeah the cave atmosphere is sick']);
    if(/cosmetic|hat|shirt|holdable|back|face/.test(s))return pick(['same 😭 I keep changing my outfit','the cosmetics are half the reason I go to Plaza','yeah, mixing the slots is fun']);
    return pick(['same honestly','W opinion 😭','yeah I get that']);
  }
  if(intent==='dislike'){
    if(/cave|666/.test(s))return pick(['fair 😭 this place can get creepy fast','I get it. we can go back to Forest','yeah, especially when the audio starts acting weird']);
    if(/tag|infection/.test(s))return pick(['fair, getting chased nonstop can get annoying','yeah. Casual is way better if you just wanna hang out','I get that 😭']);
    return pick(['fair enough 😭','yeah I can see why','we can do something else']);
  }
  if(intent==='senseHear'){
    if(/beep|morse|code|dot|dash/.test(s)){
      if(bot.knowsMorse){bot.fear=Math.max(bot.fear,1);if(botMap(bot)==='cave')bot.state='flee';return pick(['...you heard those beeps too? okay RUN if we are in the cave.','Morse-code beeps?? nah im watching every corner now 😭','I heard it. If that is Morse, get toward the entrance.']);}
      return pick(['beeping? I heard it, but I dont know what it means.','yeah I heard that. why is everyone freaking out about beeps?','I heard it... do you know what it is?']);
    }
    if(/music|song|drone|whisper|scrape|static/.test(s))return scared?pick(['yeah and I HATE it 😭 that sound is making this place worse','I hear it. that is not normal map music...','yeah. please tell me that was just the soundboard']):pick(['yeah I hear it. sounds like ambience or somebody used the soundboard.','I hear something too. which direction?']);
    return pick(['yeah, I heard something too. what did it sound like?','wait, where did it come from?','I heard it. I thought I was imagining that 😭']);
  }
  if(intent==='senseSee'){
    if(/morse|black|000|ghost|long arm/.test(s)){bot.knowsMorse=true;bot.fear=Math.max(bot.fear,1.35);bot.state='flee';return pick(['WHERE?? if that is Morse, RUN 😭','I SEE IT. black 000 body, long arms — THATS MORSE.','NOPE I see it too. get out of the cave.']);}
    return pick(['what do you see?','where? point it out 😭','im looking — what am I supposed to see?']);
  }
  if(intent==='ghost'){
    if(morse&&botMap(bot)==='cave'){bot.knowsMorse=true;bot.fear=Math.max(bot.fear,1.45);bot.state='flee';return pick(['MORSE IS HERE RIGHT NOW. RUN 😭','YES I know Morse and I can literally see it. GET OUT.','dont stand there talking about Morse, MOVE 😭']);}
    if(!bot.knowsMorse)return pick(['Morse? who is that?','I dont know Morse. should I be worried?','uh... no. who is Morse?']);
    return pick(['yeah I know Morse. The beeps and long arms are enough for me 😭','I have heard about Morse. black 000 ghost, cave, kicking and banning people.','I know who Morse is. I wish I didnt.']);
  }

  if(intent==='why'&&mem.lastBotLine){
    const l=mem.lastBotLine.toLowerCase();
    if(/cave|666|morse|beep|scared|run/.test(l))return bot.knowsMorse?'because Morse can actually appear in the cave in room 666, and that thing can kick or ban people. im not waiting around for it 😭':'because room 666 is creepy and I keep hearing weird sounds. I dont even know what everyone means by Morse yet.';
    if(/forest|plaza|leaderboard|going|head/.test(l))return`because ${MAPS[bot.favoriteMap].name.toLowerCase()} is usually where I like hanging out, and I felt like moving.`;
  }

  const R={
    greet:v==='chaotic'?[`YOOOO ${n} 😭`,`yo yo yo`,`WHATS GOOD ${n}`]:v==='cautious'?[`hey ${n}`,`yo... you good?`,`hey, whats up?`]:[`yo ${n}!`,`hey! whats up`,`sup ${n}, im ${bot.name}`],
    bye:[`cya ${n}!`,`later 😭`,`bye! dont get tagged on the way out`],
    name:[`im ${bot.name}`,`${bot.name}. remember it 😭`,`name's ${bot.name}`],
    doing:[`right now? ${state}`,`im ${state}`,`${state}. what about you?`],
    wheregoing:[bot.travel?`im going to ${MAPS[bot.travel.to].name.toLowerCase()}`:bot.goal?`im heading to the ${bot.goal.name}`:`nowhere specific right now. im in ${map.toLowerCase()}`],
    directions:[`open ☰ and pick the map, or tell me where you want to go and I can head there too`,`the map buttons are in ☰ — Forest, Hat Plaza, Dark Caves, and Leaderboards`,`☰ has the map travel buttons`],
    '666':[scared?'I do NOT like room 666 😭 the cave makes everybody nervous in here':'room 666 changes the cave vibe and makes everyone more jumpy','room 666 is why I keep checking behind me'],
    cosmetic:[`im wearing ${outfitSummary(bot)}`,`my hat right now is ${cosmeticName(bot.outfit.hat)}`,`I keep changing my outfit whenever I get bored`],
    currency:['Glow Stone comes from actually playing — about 100 for an active hour','you earn Glow Stone while active. disappearing for weeks does not stack free currency','I need more Glow Stone too 😭'],
    tag:[bot.tagger||bot.infected?'im literally chasing people right now 😭':'im trying NOT to get tagged',v==='competitive'?'I can juke pretty good, watch me':'my movement is decent but im not some impossible bot'],
    map:[`im in ${map} right now`,`${MAPS[bot.favoriteMap].name} is probably my favorite`,`I know Forest, Hat Plaza, Dark Caves, and Leaderboards`],
    beacon:[bot.outfit.back==='ownerBeacon'?'WAIT I HAVE THE BEACON TOO 😭':'your Owner Beacon is why everybody keeps running over here','that thing is insanely rare on bots'],
    mood:[scared?'im okay but this place is freaking me out 😭':bot.tagger?'good, im trying to catch somebody':'im good! just hanging out'],
    fear:[scared?pick(['YES 😭 did you not hear that??','yeah. I keep checking behind me','a little. if I hear beeping im gone']):'not really right now. ask me again if the cave starts beeping.'],
    thanks:['yw!!','of course 😭','np np'],sorry:['youre good 😭','all good','dw about it'],
    joke:['I tried to juke a tree. the tree won 😭','my strategy is called running in a random direction','I bought a hat and immediately gained imaginary skill'],
    help:['yeah. tell me what youre trying to do — I know the controls, maps, modes, cosmetics, rooms, settings, and Morse stuff.','sure. I can follow, wait, go somewhere, explain something, or just talk.'],
    how:[`what are you trying to do? name the thing and I can explain it`,`how to do what exactly? I know basically every game system here.`],
    where:[bot.travel?`im between maps right now, going to ${MAPS[bot.travel.to].name}`:`im in ${map} right now`],
    who:[`if you mean me, im ${bot.name}`,`which person do you mean?`,`name who youre asking about and I might know`],
    request:[`yeah, tell me what you want me to do`,`sure — I can follow, wait, run somewhere, or go to another map`,`probably. what do you need?`],
    question:[`ask me the specific thing — I probably know it`,`which part do you mean?`,`give me the thing youre talking about and Ill answer`]
  };
  if(R[intent])return pick(R[intent]);

  // Natural statement fallback: react to the actual subject instead of parroting it.
  if(/tagged|tagger|infection/.test(s))return pick(['NOOO 😭 was it the tagger?','that timing is brutal 😭','okay we gotta juke them next time']);
  if(/cave|dark/.test(s))return scared?pick(['yeah this cave is NOT helping 😭','same. I keep looking behind me','lets not stand still in here']):pick(['the cave is cool until the creepy audio starts 😭','I like the cave but room 666 is another story']);
  if(/forest|tree|log/.test(s))return pick(['Forest is probably the best map to just run around in','yeah, the big tree area is fun to juke around','the log route is actually pretty good']);
  if(/plaza|shop|cosmetic|hat/.test(s))return pick(['Hat Plaza always turns into everyone showing off outfits 😭','yeah I keep wasting Glow Stone there','the mirror area is where everybody starts changing stuff']);
  if(/morse/.test(s))return bot.knowsMorse?pick(['do NOT say that name in the cave 😭','if Morse shows up im leaving immediately','yeah... I know. black 000. long arms. nope.']):pick(['you keep saying Morse but I seriously dont know who that is','wait, who is Morse?']);
  if(/lol|lmao|haha|😭|💀/.test(text))return pick(['😭😭','BRO 😭','nahhh 😭']);
  return pick([`wait, tell me more about that`,`what happened with that?`,`okay, im listening`,`ohh. what happened next?`]);
}
function respondersForText(text){
  const here=botsHere();if(!here.length)return[];const s=text.toLowerCase();
  const named=here.filter(b=>s.includes(b.name.toLowerCase()));if(named.length)return named.slice(0,2);
  if(/\b(everyone|everybody|all of you|you guys|yall|y'all)\b/.test(s))return here;
  const intent=classify(text),urgent=['morseReport','ghost'].includes(intent),social=['playerFear','playerHappy','playerSad','playerAngry','playerConfused','senseHear','senseSee'].includes(intent),count=urgent?Math.min(here.length,3):social?Math.min(here.length,2):Math.min(here.length,chance(.38)?2:1);
  return [...here].sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)).slice(0,count);
}
function playerSpeak(text){
  text=fmt(text).slice(0,120);if(!text)return;lastPlayerSpeakAt=time;player.chat=text;player.chatUntil=time+4.5;addChatMessage(save.playerName||'YOU',text,'you');
  const intent=classify(text),responders=respondersForText(text);
  if(!responders.length){addChatMessage('SYSTEM','No bots are currently in this map.','system');return;}
  const usedReplies=[];
  responders.forEach((b,i)=>setTimeout(()=>{
    if(!bots.includes(b))return;b.memory.previousTopic=b.memory.lastTopic;b.memory.lastPlayerLine=text;b.memory.lastTopic=intent;b.memory.playerName=save.playerName;
    const action=botActionFromPlayer(b,text,intent);let reply=responseFor(b,text,intent,action);
    for(let tries=0;tries<5&&usedReplies.includes(reply);tries++)reply=responseFor(b,text,intent,action);
    if(usedReplies.includes(reply))reply=`${reply} ${b.personality==='chaotic'?'😭':'though'}`;
    usedReplies.push(reply);botSpeak(b,reply,i===0||intent==='morseReport');
  },320+i*580+rand(0,180)));
  botConversation.topic=intent;botConversation.lastSpeaker='player';botConversation.nextAt=time+rand(5,8);
}
function botSocialEvent(bot){
  const here=botMap(bot);
  if(morse&&here==='cave'&&bot.knowsMorse){
    bot.fear=Math.max(bot.fear,1.2);if(chance(.26)&&!bot.travel)sendBotToMap(bot,'forest','escaping Morse');
    return pick(['MORSE IS HERE GET OUT OF THE CAVE 😭','I HEAR THE BEEPS RUNNN','BLACK 000 WITH LONG ARMS — THATS MORSE','WHY IS MORSE FOLLOWING US 😭','DO NOT LET MORSE AIM THAT BAN GUN AT YOU']);
  }
  if(save.room==='666'&&here==='cave'&&chance(.52)){
    if(chance(.32)){const a=chooseBotPlan(bot,false);return a.line||'I do NOT like this cave 😭';}
    return bot.knowsMorse?pick(['did anyone else hear that??','if Morse appears im OUT','nah why did the music just change 😭','if I hear Morse-code beeping im gone']):pick(['why is everyone acting weird in room 666?','did anyone else hear that??','this room is creeping me out']);
  }
  if(save.mode!=='Casual'&&chance(.5))return pick(bot.tagger||bot.infected?['COME HERE 😭','stop juking me','I SEE YOU']:['TAGGER LEFT SIDE','BRO RUN','nah that juke was crazy','im hiding over here']);
  if(chance(.32)){const a=chooseBotPlan(bot,false);return a.line;}
  if(chance(.22))return pick([`yo ${save.playerName}, what map you wanna go to?`,`anyone wanna follow me?`,`who wants to race me?`,`I changed my outfit again 😭`]);
  return pick(['this lobby is actually fun','I need more Glow Stone','who keeps doing the finger thing 😭','im just chilling for a sec','somebody come over here']);
}
function updateBotSocial(dt){
  if(time-lastPlayerSpeakAt<5)return;
  if(time<botConversation.nextAt)return;const here=botsHere();if(here.length<2){botConversation.nextAt=time+rand(4,7);return;}
  botConversation.nextAt=time+rand(5,9);
  const available=here.filter(x=>time>x.chatUntil&&!x.travel);const b=pick(available);if(!b)return;
  const line=botSocialEvent(b);botSpeak(b,line,morse&&botMap(b)==='cave'&&chance(.3));botConversation.lastSpeaker=b.id;
  if(chance(.55)){
    const other=pick(available.filter(x=>x!==b));if(other)setTimeout(()=>{
      if(!bots.includes(other)||botMap(other)!==save.map)return;
      let reply;
      if(/anyone wanna follow me/i.test(line)){other.followPlayer=false;other.goal={x:b.x,y:b.y,name:b.name};other.goalUntil=time+18;other.state='goal';reply=pick(['yeah im coming','bet wait for me 😭','okay im over here']);}
      else if(/race me/i.test(line)){other.goal=safeSpawn(botMap(other));other.goal.name='race spot';other.goalUntil=time+16;other.state='goal';reply=pick(['BET','youre losing 😭','okay go go go']);}
      else if(/MORSE|BEEPS|BLACK 000|ban gun/i.test(line)){
        if(other.knowsMorse){other.fear=Math.max(other.fear,1.15);reply=pick(['I KNOW, RUN 😭','DONT SAY THAT, I SEE IT','IM LEAVING THE CAVE']);}
        else{other.knowsMorse=chance(.45);reply=other.knowsMorse?'wait THATS Morse?? RUN 😭':'WHO IS MORSE?! WHY ARE WE RUNNING??';}
      }else reply=responseFor(other,line,classify(line),null);
      botSpeak(other,reply);
    },rand(650,1250));
  }
}

function openTalk(){const panel=$('#chatPanel');panel.classList.toggle('hidden');if(!panel.classList.contains('hidden')){if(!$('#chatLog').children.length)addChatMessage('SYSTEM','Lobby chat connected. Bots in your current map can read this chat.','system');setTimeout(()=>$('#chatInput').focus(),40);}}
$('#talkBtn').addEventListener('click',openTalk);
$('#chatSend').addEventListener('click',()=>{const v=$('#chatInput').value;$('#chatInput').value='';playerSpeak(v);$('#chatInput').focus();});
$('#chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#chatSend').click();}});

function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1900);}
function updateHud(){
  $('#modePill').textContent=save.mode.toUpperCase();$('#mapPill').textContent=MAPS[save.map].name;$('#roomPill').textContent='ROOM: '+save.room;$('#currencyPill').textContent='✦ '+Math.floor(save.acorns)+' Glow Stone';
  $('#volumeRange').value=save.volume;$('#skillRange').value=save.skill;$('#reducedMotion').checked=save.reducedMotion;$('#voiceToggle').checked=save.voices;$('#colorCode').value=save.colorCode;$('#playerName').value=save.playerName;
}
updateHud();

$('#menuBtn').addEventListener('click',()=>$('#panel').classList.toggle('hidden'));$('#thumbBtn').addEventListener('click',()=>{$('#modPanel').classList.toggle('hidden');sfx('click')});
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.close).classList.add('hidden')));
$$('.tab').forEach(b=>b.addEventListener('click',()=>{$$('.tab').forEach(x=>x.classList.toggle('active',x===b));$$('.tabpage').forEach(x=>x.classList.add('hidden'));$('#tab-'+b.dataset.tab).classList.remove('hidden');if(b.dataset.tab==='shop')renderShop()}));
$$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{save.mode=b.dataset.mode;persist();resetMode();$('#panel').classList.add('hidden');toast(save.mode.toUpperCase()+' MODE')}));
$$('[data-map]').forEach(b=>b.addEventListener('click',()=>setMap(b.dataset.map)));
$('#joinRoom').addEventListener('click',()=>{let c=$('#roomCode').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);if(!c)return toast('ENTER A ROOM CODE');save.room=c;player.soloWhileBanned=false;persist();bots=[];morse=null;morseRollDone=false;fillBots();resetMode();roomEntered();toast('JOINED ROOM '+c)});
$('#newRoom').addEventListener('click',()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=chars[(Math.random()*chars.length)|0];$('#roomCode').value=s;save.room=s;player.soloWhileBanned=false;persist();bots=[];morse=null;morseRollDone=false;fillBots();resetMode();toast('PRIVATE ROOM CREATED')});
$('#applyColor').addEventListener('click',()=>{let c=$('#colorCode').value.replace(/\D/g,'').slice(0,3);if(c.length!==3)return toast('USE A 3-DIGIT COLOR CODE');save.colorCode=c;player.color=colorFromCode(c);persist();toast('COLOR CODE '+c+' APPLIED')});
$('#applyName').addEventListener('click',()=>{let n=$('#playerName').value.replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,16);if(!n)return toast('ENTER A NAME');save.playerName=n;persist();toast('NAME CHANGED TO '+n.toUpperCase());bots.slice(0,2).forEach((b,i)=>setTimeout(()=>botSpeak(b,pick([`yo ${n}!`,`new name?? ${n} 😭`,`okay ${n} I see you`])),500+i*700))});
$('#volumeRange').addEventListener('input',e=>{save.volume=+e.target.value;if(audio.master)audio.master.gain.value=save.volume;persist()});
$('#skillRange').addEventListener('input',e=>{save.skill=+e.target.value;bots.forEach(b=>b.skill=clamp(save.skill+rand(-.17,.17),.32,.96));persist()});
$('#reducedMotion').addEventListener('change',e=>{save.reducedMotion=e.target.checked;persist()});$('#voiceToggle').addEventListener('change',e=>{save.voices=e.target.checked;persist()});
$('#resetData').addEventListener('click',()=>{if(confirm('Reset all Canopy Chase save data?')){localStorage.removeItem('canopyChaseSave');location.reload()}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e});$('#installBtn').addEventListener('click',async()=>{if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null}else toast('iOS: SHARE → ADD TO HOME SCREEN')});

$$('[data-mod]').forEach(b=>b.addEventListener('click',()=>{
  const m=b.dataset.mod;player.mods[m]=!player.mods[m];b.classList.toggle('on',player.mods[m]);sfx('click');
  if(m==='soundboard')$('#soundboard').classList.toggle('hidden',!player.mods[m]);
  if(m==='ghost'){if(player.mods.ghost){player.ghostShell={x:player.x,y:player.y,color:player.color};toast('GHOST MONKE • BODY LEFT BEHIND')}else if(player.ghostShell){player.x=player.ghostShell.x;player.y=player.ghostShell.y;player.ghostShell=null;toast('RETURNED TO BODY')}}
  if(m==='invisible')toast(player.mods.invisible?'INVISIBLE TO BOTS':'VISIBLE AGAIN');
  if(m==='kickGun'){if(player.mods.kickGun)player.mods.banGun=false;syncModButtons();toast(player.mods.kickGun?'KICK GUN ARMED • R INDEX':'KICK GUN OFF')}
  if(m==='banGun'){if(player.mods.banGun)player.mods.kickGun=false;syncModButtons();toast(player.mods.banGun?'BAN GUN ARMED • 4 MIN':'BAN GUN OFF')}
}));
function syncModButtons(){$$('[data-mod]').forEach(b=>b.classList.toggle('on',!!player.mods[b.dataset.mod]));}
$$('[data-sound]').forEach(b=>b.addEventListener('click',()=>scarySound(b.dataset.sound)));

function renderShop(){
  const grid=$('#shopGrid');grid.innerHTML='';
  const items=cosmetics.concat(eventActive()?eventCosmetics:[]);
  for(const c of items){
    const owned=save.owned.includes(c.id),equipped=save.equipped[c.cat]===c.id;
    const d=document.createElement('div');d.className='shopItem'+(c.event?' eventItem':'')+(c.special?' specialItem':'');
    const canUnequip=equipped && c.id!=='bare';
    d.innerHTML=`<div class="preview">${c.emoji}</div><b>${c.name}</b><small>${c.cat.toUpperCase()} • ${c.event?'3-DAY EVENT • ':''}${c.special?'OWNER ONLY':(c.price?'✦ '+c.price:'FREE')}</small><button>${canUnequip?'UNEQUIP':equipped?'EQUIPPED':owned?'EQUIP':`BUY • ${c.price}`}</button>`;
    d.querySelector('button').onclick=()=>{
      if(canUnequip){
        save.equipped[c.cat]=c.cat==='hat'?'bare':null;
        persist();renderShop();sfx('click');toast(c.name.toUpperCase()+' UNEQUIPPED');return;
      }
      if(equipped)return;
      if(owned){save.equipped[c.cat]=c.id;persist();renderShop();toast(c.name.toUpperCase()+' EQUIPPED');return}
      if(save.acorns<c.price)return toast('NOT ENOUGH GLOW STONE');
      save.acorns-=c.price;save.owned.push(c.id);save.equipped[c.cat]=c.id;persist();renderShop();sfx('buy');toast(c.name.toUpperCase()+' UNLOCKED')
    };grid.appendChild(d);
  }
  if(!eventActive()){const p=document.createElement('p');p.className='hint';p.textContent='The 3-day mini-event ended. Bought event cosmetics stay permanently.';grid.appendChild(p)}
}
function updateEventTimer(){const ms=save.eventStart+eventLength-now(),el=$('#eventTimer');if(ms<=0){el.textContent='EVENT ENDED';return}const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000);el.textContent=`MINI-EVENT ${d}d ${h}h ${m}m`}
setInterval(updateEventTimer,1000);updateEventTimer();

$('#startBtn').addEventListener('click',()=>{ensureAudio();started=true;$('#startScreen').classList.add('hidden');if(now()<save.bannedUntil)showBanScreen();else{resetMode();roomEntered();toast('USE BOTH HANDS TO RUN')}});
function roomEntered(){
  if(save.room==='666'){
    bots.forEach(b=>b.fear=Math.max(b.fear,.2));
    setTimeout(()=>{if(started&&save.room==='666'&&chance(.38))scarySound(pick(['whisper','static','drone']),true)},2200);
  }
  if(save.map==='cave'){morseRollDone=false;setTimeout(rollMorseForCave,500);}
}
function rollMorseForCave(){
  if(!started||save.map!=='cave'||player.soloWhileBanned||morseRollDone)return;
  morseRollDone=true;
  if(chance(.0666))spawnMorse();
  else if(save.room==='666'&&chance(.45))setTimeout(()=>{if(started&&save.map==='cave'&&!morse)scarySound(pick(['whisper','static','scrape','drone']),true)},rand(1200,3200));
}
function panicForMorse(bot,delay=0){
  if(!bot)return;bot.knowsMorse=true;bot.morseSeen=true;bot.fear=Math.max(bot.fear,1.65);bot.state='flee';
  const lines=['MORSE IS HERE GET OUT 😭','NO NO NO THATS MORSE','RUNNN MORSE IS IN THE CAVE','I HEAR THE BEEPS, MOVE 😭','BLACK 000 LONG ARMS — MORSE!!','DONT LET MORSE AIM THAT GUN AT YOU','GET TO THE CAVE ENTRANCE NOW 😭'];
  setTimeout(()=>{if(bots.includes(bot)&&botMap(bot)==='cave')botSpeak(bot,pick(lines),chance(.38));},delay);
}
function spawnMorse(){
  if(save.map!=='cave')return;
  const p=safeSpawn('cave');morse={x:p.x,y:p.y,vx:0,vy:0,r:28,color:'#000000',visible:true,ghost:true,nextAction:time+rand(4,8),nextSound:time+rand(1.5,4),target:null};
  const caveBots=botsHere('cave');caveBots.forEach((b,i)=>panicForMorse(b,180+i*rand(130,360)));
  addChatMessage('SYSTEM','... --- ...  Something joined Dark Caves.','system');toast('... --- ...');morseBeep();
}
function showBanScreen(){
  $('#banScreen').classList.remove('hidden');updateBanCountdown();
}
function updateBanCountdown(){
  const left=Math.max(0,save.bannedUntil-now()),el=$('#banCountdown');if(!el)return;const s=Math.ceil(left/1000);el.textContent=`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  if(left<=0){$('#banScreen').classList.add('hidden');save.bannedUntil=0;player.soloWhileBanned=false;bots=[];fillBots();persist();resetMode();toast('BAN EXPIRED • MULTIPLAYER RESTORED');return}
  setTimeout(updateBanCountdown,250);
}
$('#banSoloBtn').addEventListener('click',()=>{player.soloWhileBanned=true;save.mode='Casual';bots=[];morse=null;$('#banScreen').classList.add('hidden');persist();toast('SOLO CASUAL • BAN TIMER STILL RUNNING')});
function morseBanPlayer(){save.bannedUntil=now()+120000;persist();showBanScreen();bots=[];morse=null;sfx('kick');}
function morseKickPlayer(){
  $('#kickScreen').classList.remove('hidden');let n=3;$('#kickCountdown').textContent=`REJOINING IN ${n}`;const t=setInterval(()=>{n--;if(n<=0){clearInterval(t);$('#kickScreen').classList.add('hidden');teleportEntity(player,save.map);fillBots();toast('REJOINED ROOM')}else $('#kickCountdown').textContent=`REJOINING IN ${n}`},900);
}

function resize(){DPR=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}addEventListener('resize',resize);resize();

function mapBounds(key=save.map){const m=MAPS[key]||MAPS.forest;return{x1:m.x+38,y1:m.y+38,x2:m.x+m.w-38,y2:m.y+m.h-38};}
function obstacleRadius(o){return o.type==='log'?Math.max(o.w,o.h)*.55:o.r;}
function collideEntity(e,mapKey=save.map){
  const b=mapBounds(mapKey);let hitEdge=false;
  if(e.x<b.x1){e.x=b.x1;e.vx=Math.abs(e.vx)*.72;hitEdge=true}if(e.x>b.x2){e.x=b.x2;e.vx=-Math.abs(e.vx)*.72;hitEdge=true}if(e.y<b.y1){e.y=b.y1;e.vy=Math.abs(e.vy)*.72;hitEdge=true}if(e.y>b.y2){e.y=b.y2;e.vy=-Math.abs(e.vy)*.72;hitEdge=true}
  for(const o of obstacles){if(o.map!==mapKey)continue;if(o.type==='log'){const cx=clamp(e.x,o.x-o.w/2,o.x+o.w/2),cy=clamp(e.y,o.y-o.h/2,o.y+o.h/2),dx=e.x-cx,dy=e.y-cy,d=Math.hypot(dx,dy)||.001;if(d<e.r+5){const push=e.r+5-d;e.x+=dx/d*push;e.y+=dy/d*push;e.vx+=dx/d*18;e.vy+=dy/d*18}}else{const dx=e.x-o.x,dy=e.y-o.y,d=Math.hypot(dx,dy)||.001,min=e.r+o.r;if(d<min){const p=min-d;e.x+=dx/d*p;e.y+=dy/d*p;e.vx+=dx/d*16;e.vy+=dy/d*16}}}
  return hitEdge;
}
function updatePlayer(dt){
  let lx=input.left.x,ly=input.left.y,rx=input.right.x,ry=input.right.y;if(input.keys.a){lx=-1;rx=-.8}if(input.keys.d){lx=1;rx=.8}if(input.keys.w){ly=-1;ry=-.8}if(input.keys.s){ly=1;ry=.8}
  const armScale=player.mods.longArms?1.85:1,reach=78*armScale;player.left.x=lerp(player.left.x,-42+lx*reach,.22);player.left.y=lerp(player.left.y,28+ly*reach,.22);player.right.x=lerp(player.right.x,42+rx*reach,.22);player.right.y=lerp(player.right.y,28+ry*reach,.22);
  const mx=(lx+rx)/2,my=(ly+ry)/2,mag=clamp(Math.hypot(mx,my),0,1);if(mag>.08){const speed=player.mods.ghost?760:610,accel=speed*(.65+.35*mag);player.vx+=mx*accel*dt;player.vy+=my*accel*dt;player.angle=Math.atan2(my,mx)}
  const pump=Math.abs(lx-rx)+Math.abs(ly-ry);if(pump>.8){player.vx+=Math.cos(player.angle)*120*dt;player.vy+=Math.sin(player.angle)*120*dt}
  const max=player.mods.ghost?540:385,sp=Math.hypot(player.vx,player.vy);if(sp>max){player.vx=player.vx/sp*max;player.vy=player.vy/sp*max}const drag=Math.pow(.13,dt);player.vx*=drag;player.vy*=drag;player.x+=player.vx*dt;player.y+=player.vy*dt;if(!player.mods.ghost)collideEntity(player);else{const b=mapBounds();player.x=clamp(player.x,b.x1,b.x2);player.y=clamp(player.y,b.y1,b.y2)}
  if(player.mods.platforms&&time%1<dt&&mag>.3){const h=handWorld(chance(.5)?player.left:player.right);platforms.push({x:h.x,y:h.y,r:38,life:5});if(platforms.length>14)platforms.shift()}platforms.forEach(p=>p.life-=dt);platforms=platforms.filter(p=>p.life>0);
  if(save.mode!=='Casual'&&!player.soloWhileBanned)handleTags();
}

function nearestThreat(bot){
  let t=null,d=1e9,mapKey=botMap(bot);const consider=o=>{const dd=Math.hypot(bot.x-o.x,bot.y-o.y);if(dd<d){d=dd;t=o}};
  const samePlayer=mapKey===save.map;
  if(save.mode==='Tag'){
    if(samePlayer&&player.tagger&&!player.mods.ghost&&!player.mods.invisible)consider(player);
    bots.filter(b=>b!==bot&&!b.travel&&botMap(b)===mapKey&&b.tagger).forEach(consider);
  }else if(save.mode==='Infection'){
    if(samePlayer&&player.infected&&!player.mods.ghost&&!player.mods.invisible)consider(player);
    bots.filter(b=>b!==bot&&!b.travel&&botMap(b)===mapKey&&b.infected).forEach(consider);
  }else if(save.mode==='Echo Hunt')bots.filter(b=>b!==bot&&!b.travel&&botMap(b)===mapKey&&b.tagger).forEach(consider);
  if(morse?.visible&&mapKey===save.map)consider(morse);return{target:t,d};
}
function nearestPrey(bot){
  const mapKey=botMap(bot);let arr=bots.filter(b=>b!==bot&&!b.travel&&botMap(b)===mapKey&&!(save.mode==='Tag'?b.tagger:b.infected));
  if(mapKey===save.map&&!(player.mods.ghost||player.mods.invisible)&&!(save.mode==='Tag'?player.tagger:player.infected))arr.push(player);
  let t=null,d=1e9;for(const o of arr){const dd=Math.hypot(bot.x-o.x,bot.y-o.y);if(dd<d){d=dd;t=o}}return{target:t,d};
}
function avoidance(b,dx,dy,mapKey=botMap(b)){
  let ax=0,ay=0;const bounds=mapBounds(mapKey),margin=155;
  if(b.x-bounds.x1<margin)ax+=(margin-(b.x-bounds.x1))/margin*3.2;if(bounds.x2-b.x<margin)ax-=(margin-(bounds.x2-b.x))/margin*3.2;if(b.y-bounds.y1<margin)ay+=(margin-(b.y-bounds.y1))/margin*3.2;if(bounds.y2-b.y<margin)ay-=(margin-(bounds.y2-b.y))/margin*3.2;
  for(const o of obstacles){if(o.map!==mapKey)continue;const rr=obstacleRadius(o),ox=b.x-o.x,oy=b.y-o.y,d=Math.hypot(ox,oy)||1;if(d<rr+145){const f=(rr+145-d)/(rr+145);ax+=ox/d*f*3;ay+=oy/d*f*3}}
  for(const other of bots){if(other===b||other.travel||botMap(other)!==mapKey)continue;const ox=b.x-other.x,oy=b.y-other.y,d=Math.hypot(ox,oy)||1;if(d<100){const f=(100-d)/100;ax+=ox/d*f*3.5;ay+=oy/d*f*3.5}}
  return{x:dx+ax,y:dy+ay};
}
function ownerBeaconActive(){return save.equipped.back==='ownerBeacon';}
function finishBotTravel(b){
  const to=b.travel.to;b.map=to;b.travel=null;teleportEntity(b,to);b.wanderTarget=safeSpawn(to);b.state=b.followPlayer&&to===save.map?'follow':'roam';
  if(to==='cave'&&morse){b.knowsMorse=true;b.morseSeen=true;b.fear=Math.max(b.fear,1.4);b.state='flee';if(to===save.map)botSpeak(b,pick(['WAIT MORSE IS HERE?? 😭','NOPE I JUST GOT HERE AND MORSE IS HERE','WHY IS MORSE IN THE CAVE 😭']),true);}
  else if(to===save.map&&time>b.chatUntil&&chance(.72))botSpeak(b,pick([`im here 😭`,`made it to ${MAPS[to].name.toLowerCase()}`,`okay I got here`]));
}
function updateBots(dt){
  for(const b of bots){
    if(!b.map)b.map=save.map;if(!b.memory)b.memory={lastTopic:'lobby',lastPlayerLine:'',lastPromise:''};if(typeof b.knowsMorse!=='boolean')b.knowsMorse=chance(.45);
    b.joinFlash=Math.max(0,b.joinFlash-dt);b.think-=dt;b.socialCooldown-=dt;
    if(b.travel){if(time>=b.travel.arriveAt){finishBotTravel(b);}else if(!b.travel.departAt||time>=b.travel.departAt)continue;}
    const mapKey=botMap(b),fearFloor=save.room==='666'?(mapKey==='cave'?.14:.05):0;b.fear=Math.max(fearFloor,b.fear-dt*.1);
    if(morse&&mapKey==='cave'&&morse.visible&&Math.hypot(b.x-morse.x,b.y-morse.y)<720){if(!b.morseSeen){b.morseSeen=true;b.knowsMorse=true;b.fear=Math.max(b.fear,1.5);b.state='flee';if(time>b.chatUntil)botSpeak(b,pick(['MORSE!! RUN 😭','THATS MORSE GET OUT','NOPE I SEE MORSE']),true);}else b.fear=Math.max(b.fear,.9);}
    if(b.followPlayer&&time>b.followUntil){b.followPlayer=false;if(b.state==='follow')b.state='roam';}
    if(b.followPlayer&&save.mode==='Casual'&&mapKey!==save.map){sendBotToMap(b,save.map,'following you');continue;}
    if(b.goal&&time>b.goalUntil){b.goal=null;if(b.state==='goal')b.state='roam';}
    if(b.waitUntil&&time>b.waitUntil){b.waitUntil=0;if(b.state==='wait')b.state='roam';}
    if(b.fleePlayerUntil&&time>b.fleePlayerUntil){b.fleePlayerUntil=0;if(b.state==='fleePlayer')b.state='roam';}
    if(b.think<=0){
      b.think=rand(.14,.48)*(1.12-b.skill*.26);const threat=nearestThreat(b),hunter=(save.mode==='Tag'?b.tagger:b.infected)||(save.mode==='Echo Hunt'&&b.tagger);
      if(b.waitUntil>time)b.state='wait';
      else if(b.fleePlayerUntil>time&&mapKey===save.map)b.state='fleePlayer';
      else if(b.goal&&b.goalUntil>time)b.state='goal';
      else if(b.followPlayer&&!hunter&&mapKey===save.map)b.state='follow';
      else if(ownerBeaconActive()&&!hunter&&mapKey===save.map&&Math.hypot(b.x-player.x,b.y-player.y)<700){b.state='follow';if(time-lastPlayerSpeakAt>5&&chance(.018)&&time>b.chatUntil)botSpeak(b,pick(['OWNER BEACON!! 😭','YO ITS THE BEACON','WAIT FOLLOW THEM','no way they have the beacon']))}
      else if(b.fear>.18&&!hunter)b.state='flee';else if(hunter)b.state='chase';else if(threat.target&&threat.d<540)b.state='flee';else if(chance(.18)){b.state='roam';b.wanderTarget=safeSpawn(mapKey)}
    }
    let dx=0,dy=0,speed=175+175*b.skill;
    if(b.state==='chase'){const p=nearestPrey(b);if(p.target){dx=p.target.x-b.x;dy=p.target.y-b.y}else{b.state='roam';b.wanderTarget=safeSpawn(mapKey)}speed*=save.mode==='Echo Hunt'?1.1:1}
    else if(b.state==='flee'){const th=nearestThreat(b);if(th.target){dx=b.x-th.target.x;dy=b.y-th.target.y}else{const p=safeSpawn(mapKey);dx=p.x-b.x;dy=p.y-b.y}b.pathAngle+=rand(-.8,.8)*dt;dx+=Math.cos(b.pathAngle)*90;dy+=Math.sin(b.pathAngle)*90;speed*=1.05+b.fear*.1}
    else if(b.state==='fleePlayer'&&mapKey===save.map){dx=b.x-player.x;dy=b.y-player.y;speed*=1.08}
    else if(b.state==='follow'&&mapKey===save.map){const a=(Math.abs(b.id)%9)/9*TAU,rr=145+(Math.abs(b.id)%3)*32,tx=player.x+Math.cos(a)*rr,ty=player.y+Math.sin(a)*rr;dx=tx-b.x;dy=ty-b.y;const d=Math.hypot(dx,dy);if(d<45){dx*=.18;dy*=.18;speed*=.28}else speed*=.9}
    else if(b.state==='goal'&&b.goal){dx=b.goal.x-b.x;dy=b.goal.y-b.y;const d=Math.hypot(dx,dy);speed*=.72;if(d<55){const label=b.goal.name;b.goal=null;b.goalUntil=0;b.state='wait';b.waitUntil=time+rand(5,11);b.vx*=.25;b.vy*=.25;if(mapKey===save.map&&time>b.chatUntil)botSpeak(b,pick([`im at the ${label}`,`made it 😭`,`okay im here by the ${label}`]));continue}}
    else if(b.state==='wait'){b.vx*=Math.pow(.08,dt);b.vy*=Math.pow(.08,dt);continue}
    else{if(!b.wanderTarget||Math.hypot(b.x-b.wanderTarget.x,b.y-b.wanderTarget.y)<90)b.wanderTarget=safeSpawn(mapKey);dx=b.wanderTarget.x-b.x;dy=b.wanderTarget.y-b.y;speed*=.53}
    const av=avoidance(b,dx,dy,mapKey);dx=av.x;dy=av.y;let m=Math.hypot(dx,dy)||1;dx/=m;dy/=m;
    const resp=4.2+5.2*b.skill;b.vx=lerp(b.vx,dx*speed,clamp(resp*dt,0,1));b.vy=lerp(b.vy,dy*speed,clamp(resp*dt,0,1));if((b.state==='flee'||b.state==='chase'||b.state==='fleePlayer')&&chance(dt*(.55+b.skill))){const side=chance(.5)?-1:1;b.vx+=-dy*rand(20,62)*side;b.vy+=dx*rand(20,62)*side}
    b.x+=b.vx*dt;b.y+=b.vy*dt;const edge=collideEntity(b,mapKey);
    const moved=Math.hypot(b.x-b.lastX,b.y-b.lastY);if(moved<1.6&&Math.hypot(b.vx,b.vy)>55)b.stuckTime+=dt;else b.stuckTime=Math.max(0,b.stuckTime-dt*2);b.lastX=b.x;b.lastY=b.y;
    if(edge){b.pathAngle+=Math.PI+rand(-.6,.6);b.wanderTarget=safeSpawn(mapKey);b.stuckTime+=.22}
    if(b.stuckTime>.72){const p=safeSpawn(mapKey),ang=Math.atan2(p.y-b.y,p.x-b.x);b.x+=Math.cos(ang)*80;b.y+=Math.sin(ang)*80;b.vx=Math.cos(ang)*220;b.vy=Math.sin(ang)*220;b.wanderTarget=p;b.pathAngle=ang;b.stuckTime=0}
  }
  botVsBotTags();updateBotSocial(dt);
}

function transferTag(from,to){if(save.mode==='Tag'){if(from===player)player.tagger=false;else from.tagger=false;if(to===player)player.tagger=true;else to.tagger=true}else if(save.mode==='Infection'){if(to===player)player.infected=true;else to.infected=true}if(from!==player)from.lastTag=time;if(to!==player)to.lastTag=time;sfx('tag')}
function botVsBotTags(){if(save.mode==='Casual'||player.soloWhileBanned)return;for(const a of bots){if(a.travel)continue;const hunter=save.mode==='Tag'?a.tagger:a.infected;if(!hunter)continue;for(const b of bots){if(a===b||b.travel||botMap(a)!==botMap(b))continue;const prey=save.mode==='Tag'?!b.tagger:!b.infected;if(prey&&time-a.lastTag>.6&&Math.hypot(a.x-b.x,a.y-b.y)<a.r+b.r+8){transferTag(a,b);if(time-lastPlayerSpeakAt>4&&chance(.35))botSpeak(b,'NOOO I GOT TAGGED 😭');break}}}}
function handleTags(){if(player.mods.ghost)return;const hands=[handWorld(player.left),handWorld(player.right)];for(const b of botsHere()){const touch=Math.min(Math.hypot(hands[0].x-b.x,hands[0].y-b.y),Math.hypot(hands[1].x-b.x,hands[1].y-b.y),Math.hypot(player.x-b.x,player.y-b.y));if(touch<52&&time-b.lastTag>.65){if(save.mode==='Tag'){if(player.tagger&&!b.tagger){transferTag(player,b);save.stats.tags++;save.acorns+=12;persist();toast(`TAGGED ${b.name} • +12 ✦`);return}if(b.tagger&&!player.tagger){transferTag(b,player);toast(`${b.name} TAGGED YOU`);return}}else if(save.mode==='Infection'){if(player.infected&&!b.infected){transferTag(player,b);save.stats.tags++;save.acorns+=10;persist();toast(`${b.name} INFECTED • +10 ✦`);return}if(b.infected&&!player.infected&&!player.mods.invisible){transferTag(b,player);toast('YOU WERE INFECTED');return}}else if(save.mode==='Echo Hunt'&&b.tagger&&!player.mods.invisible){toast('THE HUNTER CAUGHT YOU');teleportEntity(player,save.map);save.acorns=Math.max(0,save.acorns-5);persist();return}}}}

function updateMorse(dt){
  if(!morse||save.map!=='cave'||player.soloWhileBanned)return;
  morse.nextSound-=dt;morse.nextAction-=dt;
  if(morse.nextSound<=0){morse.nextSound=rand(4,10);if(chance(.55))morseBeep();else scarySound(pick(['whisper','static','scrape','drone']),true)}
  if(chance(dt*.12))morse.visible=!morse.visible;
  let target=chance(.6)?player:pick(botsHere());if(target){const dx=target.x-morse.x,dy=target.y-morse.y,m=Math.hypot(dx,dy)||1;const sp=morse.visible?145:240;morse.vx=lerp(morse.vx,dx/m*sp,.05);morse.vy=lerp(morse.vy,dy/m*sp,.05);morse.x+=morse.vx*dt;morse.y+=morse.vy*dt;collideEntity(morse)}
  if(morse.nextAction<=0){morse.nextAction=rand(5,11);const roll=Math.random();if(roll<.23&&botsHere().length)kickBot(pick(botsHere()),'MORSE');else if(roll<.34&&botsHere().length)banBot(pick(botsHere()),240000,'MORSE');else if(roll<.38)morseKickPlayer();else if(roll<.405)morseBanPlayer();else if(roll<.7){morse.visible=false;setTimeout(()=>{if(morse)morse.visible=true},rand(700,1800))}else morseBeep()}
}

function updateRound(dt){
  if(!started)return;roundTimer+=dt;
  if(!player.soloWhileBanned){if(save.mode==='Infection'){const inf=(player.infected?1:0)+bots.filter(b=>b.infected).length;if(bots.length&&inf>=bots.length+1){save.stats.rounds++;if(!player.infected){save.stats.wins++;save.acorns+=75;toast('SURVIVED INFECTION • +75 ✦')}persist();resetMode()}}else if(save.mode==='Tag'&&roundTimer>95){save.stats.rounds++;if(!player.tagger){save.stats.wins++;save.acorns+=60;toast('ROUND SURVIVED • +60 ✦')}persist();resetMode()}else if(save.mode==='Echo Hunt'&&roundTimer>80){save.stats.rounds++;save.stats.wins++;save.acorns+=85;persist();toast('ECHO HUNT SURVIVED • +85 ✦');resetMode()}}
  activeGlowFraction+=dt*(100/3600);if(activeGlowFraction>=1){const grant=Math.floor(activeGlowFraction);activeGlowFraction-=grant;save.acorns+=grant;persist()}
}

function camera(){const scale=Math.min(W/980,H/690)*1.06;return{s:scale,x:W/2-player.x*scale,y:H/2-player.y*scale}}
function roundedRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function text(txt,x,y,size=14,color='#fff',align='center',weight=800){ctx.fillStyle=color;ctx.font=`${weight} ${size}px ui-rounded,system-ui`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(txt,x,y)}
function draw(){ctx.clearRect(0,0,W,H);const c=camera();ctx.fillStyle=save.map==='cave'?'#05060a':'#10241a';ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(c.x,c.y);ctx.scale(c.s,c.s);drawWorld();ctx.restore();drawVignette();drawCrosshair()}
function drawWorld(){
  const m=MAPS[save.map];ctx.fillStyle=m.theme==='forest'?'#264d31':m.theme==='plaza'?'#3d3449':m.theme==='cave'?'#111016':'#203746';ctx.fillRect(m.x,m.y,m.w,m.h);ctx.strokeStyle=m.theme==='cave'?'#766189':'rgba(220,255,205,.22)';ctx.lineWidth=6;ctx.strokeRect(m.x,m.y,m.w,m.h);
  if(save.map==='forest'){
    ctx.strokeStyle='#8b6a45';ctx.lineWidth=76;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(180,760);ctx.bezierCurveTo(650,540,1090,900,1380,740);ctx.stroke();ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=4;ctx.setLineDash([16,16]);ctx.beginPath();ctx.moveTo(180,760);ctx.bezierCurveTo(650,540,1090,900,1380,740);ctx.stroke();ctx.setLineDash([]);
  } else if(save.map==='plaza'){
    for(let i=0;i<6;i++){const x=m.x+85+(i%3)*235,y=m.y+120+Math.floor(i/3)*250;ctx.fillStyle=i%2?'#694b76':'#4b6a62';roundedRect(x,y,190,165,18);ctx.fill();text(['HATS','FACE','HOLDABLES','SHIRTS','BACK','MIRROR'][i],x+95,y+35,15,'#fff');text(['🧢','😎','🍌','👕','🎒','✨'][i],x+95,y+104,43,'#fff')}
  } else if(save.map==='cave'){
    ctx.fillStyle='#08080d';for(let i=0;i<8;i++){ctx.beginPath();ctx.arc(m.x+100+i*95,m.y+80+Math.sin(i)*30,90,Math.PI,TAU);ctx.fill()}text('DARK CAVES',m.x+50,m.y+50,24,'#c7b1d9','left');text(save.room==='666'?'ROOM 666 • SOMETHING MAY BE HERE':'echoes travel farther here',m.x+50,m.y+88,12,'#9f8bad','left');
  } else {text('ROOM LEADERBOARD',m.x+m.w/2,m.y+30,22,'#a9ebff');const scores=[...bots].sort((a,b)=>b.score-a.score).slice(0,5);scores.forEach((b,i)=>text(`${i+1}. ${b.name}   ${b.score}`,m.x+100,m.y+58+i*20,13,'#eef9ff','left'))}
  text(m.name,m.x+30,m.y+32,22,'rgba(255,255,255,.72)','left');
  for(const o of obstacles){if(o.map!==save.map)continue;if(o.type==='tree'){ctx.fillStyle='#1c271a';ctx.beginPath();ctx.arc(o.x+5,o.y+7,o.r+7,0,TAU);ctx.fill();ctx.fillStyle='#634829';ctx.beginPath();ctx.arc(o.x,o.y,o.r*.42,0,TAU);ctx.fill();ctx.fillStyle='#3d7c42';ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,TAU);ctx.fill()}else if(o.type==='rock'){ctx.fillStyle=save.map==='cave'?'#34303a':'#59645b';ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,TAU);ctx.fill()}else{ctx.fillStyle='#6c4c2c';roundedRect(o.x-o.w/2,o.y-o.h/2,o.w,o.h,18);ctx.fill()}}
  platforms.forEach(p=>{ctx.fillStyle=`rgba(120,210,255,${.12+.14*p.life/5})`;ctx.strokeStyle='rgba(170,235,255,.55)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill();ctx.stroke()});
  if(player.ghostShell)drawMonke(player.ghostShell.x,player.ghostShell.y,player.ghostShell.color,'BODY',{},false,false,.55);
  botsHere().forEach(b=>drawMonke(b.x,b.y,b.color,b.name,b.outfit,b.tagger,b.infected,1,b.chat,b.chatUntil));if(morse&&morse.visible)drawMorse();drawPlayer();
}
function drawOutfit(x,y,outfit,scale=1){
  if(!outfit)return;const draw=(id,ox,oy,s)=>{if(!id||id==='bare')return;const c=cosmeticById(id);if(c)text(c.emoji,x+ox*scale,y+oy*scale,s*scale,'#fff')};
  draw(outfit.back,28,-5,21);draw(outfit.shirt,0,16,18);draw(outfit.hat,0,-48,22);draw(outfit.face,0,-18,16);draw(outfit.holdable,37,22,20);
  if(outfit.back==='ownerBeacon'){ctx.strokeStyle='rgba(168,255,114,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,44+Math.sin(time*4)*4,0,TAU);ctx.stroke()}
}
function drawMonke(x,y,color,name,outfit={},tagger=false,infected=false,alpha=1,chat='',chatUntil=0){
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(x+6,y+13,30,21,0,0,TAU);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=14;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-13,y+2);ctx.lineTo(x-32,y+24);ctx.moveTo(x+13,y+2);ctx.lineTo(x+32,y+24);ctx.stroke();ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y+9,24,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(x,y-16,18,0,TAU);ctx.fill();ctx.fillStyle='#f5f1e8';ctx.beginPath();ctx.arc(x-6,y-19,3.5,0,TAU);ctx.arc(x+6,y-19,3.5,0,TAU);ctx.fill();ctx.fillStyle='#172018';ctx.beginPath();ctx.arc(x-6,y-19,1.7,0,TAU);ctx.arc(x+6,y-19,1.7,0,TAU);ctx.fill();if(tagger||infected){ctx.strokeStyle=tagger?'#ff5b54':'#d66cff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y+3,32,0,TAU);ctx.stroke()}drawOutfit(x,y,outfit);text(name,x,y+52,11,'rgba(255,255,255,.92)');if(chat&&chatUntil>time&&$('#chatPanel').classList.contains('hidden')){const w=clamp(chat.length*5.7+18,80,310);ctx.fillStyle='rgba(6,13,10,.9)';roundedRect(x-w/2,y-103,w,38,10);ctx.fill();text(chat,x,y-84,10,'#fff')}ctx.restore();
}
function drawMorse(){
  const x=morse.x,y=morse.y;ctx.save();ctx.globalAlpha=.92;ctx.strokeStyle='#030303';ctx.lineWidth=14;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-12,y);ctx.lineTo(x-72,y+48);ctx.moveTo(x+12,y);ctx.lineTo(x+72,y+48);ctx.stroke();ctx.fillStyle='#000';ctx.beginPath();ctx.arc(x,y+7,28,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(x,y-19,20,0,TAU);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x-7,y-22,4,0,TAU);ctx.arc(x+7,y-22,4,0,TAU);ctx.fill();text('Morse',x,y+62,12,'#d5d5d5');text('... --- ...',x,y-58,11,'#d05d63');ctx.restore();
}
function drawPlayer(){
  const alpha=player.mods.invisible?.17:player.mods.ghost?.4:1,lw=handWorld(player.left),rw=handWorld(player.right);ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(player.x+6,player.y+14,34,22,0,0,TAU);ctx.fill();ctx.strokeStyle=player.color;ctx.lineWidth=15;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(player.x-12,player.y+3);ctx.lineTo(lw.x,lw.y);ctx.moveTo(player.x+12,player.y+3);ctx.lineTo(rw.x,rw.y);ctx.stroke();ctx.fillStyle=player.color;ctx.beginPath();ctx.arc(player.x,player.y+8,28,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(player.x,player.y-18,20,0,TAU);ctx.fill();for(const h of [lw,rw]){ctx.beginPath();ctx.arc(h.x,h.y,12,0,TAU);ctx.fill()}ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(player.x-7,player.y-22,4,0,TAU);ctx.arc(player.x+7,player.y-22,4,0,TAU);ctx.fill();ctx.fillStyle='#1b2a20';ctx.beginPath();ctx.arc(player.x-7,player.y-22,2,0,TAU);ctx.arc(player.x+7,player.y-22,2,0,TAU);ctx.fill();if(player.tagger||player.infected){ctx.strokeStyle=player.tagger?'#ff5b54':'#d66cff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(player.x,player.y+2,38,0,TAU);ctx.stroke()}drawOutfit(player.x,player.y,save.equipped,1.08);text(save.playerName,player.x,player.y+59,11,'#fff');if(player.chat&&player.chatUntil>time&&$('#chatPanel').classList.contains('hidden')){const w=clamp(player.chat.length*6+18,80,300);ctx.fillStyle='rgba(5,12,9,.9)';roundedRect(player.x-w/2,player.y-110,w,38,10);ctx.fill();text(player.chat,player.x,player.y-91,10,'#fff')}if(player.mods.ghost)text('GHOST',player.x,player.y+76,10,'#b7eaff');if(player.mods.invisible)text('INVISIBLE',player.x,player.y+89,10,'#e8e8ff');if(player.mods.kickGun||player.mods.banGun){ctx.strokeStyle=player.mods.banGun?'rgba(190,100,255,.9)':'rgba(255,90,90,.85)';ctx.lineWidth=3;ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(rw.x,rw.y);ctx.lineTo(rw.x+Math.cos(player.angle)*700,rw.y+Math.sin(player.angle)*700);ctx.stroke();ctx.setLineDash([])}ctx.restore();
}
function drawVignette(){const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.2,W/2,H/2,Math.max(W,H)*.74);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,save.map==='cave'?'rgba(0,0,0,.82)':'rgba(0,0,0,.42)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
function drawCrosshair(){if(!(player.mods.kickGun||player.mods.banGun))return;ctx.strokeStyle=player.mods.banGun?'rgba(190,100,255,.95)':'rgba(255,110,110,.95)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,H/2,10,0,TAU);ctx.moveTo(W/2-16,H/2);ctx.lineTo(W/2+16,H/2);ctx.moveTo(W/2,H/2-16);ctx.lineTo(W/2,H/2+16);ctx.stroke()}

function update(dt){if(!started)return;time+=dt;if(now()<save.bannedUntil&&!player.soloWhileBanned&&$('#banScreen').classList.contains('hidden'))showBanScreen();updatePlayer(dt);updateBots(dt);updateMorse(dt);updateRound(dt)}
function frame(t){let dt=Math.min(.033,(t-last)/1000||.016);last=t;if(save.reducedMotion)dt=Math.min(dt,.022);update(dt);draw();requestAnimationFrame(frame)}requestAnimationFrame(frame);

addEventListener('keydown',e=>{if(e.key.toLowerCase()==='p')scarySound('static')});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
setInterval(()=>{if(!eventActive()&&!$('#tab-shop').classList.contains('hidden'))renderShop()},60000);
window.__canopyTest={setMap,spawnMorse:()=>{save.room='666';setMap('cave');morseRollDone=true;spawnMorse();persist();},join666:()=>{save.room='666';morse=null;morseRollDone=false;persist();bots=[];fillBots();setMap('cave');resetMode();},say:playerSpeak,openChat:()=>{$('#chatPanel').classList.remove('hidden');},openShop:()=>{$('#panel').classList.remove('hidden');$('.tab[data-tab="shop"]').click();},openSettings:()=>{$('#panel').classList.remove('hidden');$('.tab[data-tab="settings"]').click();}};

})();
