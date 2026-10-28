// ЭкоТрек: учителя, классы, бейджи, аватарки, чаты, мини-игры и ускорение сервера.
// Дополнение к Code.gs — отдельный файл НИЖЕ Code.gs. После каждого обновления этого файла
// один раз запустить setupBadges() и развернуть новую версию. Код учителя: Настройки проекта -> Свойства скрипта -> TEACHER_CODE.
Object.assign(H,{Avatars:["userId","data","updated"],Classes:["teacherId","code","name"],
Members:["teacherId","studentId","created"],
Badges:["id","teacherId","studentId","emoji","color","title","description","created","seen"],
Messages:["id","chat","userId","type","text","media","created"],ChatReads:["userId","chat","ts"],
GamesPlayed:["userId","date","game"]});
function setupBadges(){["Avatars","Classes","Members","Badges","Messages","ChatReads","GamesPlayed"].forEach(n=>{const s=SS().getSheetByName(n)||SS().insertSheet(n);
 s.getRange(1,1,s.getMaxRows(),H[n].length).setNumberFormat("@");
 s.getRange(1,1,1,H[n].length).setValues([H[n]]);s.setFrozenRows(1)})}

// Всё остальное — внутри замкнутой области, чтобы имена не конфликтовали с Code.gs.
(function(){
const DEV_NAME="renwori";
const COLORS=["green","blue","purple","orange","pink","gold"];
const AV_MAX=48000;
const now=()=>new Date().toISOString();
const today=()=>Utilities.formatDate(new Date(),"Europe/Moscow","yyyy-MM-dd");
const byId=id=>rows("Users").find(u=>u.id===id);
const byName=un=>rows("Users").find(u=>u.username===String(un||"").toLowerCase().replace(/^@/,""));
const delRows=(n,list)=>{const sh=SS().getSheetByName(n);list.map(r=>r._row).sort((a,b)=>b-a).forEach(r=>sh.deleteRow(r))};

// Разработчик: аккаунт, который первым был замечен с юзернеймом renwori. Дальше узнаётся по id,
// поэтому смена юзернейма ничего не ломает и никто другой не сможет «занять» эту роль.
let devId;
function isDev(u){
 if(devId===undefined){const p=PropertiesService.getScriptProperties();devId=p.getProperty("DEV_ID")||"";
  if(!devId){const r=rows("Users").find(x=>x.username===DEV_NAME);if(r){devId=r.id;p.setProperty("DEV_ID",devId)}}}
 return!!u&&!!devId&&u.id===devId}
const isStaff=u=>u.role==="teacher"||u.role==="admin"||isDev(u);
try{const _pub=pub;pub=function(u){const o=_pub(u);if(isDev(u))o.dev=true;return o}}catch(e){}

function needTeacher(u){if(!isStaff(u))throw"Это доступно только учителям"}
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
  from:t?{username:t.username,firstName:t.firstName,lastName:t.lastName,dev:isDev(t)}:null}}
const sortNew=(a,b)=>a.created<b.created?1:-1;
function studentOf(t,username){const s=byName(username);if(!s)throw"Пользователь не найден";
 if(isDev(t))return s;if(!isMember(t.id,s.id))throw"Этого ученика нет в вашем классе";return s}

/* ───── чаты ───── */
const mini=u=>u?{username:u.username,firstName:u.firstName,lastName:u.lastName,dev:isDev(u)}:{username:"",firstName:"?",lastName:""};
function msgTail(n){const sh=SS().getSheetByName("Messages"),last=sh.getLastRow();if(last<2)return[];
 const from=Math.max(2,last-n+1);
 return sh.getRange(from,1,last-from+1,H.Messages.length).getValues().map((r,i)=>{const o={_row:from+i};H.Messages.forEach((k,j)=>o[k]=String(r[j]));return o})}
function friendsOf(d){try{return A.friends(d)}catch(e){return{friends:[],incoming:[]}}}
function chatOf(u,d,key){key=String(key||"");
 if(key.indexOf("f:")===0){const o=byName(key.slice(2));if(!o||o.id===u.id)throw"Чат не найден";
  if(!(friendsOf(d).friends||[]).some(f=>f.username===o.username))throw"Писать можно только друзьям";
  return{id:"f:"+[u.id,o.id].sort().join(":"),kind:"f",other:o}}
 if(key.indexOf("c:")===0){const t=byName(key.slice(2)),c=t&&rows("Classes").find(x=>x.teacherId===t.id);
  if(!c||(t.id!==u.id&&!isMember(t.id,u.id)))throw"Вы не состоите в этом классе";
  return{id:"c:"+t.id,kind:"c",teacher:t,cls:c}}
 throw"Чат не найден"}
const msgOut=(m,u,users)=>({id:m.id,type:m.type,text:m.text,ts:Number(m.created),mine:m.userId===u.id,from:mini(users.find(x=>x.id===m.userId))});
function spam(u){const c=CacheService.getScriptCache(),k="ms_"+u.id,n=Number(c.get(k)||0);if(n>=30)throw"Слишком много сообщений. Подождите минуту";c.put(k,String(n+1),60)}
function markRead(u,chat){const r=rows("ChatReads").find(x=>x.userId===u.id&&x.chat===chat);
 if(r)upd("ChatReads",r._row,"ts",Date.now());else add("ChatReads",[u.id,chat,Date.now()])}

/* ───── мини-игры ───── */
const BINS=["Бумага","Пластик","Стекло","Металл","Опасные отходы"];
const GAMES={
 sort:{per:2,fixed:true,q:[
  ["Газета",0,"Газеты — это бумага, их сдают в макулатуру."],["Картонная коробка",0,"Картон перерабатывают вместе с бумагой. Сложите коробку, чтобы она занимала меньше места."],
  ["Старая тетрадь",0,"Тетради — бумага, скрепки лучше снять."],["Пластиковая бутылка",1,"ПЭТ-бутылка — пластик. Сомните её и закрутите крышку."],
  ["Бутылка от шампуня",1,"Флаконы от шампуня делают из пластика — их можно переработать."],["Пластиковый стаканчик от йогурта",1,"Стаканчик — пластик, только сполосните его."],
  ["Стеклянная банка",2,"Стеклянные банки перерабатывают много раз без потери качества."],["Стеклянная бутылка от сока",2,"Стеклянные бутылки идут в контейнер для стекла."],
  ["Консервная банка",3,"Консервные банки из жести — это металл."],["Алюминиевая банка от напитка",3,"Алюминий перерабатывается почти бесконечно."],
  ["Металлическая крышка от банки",3,"Крышки делают из металла — отправляйте их к металлу."],["Батарейка",4,"Батарейки содержат вредные вещества. Их сдают в специальные пункты приёма."],
  ["Ртутный градусник",4,"Ртуть очень опасна — градусник сдают как опасные отходы."],["Энергосберегающая лампа",4,"В таких лампах есть ртуть, их нельзя выбрасывать в обычный мусор."],
  ["Старый телефон",4,"В электронике есть вредные вещества — её сдают в пункты приёма техники."]]},
 quiz:{per:3,q:[
  ["Что деревья поглощают из воздуха при фотосинтезе?",["Углекислый газ","Только азот","Пыль","Метан"],"Деревья поглощают углекислый газ и выделяют кислород."],
  ["Сколько лет может разлагаться пластиковая бутылка?",["Сотни лет","Один год","10 дней","5 лет"],"Пластик разлагается сотни лет, поэтому его важно перерабатывать."],
  ["Какой источник энергии возобновляемый?",["Солнечный свет","Уголь","Нефть","Природный газ"],"Солнце светит постоянно, а запасы угля, нефти и газа заканчиваются."],
  ["Что лучше всего помогает сократить мусор?",["Многоразовые вещи","Одноразовая посуда","Новый пакет на каждую покупку","Выбрасывать всё в одну урну"],"Многоразовые бутылки, сумки и контейнеры заменяют сотни одноразовых вещей."],
  ["Какой газ люди выбрасывают больше всего, усиливая парниковый эффект?",["Углекислый газ","Кислород","Гелий","Аргон"],"Углекислый газ появляется при сжигании топлива и удерживает тепло в атмосфере."],
  ["Какая часть воды на Земле пресная?",["Около 3%","Около 50%","Около 90%","Вся вода пресная"],"Почти вся вода на Земле солёная, пресной — всего около 3%."],
  ["Что означает знак ♻️ на упаковке?",["Материал можно переработать","Упаковка съедобна","Товар из другой страны","Упаковку нельзя выбрасывать"],"Знак из трёх стрелок говорит, что упаковку можно переработать."],
  ["Куда правильно выбрасывать батарейки?",["В специальный пункт приёма","В обычную урну","В раковину","Закопать в землю"],"Пункты приёма батареек есть во многих магазинах и школах."],
  ["Какое животное опыляет растения?",["Пчела","Акула","Крот","Кит"],"Пчёлы переносят пыльцу с цветка на цветок, и появляются плоды."],
  ["Что помогает экономить электричество?",["Выключать свет, уходя","Оставлять зарядку в розетке","Надолго открывать холодильник","Включать все лампы днём"],"Выключенный свет — самый простой способ сберечь энергию."],
  ["Из чего делают бумагу?",["Из древесины","Из нефти","Из песка","Из металла"],"Бумагу делают из древесины, поэтому сдавать макулатуру — значит беречь деревья."],
  ["Из чего делают стекло?",["Из песка","Из дерева","Из нефти","Из хлопка"],"Основа стекла — песок, его плавят при очень высокой температуре."],
  ["Как называется хвойный лес на севере России?",["Тайга","Саванна","Джунгли","Прерия"],"Тайга — самый большой лесной пояс на планете."],
  ["Какой транспорт меньше всего загрязняет воздух?",["Велосипед","Грузовик","Самолёт","Мотоцикл"],"Велосипед совсем не выбрасывает вредных газов."],
  ["Что такое компост?",["Удобрение из растительных отходов","Вид пластика","Морская водоросль","Ядовитый газ"],"Из очисток и листьев получается полезное удобрение для растений."]]},
 myth:{per:3,fixed:true,opts:["Правда","Миф"],q:[
  ["Алюминиевую банку можно перерабатывать почти бесконечно.",0,"Правда: алюминий почти не теряет свойств при переработке."],
  ["Пластиковый пакет разлагается за пару месяцев.",1,"Миф: пакету нужны сотни лет."],
  ["Одно дерево может быть домом для сотен видов насекомых.",0,"Правда: на старых деревьях живут сотни видов насекомых, птицы и грибы."],
  ["Зарядка в розетке без телефона совсем не тратит электричество.",1,"Миф: она всё равно понемногу потребляет энергию."],
  ["Батарейку можно выбросить в обычную урну — она безопасна.",1,"Миф: вещества из батарейки отравляют почву и воду."],
  ["Стекло можно перерабатывать много раз без потери качества.",0,"Правда: из старого стекла получается такое же новое."],
  ["Душ обычно расходует меньше воды, чем ванна.",0,"Правда: короткий душ требует в несколько раз меньше воды."],
  ["Бумагу можно перерабатывать бесконечно.",1,"Миф: волокна укорачиваются, бумагу перерабатывают примерно 5–7 раз."],
  ["Пчёлы важны для урожая многих фруктов и овощей.",0,"Правда: без опыления не будет яблок, огурцов и многих других плодов."],
  ["В океане мусор собирается в огромные «мусорные пятна».",0,"Правда: течения сносят пластик в огромные скопления."],
  ["Почти весь кислород на Земле производят деревья.",1,"Миф: больше половины кислорода дают морские водоросли и фитопланктон."],
  ["Телевизор, выдернутый из розетки, продолжает тратить электричество.",1,"Миф: без розетки прибор ничего не потребляет."],
  ["Энергосберегающие лампы нужно сдавать в пункты приёма.",0,"Правда: в них есть ртуть."],
  ["Магазинные чеки всегда можно сдать в макулатуру.",1,"Миф: чеки обычно печатают на термобумаге, её не перерабатывают."],
  ["Очистки от овощей и фруктов можно компостировать.",0,"Правда: из них получается отличное удобрение."]]}};
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const gameRight=(G,q)=>G.opts||G===GAMES.sort?q[1]:0;
const played=(u,g)=>rows("GamesPlayed").some(r=>r.userId===u.id&&r.date===today()&&r.game===g);

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
 if(isStaff(u)){const c=rows("Classes").find(x=>x.teacherId===u.id);
  o.class=c?{code:c.code,name:c.name,count:rows("Members").filter(m=>m.teacherId===u.id).length}:null}
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
classKick(d){const t=who(d);needTeacher(t);const s=byName(d.username);if(!s||!isMember(t.id,s.id))throw"Этого ученика нет в вашем классе";
 delRows("Members",rows("Members").filter(m=>m.teacherId===t.id&&m.studentId===s.id));return{}},
classJoin(d){const u=who(d);if(u.role!=="student")throw"Присоединяться к классу могут только ученики";
 const c=rows("Classes").find(x=>x.code===String(d.code||"").trim().toUpperCase());if(!c)throw"Класс с таким кодом не найден";
 if(c.teacherId===u.id)throw"Это ваш собственный класс";
 if(isMember(c.teacherId,u.id))throw"Вы уже в этом классе";
 if(rows("Members").filter(m=>m.studentId===u.id).length>=10)throw"Можно состоять не более чем в 10 классах";
 add("Members",[c.teacherId,u.id,now()]);const t=byId(c.teacherId);return{teacher:pub(t),className:c.name}},
classLeave(d){const u=who(d),t=byName(d.username);if(!t)throw"Учитель не найден";
 delRows("Members",rows("Members").filter(m=>m.teacherId===t.id&&m.studentId===u.id));return{}},
studentBadges(d){const t=who(d);needTeacher(t);const s=studentOf(t,d.username),users=rows("Users");
 return{badges:rows("Badges").filter(b=>b.studentId===s.id).sort(sortNew).map(b=>Object.assign(badgeOut(b,users),{mine:b.teacherId===t.id||isDev(t)}))}},
badgeGive(d){const t=who(d);needTeacher(t);const s=studentOf(t,d.username);
 const title=String(d.title||"").trim(),desc=String(d.description||"").trim(),emoji=String(d.emoji||"").trim();
 if(title.length<1||title.length>40)throw"Название бейджа: от 1 до 40 символов";
 if(desc.length>200)throw"Описание не длиннее 200 символов";
 if(emoji.length<1||emoji.length>16)throw"Выберите значок";
 if(!COLORS.includes(d.color))throw"Выберите цвет";
 const id=Utilities.getUuid();add("Badges",[id,t.id,s.id,emoji,d.color,title,desc,now(),""]);
 return{badge:badgeOut(rows("Badges").find(b=>b.id===id),[t]),user:pub(s)}},
badgeRevoke(d){const t=who(d);needTeacher(t);const b=rows("Badges").find(x=>x.id===String(d.id||""));
 if(!b||(b.teacherId!==t.id&&!isDev(t)))throw"Можно отозвать только свой бейдж";delRows("Badges",[b]);return{}},
badgesSeen(d){const u=who(d);rows("Badges").filter(b=>b.studentId===u.id&&b.seen!=="1").forEach(b=>upd("Badges",b._row,"seen","1"));return{}},

chats(d){const u=who(d),F=friendsOf(d),users=rows("Users"),classes=rows("Classes"),list=[];
 (F.friends||[]).forEach(f=>{const o=users.find(x=>x.username===f.username);
  if(o)list.push({key:"f:"+o.username,id:"f:"+[u.id,o.id].sort().join(":"),kind:"f",title:o.firstName+" "+o.lastName,user:pub(o)})});
 const mine=classes.find(c=>c.teacherId===u.id);
 if(mine)list.push({key:"c:"+u.username,id:"c:"+u.id,kind:"c",title:mine.name,sub:"Ваш класс"});
 rows("Members").filter(m=>m.studentId===u.id).forEach(m=>{const t=users.find(x=>x.id===m.teacherId),c=classes.find(x=>x.teacherId===m.teacherId);
  if(t&&c)list.push({key:"c:"+t.username,id:"c:"+t.id,kind:"c",title:c.name,sub:"Учитель: "+t.firstName+" "+t.lastName})});
 const ids=list.map(c=>c.id),msgs=msgTail(3000).filter(m=>ids.indexOf(m.chat)>=0&&m.type!=="del"),reads=rows("ChatReads").filter(r=>r.userId===u.id);
 list.forEach(ch=>{const ms=msgs.filter(m=>m.chat===ch.id),l=ms[ms.length-1],r=reads.find(x=>x.chat===ch.id),rd=r?Number(r.ts):0;
  ch.last=l?{text:l.text.slice(0,80),type:l.type,mine:l.userId===u.id,from:(users.find(x=>x.id===l.userId)||{}).firstName||"",ts:Number(l.created)}:null;
  ch.unread=ms.filter(m=>Number(m.created)>rd&&m.userId!==u.id).length;delete ch.id});
 list.sort((a,b)=>(b.last?b.last.ts:0)-(a.last?a.last.ts:0));
 return{chats:list,requests:(F.incoming||[]).length}},
chatMessages(d){const u=who(d),c=chatOf(u,d,d.chat),users=rows("Users"),after=Number(d.after||0);
 const all=msgTail(3000).filter(m=>m.chat===c.id);
 const fresh=all.filter(m=>m.type!=="del"&&Number(m.created)>after).slice(-150);
 const o={messages:fresh.map(m=>msgOut(m,u,users)),gone:all.filter(m=>m.type==="del").slice(-50).map(m=>m.id)};
 if(!after){o.info=c.kind==="f"?{title:c.other.firstName+" "+c.other.lastName,user:pub(c.other)}
  :{title:c.cls.name,sub:"Учитель и "+rows("Members").filter(m=>m.teacherId===c.teacher.id).length+" учен.",teacher:c.teacher.username}}
 if(!after||fresh.some(m=>m.userId!==u.id))markRead(u,c.id);
 return o},
chatSend(d){const u=who(d),c=chatOf(u,d,d.chat),text=String(d.text||"").trim();
 if(!text)throw"Пустое сообщение";if(text.length>1000)throw"Сообщение не длиннее 1000 символов";spam(u);
 const m=[Utilities.getUuid(),c.id,u.id,"text",text,"",Date.now()];add("Messages",m);
 return{message:msgOut({id:m[0],type:"text",text,created:String(m[6]),userId:u.id},u,[u])}},
chatDelete(d){const u=who(d),c=chatOf(u,d,d.chat),m=msgTail(3000).find(x=>x.id===String(d.id||"")&&x.chat===c.id);
 if(!m||m.type==="del")throw"Сообщение не найдено";
 if(m.userId!==u.id&&!(c.kind==="c"&&(c.teacher.id===u.id||isDev(u))))throw"Можно удалить только своё сообщение";
 upd("Messages",m._row,"type","del");upd("Messages",m._row,"text","");return{}},

gameStart(d){const u=who(d),G=GAMES[d.game];if(!G)throw"Неизвестная игра";
 const picked=shuffle(G.q.map((q,i)=>i)).slice(0,5);
 CacheService.getScriptCache().put("gm_"+u.id+"_"+d.game,JSON.stringify(picked),3600);
 const items=picked.map(i=>{const q=G.q[i],o=G===GAMES.sort?BINS:G.opts||q[1],ix=G.fixed?o.map((x,k)=>k):shuffle(o.map((x,k)=>k));
  return{id:i,q:G===GAMES.sort?"Куда выбросить: "+q[0]+"?":q[0],o:ix.map(k=>o[k]),ix}});
 return{items,played:played(u,d.game)}},
gameSubmit(d){const u=who(d),G=GAMES[d.game];if(!G)throw"Неизвестная игра";
 const c=CacheService.getScriptCache(),k="gm_"+u.id+"_"+d.game,ids=JSON.parse(c.get(k)||"null");
 if(!ids)throw"Игра устарела — начните заново";c.remove(k);
 const ans=Array.isArray(d.answers)?d.answers:[];
 const results=ids.map(i=>{const q=G.q[i],right=gameRight(G,q),a=ans.find(x=>Number(x.id)===i);
  return{id:i,ok:!!a&&Number(a.a)===right,right,e:q[2]}});
 const score=results.filter(r=>r.ok).length,was=played(u,d.game),xp=was?0:score*G.per;
 if(xp)add("GamesPlayed",[u.id,today(),d.game]);  // попытка без правильных ответов не сгорает
 if(xp)upd("Users",u._row,"xp",Number(u.xp)+xp);
 return{score,total:ids.length,xp,results}}});

/* ───── ускорение: запросы на чтение не ждут общую очередь ───── */
// Раньше каждый запрос ждал, пока закончится предыдущий. Теперь очередь только у действий,
// которые меняют данные; чтения выполняются параллельно и читают каждый лист один раз.
const FAST={me:1,extra:1,avatars:1,friends:1,search:1,chats:1,chatMessages:1,chatSend:1,studentBadges:1};
const reply=o=>ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
try{doPost=function(e){
 let d,lock=null,orig=null;
 try{
  d=JSON.parse(e.postData.contents);
  if(!A[d.action])throw"Неизвестное действие";
  if(FAST[d.action]){try{const _rows=orig=rows,memo={};rows=n=>(memo[n]||(memo[n]=_rows(n))).slice()}catch(x){orig=null}}
  else{lock=LockService.getScriptLock();lock.waitLock(20000)}
  return reply(Object.assign({ok:true},A[d.action](d)));
 }catch(err){
  if(typeof err!=="string")console.error(err);
  return reply({ok:false,error:typeof err==="string"?err:"Ошибка сервера: "+err});
 }finally{if(orig)rows=orig;if(lock)try{lock.releaseLock()}catch(x){}}
}}catch(e){}
})();
