// ЭкоТрек: учителя, классы, бейджи и аватарки. Дополнение к Code.gs — добавить отдельным файлом НИЖЕ Code.gs.
// Один раз запустить setupBadges(). Код для регистрации учителей задать в
// Настройки проекта -> Свойства скрипта: TEACHER_CODE = ваш секретный код.
Object.assign(H,{Avatars:["userId","data","updated"],Classes:["teacherId","code","name"],
Members:["teacherId","studentId","created"],
Badges:["id","teacherId","studentId","emoji","color","title","description","created","seen"]});
function setupBadges(){["Avatars","Classes","Members","Badges"].forEach(n=>{const s=SS().getSheetByName(n)||SS().insertSheet(n);
 s.getRange(1,1,s.getMaxRows(),H[n].length).setNumberFormat("@");
 s.getRange(1,1,1,H[n].length).setValues([H[n]]);s.setFrozenRows(1)})}

// Всё остальное — внутри замкнутой области, чтобы имена не конфликтовали с Code.gs.
(function(){

const COLORS=["green","blue","purple","orange","pink","gold"];
const AV_MAX=48000;
const now=()=>new Date().toISOString();
const byId=id=>rows("Users").find(u=>u.id===id);
const byName=un=>rows("Users").find(u=>u.username===String(un||"").toLowerCase().replace(/^@/,""));
const delRows=(n,list)=>{const sh=SS().getSheetByName(n);list.map(r=>r._row).sort((a,b)=>b-a).forEach(r=>sh.deleteRow(r))};
function needTeacher(u){if(u.role!=="teacher"&&u.role!=="admin")throw"Это доступно только учителям"}
function checkTeacherCode(code){
 const real=PropertiesService.getScriptProperties().getProperty("TEACHER_CODE");
 if(!real)throw"Регистрация учителей пока не настроена администратором";
 const c=CacheService.getScriptCache(),n=Number(c.get("tc_fail")||0);
 if(n>=10)throw"Слишком много попыток. Подождите 10 минут";
 if(String(code||"").trim()!==real){c.put("tc_fail",String(n+1),600);throw"Неверный код учителя"}}
function newCode(){const ab="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",used=rows("Classes").map(c=>c.code);let s;
 do{s="";for(let i=0;i<6;i++)s+=ab[Math.floor(Math.random()*ab.length)]}while(used.includes(s));return s}
function classOf(t){let c=rows("Classes").find(x=>x.teacherId===t.id);
 if(!c){add("Classes",[t.id,newCode(),"Мой класс"]);c=rows("Classes").find(x=>x.teacherId===t.id)}return c}
const isMember=(tid,sid)=>rows("Members").some(m=>m.teacherId===tid&&m.studentId===sid);
function badgeOut(b,users){const t=users.find(u=>u.id===b.teacherId);
 return{id:b.id,emoji:b.emoji,color:b.color,title:b.title,description:b.description,created:b.created,seen:b.seen==="1",
  from:t?{username:t.username,firstName:t.firstName,lastName:t.lastName}:null}}
const sortNew=(a,b)=>a.created<b.created?1:-1;
function studentOf(t,username){const s=byName(username);if(!s||!isMember(t.id,s.id))throw"Этого ученика нет в вашем классе";return s}

Object.assign(A,{
registerTeacher(d){checkTeacherCode(d.teacherCode);const r=A.register(d);
 const u=rows("Users").find(x=>x.username===r.user.username);upd("Users",u._row,"role","teacher");
 r.user.role="teacher";return r},
becomeTeacher(d){const u=who(d);if(u.role==="teacher"||u.role==="admin")return{user:pub(u)};checkTeacherCode(d.code);
 upd("Users",u._row,"role","teacher");delRows("Members",rows("Members").filter(m=>m.studentId===u.id));
 return{user:pub(byId(u.id))}},
extra(d){const u=who(d),av=rows("Avatars").find(a=>a.userId===u.id),users=rows("Users");
 const o={avatar:av?av.data:""};
 o.badges=rows("Badges").filter(b=>b.studentId===u.id).sort(sortNew).map(b=>badgeOut(b,users));
 o.teachers=rows("Members").filter(m=>m.studentId===u.id).map(m=>users.find(x=>x.id===m.teacherId)).filter(Boolean).map(pub);
 if(u.role==="teacher"||u.role==="admin"){const c=classOf(u);o.class={code:c.code,name:c.name,count:rows("Members").filter(m=>m.teacherId===u.id).length}}
 return o},
avatarSet(d){const u=who(d),data=String(d.data||""),old=rows("Avatars").find(a=>a.userId===u.id);
 if(data&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data))throw"Неверный формат картинки";
 if(data.length>AV_MAX)throw"Картинка слишком большая";
 if(!data){if(old)delRows("Avatars",[old]);return{avatar:""}}
 if(old){upd("Avatars",old._row,"data",data);upd("Avatars",old._row,"updated",now())}else add("Avatars",[u.id,data,now()]);
 return{avatar:data}},
avatars(d){who(d);const want=(Array.isArray(d.usernames)?d.usernames:[]).slice(0,100).map(s=>String(s).toLowerCase());
 const users=rows("Users"),av=rows("Avatars"),map={};
 want.forEach(un=>{const u=users.find(x=>x.username===un),a=u&&av.find(x=>x.userId===u.id);map[un]=a?a.data:""});
 return{map}},
classInfo(d){const t=who(d);needTeacher(t);const c=classOf(t),users=rows("Users"),bs=rows("Badges");
 const students=rows("Members").filter(m=>m.teacherId===t.id).map(m=>users.find(u=>u.id===m.studentId)).filter(Boolean)
  .map(s=>Object.assign(pub(s),{badges:bs.filter(b=>b.studentId===s.id&&b.teacherId===t.id).length}))
  .sort((a,b)=>(a.lastName+a.firstName).localeCompare(b.lastName+b.firstName,"ru"));
 return{code:c.code,name:c.name,students}},
classRename(d){const t=who(d);needTeacher(t);if(!okName(d.name))throw"Название: от 1 до 40 символов";
 upd("Classes",classOf(t)._row,"name",d.name.trim());return{name:d.name.trim()}},
classNewCode(d){const t=who(d);needTeacher(t);const code=newCode();upd("Classes",classOf(t)._row,"code",code);return{code}},
classKick(d){const t=who(d);needTeacher(t);const s=studentOf(t,d.username);
 delRows("Members",rows("Members").filter(m=>m.teacherId===t.id&&m.studentId===s.id));return{}},
classJoin(d){const u=who(d);if(u.role!=="student")throw"Присоединяться к классу могут только ученики";
 const c=rows("Classes").find(x=>x.code===String(d.code||"").trim().toUpperCase());if(!c)throw"Класс с таким кодом не найден";
 if(isMember(c.teacherId,u.id))throw"Вы уже в этом классе";
 if(rows("Members").filter(m=>m.studentId===u.id).length>=10)throw"Можно состоять не более чем в 10 классах";
 add("Members",[c.teacherId,u.id,now()]);const t=byId(c.teacherId);return{teacher:pub(t),className:c.name}},
classLeave(d){const u=who(d),t=byName(d.username);if(!t)throw"Учитель не найден";
 delRows("Members",rows("Members").filter(m=>m.teacherId===t.id&&m.studentId===u.id));return{}},
studentBadges(d){const t=who(d);needTeacher(t);const s=studentOf(t,d.username),users=rows("Users");
 return{badges:rows("Badges").filter(b=>b.studentId===s.id).sort(sortNew).map(b=>Object.assign(badgeOut(b,users),{mine:b.teacherId===t.id}))}},
badgeGive(d){const t=who(d);needTeacher(t);const s=studentOf(t,d.username);
 const title=String(d.title||"").trim(),desc=String(d.description||"").trim(),emoji=String(d.emoji||"").trim();
 if(title.length<1||title.length>40)throw"Название бейджа: от 1 до 40 символов";
 if(desc.length>200)throw"Описание не длиннее 200 символов";
 if(emoji.length<1||emoji.length>16)throw"Выберите значок";
 if(!COLORS.includes(d.color))throw"Выберите цвет";
 const id=Utilities.getUuid();add("Badges",[id,t.id,s.id,emoji,d.color,title,desc,now(),""]);
 return{badge:badgeOut(rows("Badges").find(b=>b.id===id),[t])}},
badgeRevoke(d){const t=who(d);needTeacher(t);const b=rows("Badges").find(x=>x.id===String(d.id||""));
 if(!b||b.teacherId!==t.id)throw"Можно отозвать только свой бейдж";delRows("Badges",[b]);return{}},
badgesSeen(d){const u=who(d);rows("Badges").filter(b=>b.studentId===u.id&&b.seen!=="1").forEach(b=>upd("Badges",b._row,"seen","1"));return{}}});
})();
