/* ЭкоТрек - service worker: работа без сети и напоминания о серии дней */
const CACHE="ecotrack-v1",STATE="eco-state",KEY="./__state";
const CORE=["./","./index.html","./config.js","./manifest.webmanifest","./icons/icon-192.png","./icons/icon-512.png"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==STATE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

// Сначала сеть (чтобы всегда была свежая версия сайта), без сети - сохранённая копия.
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{})}
    return res;
  }).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||(r.mode==="navigate"?caches.match("./"):Response.error()))));
});

const getState=async()=>{try{const m=await (await caches.open(STATE)).match(KEY);return m?await m.json():{}}catch{return{}}};
const setState=async s=>{try{await (await caches.open(STATE)).put(KEY,new Response(JSON.stringify(s),{headers:{"Content-Type":"application/json"}}))}catch{}};

self.addEventListener("message",e=>{
  const d=e.data||{};
  if(d.type==="state")e.waitUntil(getState().then(s=>setState({...s,on:!!d.on,hour:Number.isFinite(+d.hour)?+d.hour:19,token:d.token||"",api:d.api||s.api||""})));
});

const plural=(n,a,b,c)=>{const m=n%10,h=n%100;return n+" "+(m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c)};

async function remind(){
  const s=await getState();if(!s.on||!s.token||!s.api)return;
  const n=new Date(),day=n.toDateString();if(n.getHours()<s.hour||s.day===day)return;
  // Если сайт открыт, напоминание покажет он сам.
  const open=await self.clients.matchAll({type:"window",includeUncontrolled:true});if(open.some(c=>c.visibilityState==="visible"))return;
  let x;try{x=await (await fetch(s.api,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"extra",token:s.token})})).json()}catch{return}
  if(!x||!x.ok)return;await setState({...s,day});if(x.playedToday)return;
  const title=x.streak>0?`🔥 Серия ${plural(x.streak,"день","дня","дней")} может сгореть!`:"🌱 Время для ЭкоТрека";
  await self.registration.showNotification(title,{body:"Сыграй сегодня в любую мини-игру, чтобы продлить серию.",icon:"icons/icon-192.png",badge:"icons/icon-192.png",tag:"eco-remind"});
}
self.addEventListener("periodicsync",e=>{if(e.tag==="eco-remind")e.waitUntil(remind())});

self.addEventListener("notificationclick",e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{
    const c=cs.find(c=>"focus" in c);return c?c.focus():self.clients.openWindow("./");
  }));
});
