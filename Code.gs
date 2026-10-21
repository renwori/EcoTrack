// ЭкоТрек: бэкенд на Google Таблице. Вставить в Расширения -> Apps Script, один раз запустить setup().
const H={Users:["id","username","firstName","lastName","salt","hash","theme","xp","role","bio","created"],
Sessions:["tokenHash","userId","expires"],Tasks:["userId","date","slot","taskId","done"]};
const CAT=[{id:1,title:"Разделить мусор",description:"Отдели бумагу и пластик перед тем, как выбросить.",icon:"♻️",xp:10},
{id:2,title:"Своя бутылка",description:"Возьми многоразовую бутылку вместо одноразовой.",icon:"💧",xp:10},
{id:3,title:"Свет выключен",description:"Выключи свет в комнатах, где никого нет.",icon:"💡",xp:5},
{id:4,title:"Пешком",description:"Пройди небольшое расстояние пешком, если это безопасно.",icon:"🚶",xp:10},
{id:5,title:"Макулатура",description:"Собери старые тетради и газеты для сдачи.",icon:"📰",xp:15},
{id:6,title:"Батарейки",description:"Узнай, где в твоём городе принимают батарейки.",icon:"🔋",xp:10},
{id:7,title:"Эко-факт",description:"Расскажи другу один интересный экологический факт.",icon:"🌍",xp:5},
{id:8,title:"Что перерабатывают",description:"Узнай, какие отходы можно сдать в твоём городе.",icon:"🔎",xp:10}];
const SS=()=>SpreadsheetApp.getActive();
function setup(){for(const n in H){const s=SS().getSheetByName(n)||SS().insertSheet(n);
 s.getRange(1,1,s.getMaxRows(),H[n].length).setNumberFormat("@");
 s.getRange(1,1,1,H[n].length).setValues([H[n]]);s.setFrozenRows(1)}}
function rows(n){return SS().getSheetByName(n).getDataRange().getValues().slice(1).map((r,i)=>{const o={_row:i+2};H[n].forEach((k,j)=>o[k]=String(r[j]));return o})}
function add(n,a){const s=SS().getSheetByName(n);s.appendRow(a.map(String))}
function upd(n,row,k,v){SS().getSheetByName(n).getRange(row,H[n].indexOf(k)+1).setValue(String(v))}
function sha(s){return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s))}
function hashPw(p,salt){let h=p;for(let i=0;i<2000;i++)h=Utilities.base64Encode(Utilities.computeHmacSha256Signature(h,salt));return h}
function pub(u){return{username:u.username,firstName:u.firstName,lastName:u.lastName,theme:u.theme,xp:Number(u.xp),role:u.role,bio:u.bio}}
function session(u){const t=Utilities.getUuid()+Utilities.getUuid();add("Sessions",[sha(t),u.id,Date.now()+30*864e5]);return{token:t,user:pub(u)}}
function who(d){const th=sha(d.token||"");const s=rows("Sessions").find(r=>r.tokenHash===th&&Number(r.expires)>Date.now());
 const u=s&&rows("Users").find(x=>x.id===s.userId);if(!u)throw"Сессия истекла, войдите заново";return u}
const okName=s=>typeof s==="string"&&s.trim().length>=1&&s.trim().length<=40;
function checkUn(un,self){if(!/^[a-z0-9_]{3,20}$/.test(un))throw"Юзернейм: 3–20 символов, a-z, 0-9 и _";
 if(rows("Users").some(u=>u.username===un&&u.id!==self))throw"Этот юзернейм уже занят"}
function checkPw(p){if(typeof p!=="string"||p.length<8||p.length>64)throw"Пароль: от 8 до 64 символов"}
function verify(u,p){if(hashPw(String(p||""),u.salt)!==u.hash)throw"Неверный пароль"}
const A={
register(d){const un=String(d.username||"").toLowerCase();checkUn(un);checkPw(d.password);
 if(!okName(d.firstName)||!okName(d.lastName))throw"Укажите имя и фамилию";
 const id=Utilities.getUuid(),salt=Utilities.getUuid();
 add("Users",[id,un,d.firstName.trim(),d.lastName.trim(),salt,hashPw(d.password,salt),"auto",0,"student","",new Date().toISOString()]);
 return session(rows("Users").find(u=>u.id===id))},
login(d){const un=String(d.username||"").toLowerCase(),c=CacheService.getScriptCache(),k="f_"+un,n=Number(c.get(k)||0);
 if(n>=8)throw"Слишком много попыток. Подождите 10 минут";
 const u=rows("Users").find(x=>x.username===un);
 if(!u||hashPw(String(d.password||""),u.salt)!==u.hash){c.put(k,String(n+1),600);throw"Неверный юзернейм или пароль"}
 c.remove(k);return session(u)},
me(d){return{user:pub(who(d))}},
logout(d){const th=sha(d.token||"");const s=rows("Sessions").find(r=>r.tokenHash===th);if(s)SS().getSheetByName("Sessions").deleteRow(s._row);return{}},
update(d){const u=who(d);
 if(d.firstName!==undefined){if(!okName(d.firstName)||!okName(d.lastName))throw"Укажите имя и фамилию";upd("Users",u._row,"firstName",d.firstName.trim());upd("Users",u._row,"lastName",d.lastName.trim())}
 if(d.bio!==undefined){if(String(d.bio).length>200)throw"Описание не длиннее 200 символов";upd("Users",u._row,"bio",d.bio)}
 if(d.theme!==undefined){if(!["auto","light","dark"].includes(d.theme))throw"Неверная тема";upd("Users",u._row,"theme",d.theme)}
 return{user:pub(rows("Users").find(x=>x.id===u.id))}},
changeUsername(d){const u=who(d);verify(u,d.password);const un=String(d.username||"").toLowerCase();checkUn(un,u.id);
 upd("Users",u._row,"username",un);return{user:pub(rows("Users").find(x=>x.id===u.id))}},
changePassword(d){const u=who(d);verify(u,d.oldPassword);checkPw(d.newPassword);
 const salt=Utilities.getUuid();upd("Users",u._row,"salt",salt);upd("Users",u._row,"hash",hashPw(d.newPassword,salt));
 const th=sha(d.token),sh=SS().getSheetByName("Sessions");
 rows("Sessions").filter(s=>s.userId===u.id&&s.tokenHash!==th).reverse().forEach(s=>sh.deleteRow(s._row));return{}},
tasks(d){const u=who(d),date=Utilities.formatDate(new Date(),"Europe/Moscow","yyyy-MM-dd");
 const mine=()=>rows("Tasks").filter(t=>t.userId===u.id&&t.date===date);
 if(!mine().length)CAT.slice().sort((a,b)=>sha(u.id+date+a.id)<sha(u.id+date+b.id)?-1:1).slice(0,3).forEach((c,i)=>add("Tasks",[u.id,date,i+1,c.id,""]));
 return{tasks:mine().map(t=>Object.assign({},CAT.find(c=>c.id==t.taskId),{slot:Number(t.slot),done:t.done==="1"}))}},
complete(d){const u=who(d),date=Utilities.formatDate(new Date(),"Europe/Moscow","yyyy-MM-dd");
 const t=rows("Tasks").find(x=>x.userId===u.id&&x.date===date&&x.slot==String(d.slot)&&x.done!=="1");
 if(!t)return{gained:0};const xp=CAT.find(c=>c.id==t.taskId).xp;
 upd("Tasks",t._row,"done","1");upd("Users",u._row,"xp",Number(u.xp)+xp);return{gained:xp}}};
function doPost(e){
  const lock=LockService.getScriptLock();
  try{
    lock.waitLock(20000);
    const d=JSON.parse(e.postData.contents);
    if(!A[d.action])throw"Неизвестное действие";
    return out(Object.assign({ok:true},A[d.action](d)));
  }catch(err){
    if(typeof err!=="string")console.error(err);
    return out({ok:false,error:typeof err==="string"?err:"Ошибка сервера: "+err});
  }finally{
    try{lock.releaseLock()}catch(x){}
  }
}
function out(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
