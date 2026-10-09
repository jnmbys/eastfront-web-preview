type Settings={visible:boolean;hand:'left'|'right';speed:number};
const key='eastfront-map-joystick-v1';
function settings():Settings{let s:any={};try{s=JSON.parse(localStorage.getItem(key)??'{}');}catch{}return {visible:typeof s.visible==='boolean'?s.visible:matchMedia('(pointer:coarse)').matches,hand:s.hand==='left'?'left':'right',speed:[180,320,500].includes(s.speed)?s.speed:320};}
export function joystickSettings(){const s=settings();return `<fieldset class="joystick-settings"><legend>地图摇杆 · 仅本机</legend><label><input id="joystick-visible" type="checkbox" ${s.visible?'checked':''}>显示地图摇杆</label><label>位置<select id="joystick-hand"><option value="left" ${s.hand==='left'?'selected':''}>左手</option><option value="right" ${s.hand==='right'?'selected':''}>右手</option></select></label><label>镜头速度<select id="joystick-speed">${[[180,'慢'],[320,'标准'],[500,'快']].map(([n,t])=>`<option value="${n}" ${s.speed===n?'selected':''}>${t}</option>`).join('')}</select></label></fieldset>`;}
export function bindJoystickSettings(){for(const id of ['joystick-visible','joystick-hand','joystick-speed']){const e=document.getElementById(id) as HTMLInputElement|null;if(e)e.onchange=()=>{const s=settings();if(id==='joystick-visible')s.visible=e.checked;if(id==='joystick-hand')s.hand=e.value as Settings['hand'];if(id==='joystick-speed')s.speed=Number(e.value);try{localStorage.setItem(key,JSON.stringify(s));}catch{}window.dispatchEvent(new Event('map-joystick-settings'));};}}
export function mountJoystick(pan:(x:number,y:number)=>void,hold:(v:boolean)=>void):()=>void{
 document.getElementById('map-joystick')?.remove();const el=document.createElement('div');el.id='map-joystick';el.setAttribute('aria-label','地图摇杆，推动平移，松手停止');el.innerHTML='<span class="joystick-ring">↕ ↔</span><span class="joystick-stick"></span>';document.body.append(el);
 let config=settings(),pointer:number|null=null,vector={x:0,y:0},frame=0,last=0,center={x:0,y:0};const knob=el.lastElementChild as HTMLElement;
 const stop=()=>{const id=pointer;pointer=null;if(id!==null){try{if(el.hasPointerCapture?.(id))el.releasePointerCapture(id);}catch{}};vector={x:0,y:0};cancelAnimationFrame(frame);frame=0;last=0;knob.style.transform='';el.classList.remove('active');hold(false);};
 const tick=(t:number)=>{if(pointer===null)return;const dt=last?Math.min(32,t-last)/1000:0;last=t;pan(-vector.x*config.speed*dt,-vector.y*config.speed*dt);frame=requestAnimationFrame(tick);};
 const move=(e:PointerEvent)=>{if(e.pointerId!==pointer)return;const dx=e.clientX-center.x,dy=e.clientY-center.y;if(Math.abs(dx)>50||Math.abs(dy)>50){stop();return;}const length=Math.hypot(dx,dy),factor=Math.max(32,length);vector={x:dx/factor,y:dy/factor};if(length<5)vector={x:0,y:0};knob.style.transform=`translate(${vector.x*28}px,${vector.y*28}px)`;};
 let layoutKey='',layoutFrame=0;
 const position=()=>{cancelAnimationFrame(layoutFrame);layoutFrame=requestAnimationFrame(()=>{
  const bars=['.ui-corps-bar','.map-command-strip','.map-plan-strip','.direct-command-bar','.direct-map-strip','.map-command-feedback'].map(q=>document.querySelector(q)?.getBoundingClientRect()).filter((r):r is DOMRect=>!!r&&r.height>0&&r.width>0) as DOMRect[];
  const bottom=Math.min(innerHeight-130,Math.max(105,...bars.map(r=>innerHeight-r.top+16)));el.style.bottom=bottom+'px';
  const sidebar=document.querySelector('.ui-sidebar')?.getBoundingClientRect();
  el.style.right=config.hand==='right'?((sidebar&&sidebar.left>innerWidth/2?innerWidth-sidebar.left+12:22)+'px'):'auto';
  el.style.left=config.hand==='left'?((sidebar&&sidebar.right<innerWidth/2?sidebar.right+12:22)+'px'):'auto';
 });};
 const layout=(e:Event)=>{const k=(e as CustomEvent).detail;if(k===layoutKey)return;layoutKey=k;position();};
 const change=()=>{stop();config=settings();el.hidden=!config.visible;el.dataset.hand=config.hand;position();};
 const blur=()=>stop(),visibility=()=>{if(document.hidden)stop();};
 el.onpointerdown=e=>{e.preventDefault();e.stopPropagation();if(pointer!==null){stop();return;}const r=el.getBoundingClientRect();center={x:r.left+r.width/2,y:r.top+r.height/2};pointer=e.pointerId;el.setPointerCapture(e.pointerId);el.classList.add('active');hold(true);move(e);frame=requestAnimationFrame(tick);};
 el.onpointermove=e=>{e.preventDefault();move(e);};el.onpointerup=el.onpointercancel=el.onlostpointercapture=el.onpointerleave=stop;el.onclick=e=>{e.preventDefault();e.stopPropagation();};
 const observer=new ResizeObserver(position);for(const q of ['.ui-corps-bar','.map-command-strip','.map-plan-strip','.ui-sidebar']){const node=document.querySelector(q);if(node)observer.observe(node);}
 window.addEventListener('map-ui-layout',layout);window.addEventListener('resize',position);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);window.addEventListener('map-joystick-settings',change);change();
 return ()=>{observer.disconnect();stop();cancelAnimationFrame(layoutFrame);window.removeEventListener('map-ui-layout',layout);window.removeEventListener('resize',position);el.remove();window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('map-joystick-settings',change);};
}
