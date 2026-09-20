(() => {
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const canvas = $('#game');
const ctx = canvas.getContext('2d');
const TAU = Math.PI * 2;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const lerp = (a,b,t)=>a+(b-a)*t;
const dist = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rand=(a,b)=>a+Math.random()*(b-a);
const pick=a=>a[(Math.random()*a.length)|0];
const now=()=>Date.now();

const WORLD={w:2200,h:1500};
let DPR=1,W=innerWidth,H=innerHeight,started=false,last=performance.now(),time=0;
let deferredInstall=null;

const defaults={
  acorns:650, room:'PUBLIC', mode:'Tag', colorCode:'597', volume:.6, skill:.7,
  reducedMotion:false, voices:true, owned:['bare'], equipped:'bare', eventStart:now(),
  stats:{tags:0,wins:0,rounds:0,bestSurvival:0}, lastSeen:now()
};
let save={...defaults,stats:{...defaults.stats}};
try{
  const s=JSON.parse(localStorage.getItem('canopyChaseSave')||'null');
  if(s) save={...defaults,...s,stats:{...defaults.stats,...(s.stats||{})},owned:Array.isArray(s.owned)?s.owned:['bare']};
}catch(e){}
function persist(){save.lastSeen=now();localStorage.setItem('canopyChaseSave',JSON.stringify(save));updateHud();}

const baseCosmetics=[
 ['bare','No Hat','🙂',0],['leaf','Leaf Crown','🍃',120],['cap','Trail Cap','🧢',140],['wizard','Moss Wizard','🧙',200],
 ['cowboy','Twig Cowboy','🤠',180],['crown','Canopy Crown','👑',320],['flower','Wildflower','🌼',110],['cone','Safety Cone','🚧',150],
 ['phones','Forest Phones','🎧',220],['shades','Leaf Shades','😎',170],['antenna','Bee Antennae','🐝',190],['halo','Sun Halo','😇',280],
 ['bucket','Rain Bucket','🪣',160],['acornhat','Mega Acorn','🌰',210],['frog','Frog Hood','🐸',240],['scarf','Runner Scarf','🧣',130]
];
const eventCosmetics=[
 ['haunted','Haunted Hood','👻',280],['pumpkin','Pumpkin Visor','🎃',300],['phantom','Phantom Crown','🟣',360],['spider','Spider Hat','🕷️',330]
];
const eventLength=3*24*60*60*1000;
function eventActive(){return now()<save.eventStart+eventLength;}

const userPool=['MOSSY','TreeJuice','BananaOrbit','N0BRANCH','EchoCub','TwigRunner','SpookyLeaf','BlueMango','VineKid','FroggyVR','PineconeX','CloudChimp','Sappy','MintMonke','BarkByte','RootRacer','Shroomie','PebbleTag','LeafLag','AcornAce','LimeLoop','CavePop','BirchBoy','MoonVine','BugHat','FernFever','NoSleepVR','ToastBranch','GreenBean','GoofyLog'];
const botColors=['#ff7369','#6edbff','#ffcc67','#b286ff','#71ef8b','#ff88d2','#f2f2f2','#ff9f61','#75a7ff','#d5ff6a'];

const zones={
  forest:{x:80,y:110,w:1320,h:1240,name:'FOREST'},
  hats:{x:1510,y:330,w:560,h:700,name:'HAT PLAZA'},
  boards:{x:1510,y:90,w:560,h:180,name:'LEADERBOARD'},
  cave:{x:1510,y:1130,w:560,h:250,name:'ECHO CAVE'}
};
const obstacles=[];
function addTree(x,y,r=38){obstacles.push({type:'tree',x,y,r});}
function addRock(x,y,r=45){obstacles.push({type:'rock',x,y,r});}
for(let i=0;i<30;i++) addTree(rand(180,1300),rand(220,1260),rand(26,48));
[[240,300,42],[520,490,54],[860,330,35],[1080,570,46],[350,830,34],[740,920,52],[1150,1050,48]].forEach(v=>addRock(...v));
// Keep central running lanes open.
obstacles.splice(0,0,{type:'log',x:650,y:650,w:200,h:42},{type:'log',x:1030,y:820,w:180,h:38});

const player={
  x:600,y:650,vx:0,vy:0,r:28,angle:0,color:'#70d98b',
  left:{x:-38,y:28,dx:0,dy:0,grip:false,index:false},
  right:{x:38,y:28,dx:0,dy:0,grip:false,index:false},
  chat:'',chatUntil:0,tagger:false,infected:false,ghostShell:null,
  mods:{longArms:false,platforms:false,ghost:false,invisible:false,kickGun:false,soundboard:false}
};
function colorFromCode(code){
  const d=String(code||'597').padEnd(3,'5').slice(0,3).split('').map(n=>clamp(+n||0,0,9));
  const r=Math.round(40+d[0]/9*210),g=Math.round(40+d[1]/9*210),b=Math.round(40+d[2]/9*210);
  return `rgb(${r},${g},${b})`;
}
player.color=colorFromCode(save.colorCode);

let platforms=[];
let bots=[];
let roundTimer=0, roundState='warmup', infectedCount=0;
let activeGlowFraction=0;
function newBot(id,respawn=false){
  const name=pick(userPool)+((Math.random()<.18)?String((Math.random()*99)|0):'');
  const cosmetic=pick(baseCosmetics.concat(eventActive()?eventCosmetics:[]))[0];
  const b={
    id,name,x:rand(220,1280),y:rand(200,1250),vx:0,vy:0,r:25,color:pick(botColors),cosmetic,
    tagger:false,infected:false,state:'roam',target:null,think:rand(.2,1),skill:clamp(save.skill+rand(-.18,.18),.3,1),
    chat:'',chatUntil:0,score:(Math.random()*18)|0,fear:0,lastTag:0,pathAngle:rand(0,TAU),joinFlash:respawn?1.8:0
  };
  return b;
}
function fillBots(){while(bots.length<9)bots.push(newBot(bots.length,true));}
fillBots();

function resetMode(){
  player.tagger=false;player.infected=false;roundTimer=0;roundState='live';infectedCount=0;
  bots.forEach(b=>{b.tagger=false;b.infected=false;b.state='roam';b.fear=0;});
  if(save.mode==='Tag'){
    if(Math.random()<.2){player.tagger=true;} else pick(bots).tagger=true;
  }else if(save.mode==='Infection'){
    pick(bots).infected=true; infectedCount=1;
  }else if(save.mode==='Echo Hunt'){
    pick(bots).tagger=true;
  }
  toast(`${save.mode.toUpperCase()} STARTED`);
}

const input={keys:{},mouseX:0,mouseY:0,left:{x:0,y:0},right:{x:0,y:0}};
addEventListener('keydown',e=>{input.keys[e.key.toLowerCase()]=true;if(e.key==='Escape')$('#panel').classList.toggle('hidden');});
addEventListener('keyup',e=>input.keys[e.key.toLowerCase()]=false);
canvas.addEventListener('pointermove',e=>{input.mouseX=e.clientX;input.mouseY=e.clientY;});

function bindStick(el,key){
  const knob=el.querySelector('.stickKnob');let pid=null;
  const reset=()=>{input[key].x=input[key].y=0;knob.style.transform='translate(0px,0px)';pid=null;};
  el.addEventListener('pointerdown',e=>{pid=e.pointerId;el.setPointerCapture(pid);move(e);});
  el.addEventListener('pointermove',e=>{if(e.pointerId===pid)move(e);});
  el.addEventListener('pointerup',e=>{if(e.pointerId===pid)reset();});
  el.addEventListener('pointercancel',reset);
  function move(e){
    const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
    let dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.32,m=Math.hypot(dx,dy)||1;
    if(m>max){dx=dx/m*max;dy=dy/m*max;}
    input[key].x=dx/max;input[key].y=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`;
  }
}
bindStick($('#leftStick'),'left');bindStick($('#rightStick'),'right');

$$('[data-finger]').forEach(btn=>btn.addEventListener('pointerdown',()=>{
  const k=btn.dataset.finger, on=!btn.classList.contains('on');btn.classList.toggle('on',on);
  const h=k[0]==='l'?player.left:player.right; if(k.includes('Index'))h.index=on; else h.grip=on;
  if(k==='rIndex'&&on&&player.mods.kickGun) fireKickGun();
}));

function handWorld(hand){return {x:player.x+hand.x,y:player.y+hand.y};}
function fireKickGun(){
  const h=handWorld(player.right); const dir={x:Math.cos(player.angle),y:Math.sin(player.angle)};
  let best=null,bestScore=1e9;
  for(const b of bots){
    const vx=b.x-h.x,vy=b.y-h.y,t=vx*dir.x+vy*dir.y;if(t<0||t>650)continue;
    const side=Math.abs(vx*dir.y-vy*dir.x);if(side<55&&side+t*.03<bestScore){best=b;bestScore=side+t*.03;}
  }
  if(best){kickBot(best);}else{toast('KICK GUN: NO TARGET');sfx('click');}
}
function kickBot(bot){
  const name=bot.name;bots=bots.filter(b=>b!==bot);toast(`${name} KICKED • REJOIN SLOT OPEN`);sfx('kick');
  setTimeout(()=>{bots.push(newBot((Math.random()*10000)|0,true));toast('NEW BOT JOINED THE ROOM');},2200);
}

const audio={ctx:null,master:null,musicTimer:null};
function ensureAudio(){
  if(audio.ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
  audio.ctx=new AC();audio.master=audio.ctx.createGain();audio.master.gain.value=save.volume;audio.master.connect(audio.ctx.destination);startMusic();
}
function tone(freq=300,dur=.12,type='sine',vol=.07,slide=0){
  ensureAudio();if(!audio.ctx)return;const c=audio.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide),c.currentTime+dur);g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+dur);o.connect(g);g.connect(audio.master);o.start();o.stop(c.currentTime+dur);
}
function noise(dur=.25,vol=.05,filter=900){
  ensureAudio();if(!audio.ctx)return;const c=audio.ctx,buf=c.createBuffer(1,c.sampleRate*dur,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const s=c.createBufferSource(),g=c.createGain(),f=c.createBiquadFilter();s.buffer=buf;f.type='lowpass';f.frequency.value=filter;g.gain.setValueAtTime(vol,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+dur);s.connect(f);f.connect(g);g.connect(audio.master);s.start();
}
function sfx(kind){
  if(kind==='tag'){tone(520,.08,'square',.06,180);setTimeout(()=>tone(760,.09,'sine',.05,160),45)}
  else if(kind==='kick'){tone(130,.16,'sawtooth',.08,-65);noise(.18,.05,400)}
  else if(kind==='buy'){tone(420,.1,'triangle',.05,220);setTimeout(()=>tone(700,.16,'triangle',.05,240),80)}
  else if(kind==='click'){tone(300,.05,'square',.025,40)}
  else if(kind==='join'){tone(300,.1,'sine',.035,180)}
  else tone(220,.06,'triangle',.03,40);
}
function startMusic(){
  if(audio.musicTimer)return;let step=0;audio.musicTimer=setInterval(()=>{
    if(!started||document.hidden||save.volume<=0)return;const scale=[196,220,247,294,247,220,196,165];tone(scale[step++%scale.length],.34,'triangle',.013,0);
  },520);
}
function scarySound(kind){
  ensureAudio();
  if(kind==='static'){for(let i=0;i<4;i++)setTimeout(()=>noise(.22,.1,rand(300,2200)),i*140);}
  if(kind==='whisper'){noise(1.2,.045,500);tone(92,1.3,'sine',.025,-25);}
  if(kind==='alarm'){for(let i=0;i<5;i++)setTimeout(()=>tone(i%2?980:650,.18,'square',.055,0),i*190);}
  if(kind==='heartbeat'){for(let i=0;i<4;i++)setTimeout(()=>{tone(74,.11,'sine',.09,-18);setTimeout(()=>tone(62,.13,'sine',.07,-12),120)},i*560);}
  if(kind==='scrape'){noise(1.0,.08,1500);tone(180,.9,'sawtooth',.025,520);}
  if(kind==='drone'){tone(58,2.4,'sawtooth',.045,-14);tone(87,2.4,'sine',.03,-22);}
  bots.forEach(b=>{b.fear=clamp(b.fear+rand(.7,1.2),0,2);b.state='flee';if(Math.random()<.6)botSpeak(b,pick(['WHAT WAS THAT?!','NOPE NOPE NOPE','bro turn that OFF 😭','I HEARD THAT','RUNNN','nah that sound is cursed']));});
  toast('SOUNDBOARD • BOTS PANICKED');
}

function speakText(text){
  if(!save.voices||!('speechSynthesis' in window))return;const u=new SpeechSynthesisUtterance(text.replace(/😭/g,''));u.rate=rand(.92,1.1);u.pitch=rand(.82,1.18);u.volume=save.volume*.75;speechSynthesis.speak(u);
}
function botSpeak(bot,text,voice=false){bot.chat=text;bot.chatUntil=time+3.5;if(voice)speakText(text);}
function playerSpeak(text){
  if(!text.trim())return;player.chat=text.slice(0,80);player.chatUntil=time+4;
  const lower=text.toLowerCase();let responses=[];
  if(/hello|hi|yo|hey/.test(lower))responses=['YOOO','hey!!','sup','HELLO 😭'];
  else if(/scary|ghost|haunt/.test(lower))responses=['do NOT play the scary sound','I saw something in the cave','nah bro 😭','ghost mode??'];
  else if(/tag|run/.test(lower))responses=['YOU CANT CATCH ME','BET','RUN THEN','im literally faster'];
  else if(/hat|cosmetic/.test(lower))responses=['check Hat Plaza','my hat is better','I spent all my Glow Stone 😭'];
  else responses=['real','WHAT 😭','bro','okayyy','I heard you','wait say that again'];
  const b=pick(bots);setTimeout(()=>botSpeak(b,pick(responses),true),rand(500,1300));
}

function openTalk(){
  ensureAudio();const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(SR){
    try{const r=new SR();r.lang='en-US';r.interimResults=false;r.maxAlternatives=1;toast('LISTENING…');r.onresult=e=>playerSpeak(e.results[0][0].transcript);r.onerror=()=>showChatInput();r.start();return;}catch(e){}
  }
  showChatInput();
}
function showChatInput(){$('#chatInputWrap').classList.remove('hidden');$('#chatInput').focus();}
$('#talkBtn').addEventListener('click',openTalk);
$('#chatSend').addEventListener('click',()=>{playerSpeak($('#chatInput').value);$('#chatInput').value='';$('#chatInputWrap').classList.add('hidden');});
$('#chatInput').addEventListener('keydown',e=>{if(e.key==='Enter')$('#chatSend').click();});

function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1800);}

function updateHud(){
  $('#modePill').textContent=save.mode.toUpperCase();$('#roomPill').textContent='ROOM: '+save.room;$('#currencyPill').textContent='✦ '+Math.floor(save.acorns)+' Glow Stone';
  $('#volumeRange').value=save.volume;$('#skillRange').value=save.skill;$('#reducedMotion').checked=save.reducedMotion;$('#voiceToggle').checked=save.voices;
  $('#colorCode').value=save.colorCode;
}
updateHud();

$('#menuBtn').addEventListener('click',()=>$('#panel').classList.toggle('hidden'));
$('#thumbBtn').addEventListener('click',()=>{$('#modPanel').classList.toggle('hidden');sfx('click');});
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.close).classList.add('hidden')));
$$('.tab').forEach(b=>b.addEventListener('click',()=>{
  $$('.tab').forEach(x=>x.classList.toggle('active',x===b));$$('.tabpage').forEach(x=>x.classList.add('hidden'));$('#tab-'+b.dataset.tab).classList.remove('hidden');if(b.dataset.tab==='shop')renderShop();
}));
$$('[data-mode]').forEach(b=>b.addEventListener('click',()=>{save.mode=b.dataset.mode;persist();resetMode();$('#panel').classList.add('hidden');}));
$('#joinRoom').addEventListener('click',()=>{let c=$('#roomCode').value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);if(!c)return toast('ENTER A ROOM CODE');save.room=c;persist();bots=[];fillBots();resetMode();toast('JOINED PRIVATE ROOM '+c);});
$('#newRoom').addEventListener('click',()=>{const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=chars[(Math.random()*chars.length)|0];$('#roomCode').value=s;save.room=s;persist();bots=[];fillBots();resetMode();toast('PRIVATE ROOM CREATED');});
$('#applyColor').addEventListener('click',()=>{let c=$('#colorCode').value.replace(/\D/g,'').slice(0,3);if(c.length!==3)return toast('USE A 3-DIGIT COLOR CODE');save.colorCode=c;player.color=colorFromCode(c);persist();toast('COLOR CODE '+c+' APPLIED');});
$('#volumeRange').addEventListener('input',e=>{save.volume=+e.target.value;if(audio.master)audio.master.gain.value=save.volume;persist();});
$('#skillRange').addEventListener('input',e=>{save.skill=+e.target.value;bots.forEach(b=>b.skill=clamp(save.skill+rand(-.18,.18),.3,1));persist();});
$('#reducedMotion').addEventListener('change',e=>{save.reducedMotion=e.target.checked;persist();});
$('#voiceToggle').addEventListener('change',e=>{save.voices=e.target.checked;persist();});
$('#resetData').addEventListener('click',()=>{if(confirm('Reset all Canopy Chase save data?')){localStorage.removeItem('canopyChaseSave');location.reload();}});

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
$('#installBtn').addEventListener('click',async()=>{
  if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;}
  else toast('iOS: SHARE → ADD TO HOME SCREEN');
});

$$('[data-mod]').forEach(b=>b.addEventListener('click',()=>{
  const m=b.dataset.mod;player.mods[m]=!player.mods[m];b.classList.toggle('on',player.mods[m]);sfx('click');
  if(m==='soundboard')$('#soundboard').classList.toggle('hidden',!player.mods[m]);
  if(m==='ghost'){
    if(player.mods.ghost){player.ghostShell={x:player.x,y:player.y,color:player.color};toast('GHOST MONKE • SHELL LEFT BEHIND');}
    else if(player.ghostShell){player.x=player.ghostShell.x;player.y=player.ghostShell.y;player.ghostShell=null;toast('RETURNED TO BODY');}
  }
  if(m==='invisible')toast(player.mods.invisible?'INVISIBLE TO BOTS':'VISIBLE AGAIN');
  if(m==='kickGun')toast(player.mods.kickGun?'KICK GUN ARMED • R INDEX':'KICK GUN OFF');
}));
$$('[data-sound]').forEach(b=>b.addEventListener('click',()=>scarySound(b.dataset.sound)));

function renderShop(){
  const grid=$('#shopGrid');grid.innerHTML='';const items=baseCosmetics.concat(eventActive()?eventCosmetics:[]);
  for(const [id,name,emoji,price] of items){
    const owned=save.owned.includes(id),equipped=save.equipped===id,event=eventCosmetics.some(x=>x[0]===id);
    const d=document.createElement('div');d.className='shopItem'+(event?' eventItem':'');d.innerHTML=`<div class="preview">${emoji}</div><b>${name}</b><small>${event?'3-DAY EVENT • ':''}${price?`✦ ${price}`:'FREE'}</small><button>${equipped?'EQUIPPED':owned?'EQUIP':`BUY • ${price}`}</button>`;
    d.querySelector('button').onclick=()=>{
      if(owned){save.equipped=id;persist();renderShop();toast(name.toUpperCase()+' EQUIPPED');return;}
      if(save.acorns<price){toast('NOT ENOUGH GLOW STONE');return;}save.acorns-=price;save.owned.push(id);save.equipped=id;persist();renderShop();sfx('buy');toast(name.toUpperCase()+' UNLOCKED');
    };grid.appendChild(d);
  }
  if(!eventActive()){
    const p=document.createElement('p');p.className='hint';p.textContent='The 3-day mini-event has ended. Any event cosmetics you bought remain in your inventory.';grid.appendChild(p);
  }
}
function updateEventTimer(){
  const ms=save.eventStart+eventLength-now(),el=$('#eventTimer');if(ms<=0){el.textContent='EVENT ENDED';return;}
  const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000);el.textContent=`MINI-EVENT ${d}d ${h}h ${m}m`;
}
setInterval(updateEventTimer,1000);updateEventTimer();

$('#startBtn').addEventListener('click',()=>{
  ensureAudio();started=true;$('#startScreen').classList.add('hidden');resetMode();toast('USE BOTH HANDS TO RUN');
});

function resize(){DPR=Math.min(devicePixelRatio||1,2);W=innerWidth;H=innerHeight;canvas.width=Math.floor(W*DPR);canvas.height=Math.floor(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);}
addEventListener('resize',resize);resize();

function collideEntity(e){
  e.x=clamp(e.x,100,WORLD.w-100);e.y=clamp(e.y,100,WORLD.h-100);
  for(const o of obstacles){
    if(o.type==='log'){
      const cx=clamp(e.x,o.x-o.w/2,o.x+o.w/2),cy=clamp(e.y,o.y-o.h/2,o.y+o.h/2),dx=e.x-cx,dy=e.y-cy,d=Math.hypot(dx,dy)||.001;
      if(d<e.r+5){const push=e.r+5-d;e.x+=dx/d*push;e.y+=dy/d*push;e.vx+=dx/d*1.5;e.vy+=dy/d*1.5;}
    }else{
      const dx=e.x-o.x,dy=e.y-o.y,d=Math.hypot(dx,dy)||.001,min=e.r+o.r;
      if(d<min){const p=min-d;e.x+=dx/d*p;e.y+=dy/d*p;e.vx+=dx/d*1.15;e.vy+=dy/d*1.15;}
    }
  }
}

function updatePlayer(dt){
  let lx=input.left.x,ly=input.left.y,rx=input.right.x,ry=input.right.y;
  if(input.keys['a']){lx=-1;rx=-.8}if(input.keys['d']){lx=1;rx=.8}if(input.keys['w']){ly=-1;ry=-.8}if(input.keys['s']){ly=1;ry=.8}
  const armScale=player.mods.longArms?1.85:1;
  const reach=78*armScale;
  player.left.x=lerp(player.left.x,-42+lx*reach,.22);player.left.y=lerp(player.left.y,28+ly*reach,.22);
  player.right.x=lerp(player.right.x,42+rx*reach,.22);player.right.y=lerp(player.right.y,28+ry*reach,.22);

  const mx=(lx+rx)/2,my=(ly+ry)/2,mag=clamp(Math.hypot(mx,my),0,1);
  if(mag>.08){
    const speed=player.mods.ghost?760:560; // world units/s: fast but controllable
    const accel=speed*(.68+.32*mag);
    player.vx+=mx*accel*dt;player.vy+=my*accel*dt;
    player.angle=Math.atan2(my,mx);
  }
  // alternating hands gives a small pumping bonus
  const pump=Math.abs(lx-rx)+Math.abs(ly-ry);if(pump>.8){player.vx+=Math.cos(player.angle)*90*dt;player.vy+=Math.sin(player.angle)*90*dt;}
  const max=player.mods.ghost?520:350,sp=Math.hypot(player.vx,player.vy);if(sp>max){player.vx=player.vx/sp*max;player.vy=player.vy/sp*max;}
  const drag=Math.pow(.12,dt);player.vx*=drag;player.vy*=drag;
  player.x+=player.vx*dt;player.y+=player.vy*dt;
  if(!player.mods.ghost)collideEntity(player);else{player.x=clamp(player.x,70,WORLD.w-70);player.y=clamp(player.y,70,WORLD.h-70);}

  if(player.mods.platforms&&time%1<dt&&mag>.3){const h=handWorld(Math.random()<.5?player.left:player.right);platforms.push({x:h.x,y:h.y,r:38,life:5});if(platforms.length>14)platforms.shift();}
  platforms.forEach(p=>p.life-=dt);platforms=platforms.filter(p=>p.life>0);

  if(save.mode!=='Casual')handleTags();
}

function nearestThreat(bot){
  let t=null,d=1e9;
  const consider=(x,y,obj)=>{const dd=Math.hypot(bot.x-x,bot.y-y);if(dd<d){d=dd;t=obj;}};
  if(save.mode==='Tag'){
    if(player.tagger&&!player.mods.ghost&&!player.mods.invisible)consider(player.x,player.y,player);
    bots.filter(b=>b.tagger).forEach(b=>{if(b!==bot)consider(b.x,b.y,b);});
  }else if(save.mode==='Infection'){
    if(player.infected&&!player.mods.ghost&&!player.mods.invisible)consider(player.x,player.y,player);
    bots.filter(b=>b.infected).forEach(b=>{if(b!==bot)consider(b.x,b.y,b);});
  }else if(save.mode==='Echo Hunt'){
    bots.filter(b=>b.tagger).forEach(b=>{if(b!==bot)consider(b.x,b.y,b);});
  }
  return {target:t,d};
}
function nearestPrey(bot){
  let arr=bots.filter(b=>b!==bot && !(save.mode==='Tag'?b.tagger:b.infected));
  if(!(player.mods.ghost||player.mods.invisible) && !(save.mode==='Tag'?player.tagger:player.infected))arr=arr.concat(player);
  let t=null,d=1e9;for(const o of arr){const dd=Math.hypot(bot.x-o.x,bot.y-o.y);if(dd<d){d=dd;t=o;}}return {target:t,d};
}
function avoidObstacles(b,dx,dy){
  let ax=0,ay=0;for(const o of obstacles){const rr=o.r||Math.max(o.w,o.h)/2,ox=b.x-o.x,oy=b.y-o.y,d=Math.hypot(ox,oy)||1;if(d<rr+110){const f=(rr+110-d)/(rr+110);ax+=ox/d*f*1.8;ay+=oy/d*f*1.8;}}
  return {x:dx+ax,y:dy+ay};
}
function updateBots(dt){
  for(const b of bots){
    b.joinFlash=Math.max(0,b.joinFlash-dt);b.think-=dt;b.fear=Math.max(0,b.fear-dt*.12);
    if(b.think<=0){
      b.think=rand(.16,.55)*(1.15-b.skill*.3);
      const threat=nearestThreat(b),isHunter=(save.mode==='Tag'?b.tagger:b.infected)||(save.mode==='Echo Hunt'&&b.tagger);
      if(b.fear>.15&&!isHunter)b.state='flee';
      else if(isHunter)b.state='chase';
      else if(threat.target&&threat.d<520)b.state='flee';
      else if(Math.random()<.2)b.state='roam';
      if(Math.random()<.055&&time>b.chatUntil)botSpeak(b,pick(['this lobby is actually fun','who bought the frog hood 😭','meet at leaderboard','im going forest','NOOO I got tagged','anyone hear that?','private room W','watch this jump','bro stop chasing me']));
    }
    let dx=0,dy=0,runSpeed=170+180*b.skill;
    if(b.state==='chase'){
      const p=nearestPrey(b);if(p.target){dx=p.target.x-b.x;dy=p.target.y-b.y;const m=Math.hypot(dx,dy)||1;dx/=m;dy/=m;}
      runSpeed*=save.mode==='Echo Hunt'?1.12:1;
    }else if(b.state==='flee'){
      const th=nearestThreat(b);let tx=th.target?th.target.x:(player.x),ty=th.target?th.target.y:(player.y);dx=b.x-tx;dy=b.y-ty;const m=Math.hypot(dx,dy)||1;dx/=m;dy/=m;
      dx+=Math.cos(b.pathAngle)*.35;dy+=Math.sin(b.pathAngle)*.35;runSpeed*=1.05+b.fear*.12;
    }else{
      b.pathAngle+=rand(-.45,.45)*dt;dx=Math.cos(b.pathAngle);dy=Math.sin(b.pathAngle);runSpeed*=.52;
      if(b.x<170)dx=Math.abs(dx);if(b.x>1320)dx=-Math.abs(dx);if(b.y<170)dy=Math.abs(dy);if(b.y>1320)dy=-Math.abs(dy);
    }
    const av=avoidObstacles(b,dx,dy);dx=av.x;dy=av.y;const m=Math.hypot(dx,dy)||1;dx/=m;dy/=m;
    const responsiveness=4+5*b.skill;b.vx=lerp(b.vx,dx*runSpeed,clamp(responsiveness*dt,0,1));b.vy=lerp(b.vy,dy*runSpeed,clamp(responsiveness*dt,0,1));
    // human-ish jukes
    if((b.state==='flee'||b.state==='chase')&&Math.random()<dt*(.7+b.skill)){const s=Math.random()<.5?-1:1;b.vx+=-dy*rand(25,75)*s;b.vy+=dx*rand(25,75)*s;}
    b.x+=b.vx*dt;b.y+=b.vy*dt;collideEntity(b);
  }
  botVsBotTags();
}
function transferTag(from,to){
  if(save.mode==='Tag'){
    if(from===player)player.tagger=false;else from.tagger=false;
    if(to===player)player.tagger=true;else to.tagger=true;
  }else if(save.mode==='Infection'){
    if(to===player)player.infected=true;else to.infected=true;infectedCount++;
  }
  if(from!==player)from.lastTag=time;if(to!==player)to.lastTag=time;
  sfx('tag');
}
function botVsBotTags(){
  if(save.mode==='Casual')return;
  for(const a of bots){
    const hunter=save.mode==='Tag'?a.tagger:a.infected;if(!hunter)continue;
    for(const b of bots){if(a===b)continue;const prey=save.mode==='Tag'?!b.tagger:!b.infected;if(prey&&time-a.lastTag>.6&&dist(a,b)<a.r+b.r+8){transferTag(a,b);botSpeak(b,'NOOO 😭');break;}}
  }
}
function handleTags(){
  if(player.mods.ghost)return;
  const hands=[handWorld(player.left),handWorld(player.right)];
  for(const b of bots){
    const touch=Math.min(Math.hypot(hands[0].x-b.x,hands[0].y-b.y),Math.hypot(hands[1].x-b.x,hands[1].y-b.y),Math.hypot(player.x-b.x,player.y-b.y));
    if(touch<52&&time-b.lastTag>.65){
      if(save.mode==='Tag'){
        if(player.tagger&&!b.tagger){transferTag(player,b);save.stats.tags++;save.acorns+=12;toast(`TAGGED ${b.name} • +12 ✦`);persist();return;}
        if(b.tagger&&!player.tagger){transferTag(b,player);toast(`${b.name} TAGGED YOU`);return;}
      }else if(save.mode==='Infection'){
        if(player.infected&&!b.infected){transferTag(player,b);save.stats.tags++;save.acorns+=10;persist();toast(`${b.name} INFECTED • +10 ✦`);return;}
        if(b.infected&&!player.infected&&!player.mods.invisible){transferTag(b,player);toast('YOU WERE INFECTED');return;}
      }else if(save.mode==='Echo Hunt'){
        if(b.tagger&&!player.mods.invisible){toast('THE HUNTER CAUGHT YOU');player.x=600;player.y=650;player.vx=player.vy=0;save.acorns=Math.max(0,save.acorns-5);persist();return;}
      }
    }
  }
}
function updateRound(dt){
  if(!started)return;roundTimer+=dt;
  if(save.mode==='Infection'){
    const infected=(player.infected?1:0)+bots.filter(b=>b.infected).length;if(infected>=bots.length+1){
      save.stats.rounds++;if(!player.infected){save.stats.wins++;save.acorns+=75;toast('SURVIVED INFECTION • +75 ✦');}else toast('INFECTION COMPLETE');persist();resetMode();
    }
  }else if(save.mode==='Tag'&&roundTimer>95){
    save.stats.rounds++;if(!player.tagger){save.stats.wins++;save.acorns+=60;toast('ROUND SURVIVED • +60 ✦');}persist();resetMode();
  }else if(save.mode==='Echo Hunt'&&roundTimer>80){save.stats.rounds++;save.stats.wins++;save.acorns+=85;persist();toast('ECHO HUNT SURVIVED • +85 ✦');resetMode();}
  // Active-play Glow Stone reward: exactly 100 per hour, never offline.
  activeGlowFraction += dt * (100/3600);
  if(activeGlowFraction >= 1){
    const grant=Math.floor(activeGlowFraction);
    activeGlowFraction-=grant;
    save.acorns+=grant;
    persist();
  }
}

function camera(){
  const scale=Math.min(W/950,H/650)*1.05;return {s:scale,x:W/2-player.x*scale,y:H/2-player.y*scale};
}
function worldToScreen(x,y,c){return{x:x*c.s+c.x,y:y*c.s+c.y};}
function roundedRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function text(txt,x,y,size=14,color='#fff',align='center',weight=800){ctx.fillStyle=color;ctx.font=`${weight} ${size}px ui-rounded,system-ui`;ctx.textAlign=align;ctx.textBaseline='middle';ctx.fillText(txt,x,y);}
function draw(){
  ctx.clearRect(0,0,W,H);const c=camera();ctx.fillStyle='#163827';ctx.fillRect(0,0,W,H);
  ctx.save();ctx.translate(c.x,c.y);ctx.scale(c.s,c.s);
  drawWorld();ctx.restore();drawVignette();drawCrosshair(c);
}
function drawWorld(){
  // Ground and zones
  ctx.fillStyle='#264d31';ctx.fillRect(0,0,WORLD.w,WORLD.h);
  // subtle trail grid
  ctx.strokeStyle='rgba(255,255,255,.025)';ctx.lineWidth=2;for(let x=0;x<WORLD.w;x+=100){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,WORLD.h);ctx.stroke()}for(let y=0;y<WORLD.h;y+=100){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WORLD.w,y);ctx.stroke()}

  // Forest boundary
  ctx.fillStyle='#1d422a';ctx.fillRect(zones.forest.x,zones.forest.y,zones.forest.w,zones.forest.h);
  ctx.strokeStyle='rgba(189,255,152,.18)';ctx.lineWidth=5;ctx.strokeRect(zones.forest.x,zones.forest.y,zones.forest.w,zones.forest.h);
  // paths
  ctx.strokeStyle='#8b6a45';ctx.lineWidth=76;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(160,720);ctx.bezierCurveTo(650,520,1080,890,1440,700);ctx.stroke();ctx.beginPath();ctx.moveTo(1080,180);ctx.quadraticCurveTo(1200,520,1450,580);ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.09)';ctx.lineWidth=4;ctx.setLineDash([16,16]);ctx.beginPath();ctx.moveTo(160,720);ctx.bezierCurveTo(650,520,1080,890,1440,700);ctx.stroke();ctx.setLineDash([]);

  // Hat Plaza
  ctx.fillStyle='#3d3449';ctx.fillRect(zones.hats.x,zones.hats.y,zones.hats.w,zones.hats.h);
  ctx.strokeStyle='#caa7ff';ctx.lineWidth=6;ctx.strokeRect(zones.hats.x,zones.hats.y,zones.hats.w,zones.hats.h);
  for(let i=0;i<4;i++){const x=1580+(i%2)*250,y=430+Math.floor(i/2)*250;ctx.fillStyle=i%2?'#694b76':'#4b6a62';roundedRect(x,y,190,160,18);ctx.fill();text(['HATS','EVENT','COLOR','MIRROR'][i],x+95,y+30,18,'#fff');text(['🧢','🎃','🎨','✨'][i],x+95,y+95,48,'#fff');}

  // Leaderboard area
  ctx.fillStyle='#203746';ctx.fillRect(zones.boards.x,zones.boards.y,zones.boards.w,zones.boards.h);ctx.strokeStyle='#77d5ff';ctx.lineWidth=5;ctx.strokeRect(zones.boards.x,zones.boards.y,zones.boards.w,zones.boards.h);
  text('ROOM LEADERBOARD',1790,122,22,'#a9ebff');
  const scores=[...bots].sort((a,b)=>b.score-a.score).slice(0,5);scores.forEach((b,i)=>text(`${i+1}. ${b.name}   ${b.score}`,1580,157+i*25,14,'#eef9ff','left'));

  // Echo cave
  ctx.fillStyle='#17151d';ctx.fillRect(zones.cave.x,zones.cave.y,zones.cave.w,zones.cave.h);ctx.strokeStyle='#8e77a5';ctx.lineWidth=5;ctx.strokeRect(zones.cave.x,zones.cave.y,zones.cave.w,zones.cave.h);text('ECHO CAVE',1790,1180,22,'#d5bfff');text('scary sounds wake the room',1790,1220,12,'#bcaed0');

  // labels
  text('FOREST',180,155,26,'rgba(220,255,205,.7)','left');text('HAT PLAZA',1545,380,20,'#e9d6ff','left');

  // obstacles
  for(const o of obstacles){
    if(o.type==='tree'){
      ctx.fillStyle='#1c271a';ctx.beginPath();ctx.arc(o.x+5,o.y+7,o.r+7,0,TAU);ctx.fill();ctx.fillStyle='#634829';ctx.beginPath();ctx.arc(o.x,o.y,o.r*.42,0,TAU);ctx.fill();ctx.fillStyle='#3d7c42';ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,TAU);ctx.fill();ctx.fillStyle='rgba(255,255,255,.06)';ctx.beginPath();ctx.arc(o.x-o.r*.25,o.y-o.r*.3,o.r*.45,0,TAU);ctx.fill();
    }else if(o.type==='rock'){
      ctx.fillStyle='#59645b';ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,TAU);ctx.fill();ctx.fillStyle='rgba(255,255,255,.1)';ctx.beginPath();ctx.arc(o.x-o.r*.2,o.y-o.r*.2,o.r*.55,0,TAU);ctx.fill();
    }else{ctx.fillStyle='#6c4c2c';roundedRect(o.x-o.w/2,o.y-o.h/2,o.w,o.h,18);ctx.fill();}
  }
  platforms.forEach(p=>{ctx.fillStyle=`rgba(120,210,255,${.12+.14*p.life/5})`;ctx.strokeStyle='rgba(170,235,255,.55)';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill();ctx.stroke();});

  if(player.ghostShell) drawMonke(player.ghostShell.x,player.ghostShell.y,player.ghostShell.color,'SHELL',false,false,'bare',.55);
  bots.forEach(b=>drawMonke(b.x,b.y,b.color,b.name,b.tagger,b.infected,b.cosmetic,1,b.chat,b.chatUntil));
  drawPlayer();
}
function cosmeticEmoji(id){const f=baseCosmetics.concat(eventCosmetics).find(x=>x[0]===id);return f?f[2]:'';}
function drawMonke(x,y,color,name,tagger=false,infected=false,cosmetic='bare',alpha=1,chat='',chatUntil=0){
  ctx.save();ctx.globalAlpha=alpha;
  // shadow
  ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(x+6,y+13,30,21,0,0,TAU);ctx.fill();
  // arms
  ctx.strokeStyle=color;ctx.lineWidth=14;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-13,y+2);ctx.lineTo(x-32,y+24);ctx.moveTo(x+13,y+2);ctx.lineTo(x+32,y+24);ctx.stroke();
  // body/head
  ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y+9,24,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(x,y-16,18,0,TAU);ctx.fill();
  ctx.fillStyle='#f5f1e8';ctx.beginPath();ctx.arc(x-6,y-19,3.5,0,TAU);ctx.arc(x+6,y-19,3.5,0,TAU);ctx.fill();ctx.fillStyle='#172018';ctx.beginPath();ctx.arc(x-6,y-19,1.7,0,TAU);ctx.arc(x+6,y-19,1.7,0,TAU);ctx.fill();
  if(tagger||infected){ctx.strokeStyle=tagger?'#ff5b54':'#d66cff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y+3,32,0,TAU);ctx.stroke();}
  const em=cosmeticEmoji(cosmetic);if(em)text(em,x,y-47,22,'#fff');
  text(name,x,y+48,11,'rgba(255,255,255,.9)');
  if(chat&&chatUntil>time){const w=clamp(chat.length*6+18,75,220);ctx.fillStyle='rgba(6,13,10,.86)';roundedRect(x-w/2,y-95,w,34,10);ctx.fill();text(chat,x,y-78,10,'#fff');}
  ctx.restore();
}
function drawPlayer(){
  const alpha=player.mods.invisible?.18:player.mods.ghost?.42:1;ctx.save();ctx.globalAlpha=alpha;
  ctx.fillStyle='rgba(0,0,0,.22)';ctx.beginPath();ctx.ellipse(player.x+6,player.y+14,34,22,0,0,TAU);ctx.fill();
  const lw=handWorld(player.left),rw=handWorld(player.right);
  ctx.strokeStyle=player.color;ctx.lineWidth=15;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(player.x-12,player.y+3);ctx.lineTo(lw.x,lw.y);ctx.moveTo(player.x+12,player.y+3);ctx.lineTo(rw.x,rw.y);ctx.stroke();
  ctx.fillStyle=player.color;ctx.beginPath();ctx.arc(player.x,player.y+8,28,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(player.x,player.y-18,20,0,TAU);ctx.fill();
  for(const h of [lw,rw]){ctx.beginPath();ctx.arc(h.x,h.y,12,0,TAU);ctx.fill();}
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(player.x-7,player.y-22,4,0,TAU);ctx.arc(player.x+7,player.y-22,4,0,TAU);ctx.fill();ctx.fillStyle='#1b2a20';ctx.beginPath();ctx.arc(player.x-7,player.y-22,2,0,TAU);ctx.arc(player.x+7,player.y-22,2,0,TAU);ctx.fill();
  if(player.tagger||player.infected){ctx.strokeStyle=player.tagger?'#ff5b54':'#d66cff';ctx.lineWidth=5;ctx.beginPath();ctx.arc(player.x,player.y+2,38,0,TAU);ctx.stroke();}
  const em=cosmeticEmoji(save.equipped);if(em)text(em,player.x,player.y-54,24,'#fff');
  if(player.chat&&player.chatUntil>time){const w=clamp(player.chat.length*6+18,80,240);ctx.fillStyle='rgba(5,12,9,.9)';roundedRect(player.x-w/2,player.y-106,w,36,10);ctx.fill();text(player.chat,player.x,player.y-88,10,'#fff');}
  if(player.mods.ghost)text('GHOST',player.x,player.y+62,11,'#b7eaff');if(player.mods.invisible)text('INVISIBLE',player.x,player.y+76,11,'#e8e8ff');
  if(player.mods.kickGun){ctx.strokeStyle='rgba(255,90,90,.8)';ctx.lineWidth=3;ctx.setLineDash([10,8]);ctx.beginPath();ctx.moveTo(rw.x,rw.y);ctx.lineTo(rw.x+Math.cos(player.angle)*650,rw.y+Math.sin(player.angle)*650);ctx.stroke();ctx.setLineDash([]);}
  ctx.restore();
}
function drawVignette(){
  const g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.2,W/2,H/2,Math.max(W,H)*.72);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.42)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}
function drawCrosshair(c){
  if(!player.mods.kickGun)return;ctx.strokeStyle='rgba(255,110,110,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,H/2,10,0,TAU);ctx.moveTo(W/2-16,H/2);ctx.lineTo(W/2+16,H/2);ctx.moveTo(W/2,H/2-16);ctx.lineTo(W/2,H/2+16);ctx.stroke();
}

function update(dt){if(!started)return;time+=dt;updatePlayer(dt);updateBots(dt);updateRound(dt);}
function frame(t){let dt=Math.min(.033,(t-last)/1000||.016);last=t;if(save.reducedMotion)dt=Math.min(dt,.022);update(dt);draw();requestAnimationFrame(frame)}
requestAnimationFrame(frame);


// Bot reactions when ambient "scare" key pressed on desktop.
addEventListener('keydown',e=>{if(e.key.toLowerCase()==='p')scarySound('static');});

// Service worker for installable iOS/desktop PWA.
if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}

// keep UI in sync if event expires while game is open
setInterval(()=>{if(!eventActive()&&!$('#tab-shop').classList.contains('hidden'))renderShop();},60000);

})();
