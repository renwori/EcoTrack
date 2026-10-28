// ЭкоТрек: учителя, классы, бейджи, аватарки, чаты, мини-игры и ускорение сервера.
// Дополнение к Code.gs - отдельный файл НИЖЕ Code.gs. После каждого обновления этого файла
// один раз запустить setupBadges() и развернуть новую версию. Код учителя: Настройки проекта -> Свойства скрипта -> TEACHER_CODE.
Object.assign(H,{Avatars:["userId","data","updated"],Classes:["teacherId","code","name"],
Members:["teacherId","studentId","created"],
Badges:["id","teacherId","studentId","emoji","color","title","description","created","seen"],
Messages:["id","chat","userId","type","text","media","created"],ChatReads:["userId","chat","ts"],
GamesPlayed:["userId","date","game"],DailyTasks:["userId","date","slot","taskId","done"],PlayDays:["userId","date"],
Events:["id","userId","type","emoji","text","created"],Reactions:["msgId","chat","userId","emoji"],
Profiles:["userId","cover","pattern","frame","status","emoji","showcase"],
NewsSources:["name","url","filter","status","checked"]});
function setupBadges(){["Avatars","Classes","Members","Badges","Messages","ChatReads","GamesPlayed","DailyTasks","PlayDays","Events","Reactions","Profiles","NewsSources"].forEach(n=>{const s=SS().getSheetByName(n)||SS().insertSheet(n);
 s.getRange(1,1,s.getMaxRows(),H[n].length).setNumberFormat("@");
 s.getRange(1,1,1,H[n].length).setValues([H[n]]);s.setFrozenRows(1)})}

// Новости: запустите ecoCheckNews(), чтобы сразу скачать ленту и увидеть в листе NewsSources, какие источники работают.
var ecoNewsRefresh_=null;
function ecoCheckNews(){const n=ecoNewsRefresh_(true);console.log("Загружено новостей: "+n.length+". Статус каждого источника - в листе NewsSources.")}

// Всё остальное - внутри замкнутой области, чтобы имена не конфликтовали с Code.gs.
(function(){
const DEV_NAME="renwori";
const COLORS=["green","blue","purple","orange","pink","gold"];
const AV_MAX=48000;
const now=()=>new Date().toISOString();
const today=()=>Utilities.formatDate(new Date(),"Europe/Moscow","yyyy-MM-dd");
const byId=id=>rows("Users").find(u=>u.id===id);
const byName=un=>rows("Users").find(u=>u.username===String(un||"").toLowerCase().replace(/^@/,""));
const delRows=(n,list)=>{const sh=SS().getSheetByName(n);list.map(r=>r._row).sort((a,b)=>b-a).forEach(r=>sh.deleteRow(r))};

// Надёжность: недостающие листы создаются сами; новые строки пишутся как текст (Таблица не превращает
// «2026-10-28» в дату, а «=...» в формулу); даты, которые Таблица всё же переделала, читаются правильно.
const MY=["Avatars","Classes","Members","Badges","Messages","ChatReads","GamesPlayed","DailyTasks","PlayDays","Events","Reactions","Profiles","NewsSources"];
const ensured={};
function ensure(n){if(ensured[n]||MY.indexOf(n)<0)return;
 if(!SS().getSheetByName(n)){const s=SS().insertSheet(n);s.getRange(1,1,s.getMaxRows(),H[n].length).setNumberFormat("@");
  s.getRange(1,1,1,H[n].length).setValues([H[n]]);s.setFrozenRows(1)}ensured[n]=1}
const DRE=/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}:\d{2}/;
let TZ=null;const tz=()=>TZ||(TZ=SS().getSpreadsheetTimeZone()||"Europe/Moscow");
const fixD=(k,v)=>DRE.test(v)?(k==="date"?Utilities.formatDate(new Date(v),tz(),"yyyy-MM-dd"):new Date(v).toISOString()):v;
try{const _r0=rows;rows=function(n){ensure(n);const a=_r0(n);
 if(MY.indexOf(n)>=0)a.forEach(o=>{if("date" in o)o.date=fixD("date",o.date);if("created" in o)o.created=fixD("created",o.created);if("updated" in o)o.updated=fixD("updated",o.updated)});
 return a}}catch(e){}
const rowsRaw=rows;  // чтение без кэша запроса
let held=false;      // держит ли этот запрос общую блокировку
function withLock(f){if(held)return f();const L=LockService.getScriptLock();L.waitLock(15000);held=true;try{return f()}finally{held=false;try{L.releaseLock()}catch(x){}}}
function addT(n,a){ensure(n);withLock(()=>{const sh=SS().getSheetByName(n),r=sh.getLastRow()+1;
 if(r>sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),200);
 sh.getRange(r,1,1,a.length).setNumberFormat("@").setValues([a.map(String)])})}
function setRow(n,row,a){SS().getSheetByName(n).getRange(row,1,1,a.length).setNumberFormat("@").setValues([a.map(String)])}

// Разработчик: аккаунт, который первым был замечен с юзернеймом renwori. Дальше узнаётся по id,
// поэтому смена юзернейма ничего не ломает и никто другой не сможет «занять» эту роль.
let devId;
function isDev(u){
 if(devId===undefined){const p=PropertiesService.getScriptProperties();devId=p.getProperty("DEV_ID")||"";
  if(!devId){const r=rows("Users").find(x=>x.username===DEV_NAME);if(r){devId=r.id;p.setProperty("DEV_ID",devId)}}}
 return!!u&&!!devId&&u.id===devId}
const isStaff=u=>u.role==="teacher"||u.role==="admin"||isDev(u);
try{const _pub=pub;pub=function(u){const o=_pub(u);if(isDev(u))o.dev=true;const c=custOf(u.id);if(c)o.cust=c;return o}}catch(e){}

/* ───── оформление профиля ───── */
const COVERS=["default","forest","ocean","sunset","aurora","meadow","night","berry"];
const PATTERNS=["none","leaves","waves","stars","dots"];
const P_EMOJI=["","🌱","🌳","🌍","♻️","💧","🌊","🔥","🐝","🦋","🐢","🌻","🍀","🌈","⭐","🐼","🦊","🐳"];
const FRAMES={none:()=>true,leaf:()=>true,ocean:x=>x.lv>=3,fire:x=>x.best>=7,rainbow:x=>x.lv>=5,medal:x=>x.badges>=3,gold:x=>x.lv>=10,dev:x=>x.dev};
let CU=null;
function custOf(uid){if(!CU){CU={};const bs=rows("Badges");rows("Profiles").forEach(p=>{let sc=[];try{sc=JSON.parse(p.showcase||"[]")}catch(e){}
  CU[p.userId]={cover:p.cover,pattern:p.pattern,frame:p.frame,status:p.status,emoji:p.emoji,
   sc:sc.map(id=>bs.find(b=>b.id===id&&b.studentId===p.userId)).filter(Boolean).map(b=>({id:b.id,emoji:b.emoji,color:b.color,title:b.title}))}})}
 return CU[uid]||null}
function bestStreak(uid,pd){const ds=pd.filter(r=>r.userId===uid).map(r=>r.date).sort();let best=0,run=0,prev=null;
 ds.forEach(d=>{if(d===prev)return;run=prev&&dayShift(prev,1)===d?run+1:1;best=Math.max(best,run);prev=d});return best}

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
 if(!c){addT("Classes",[t.id,newCode(),"Мой класс"]);c=rows("Classes").find(x=>x.teacherId===t.id)}return c}
const isMember=(tid,sid)=>rows("Members").some(m=>m.teacherId===tid&&m.studentId===sid);
function badgeOut(b,users){const t=users.find(u=>u.id===b.teacherId);
 return{id:b.id,emoji:b.emoji,color:b.color,title:b.title,description:b.description,created:b.created,seen:b.seen==="1",
  from:t?{username:t.username,firstName:t.firstName,lastName:t.lastName,dev:isDev(t)}:null}}
const sortNew=(a,b)=>a.created<b.created?1:-1;
function studentOf(t,username){const s=byName(username);if(!s)throw"Пользователь не найден";
 if(isDev(t))return s;if(!isMember(t.id,s.id))throw"Этого ученика нет в вашем классе";return s}

/* ───── чаты ───── */
const mini=u=>{if(!u)return{username:"",firstName:"?",lastName:""};const c=custOf(u.id)||{};
 return{username:u.username,firstName:u.firstName,lastName:u.lastName,dev:isDev(u),emoji:c.emoji||"",frame:c.frame||"",sc:c.sc||[]}};
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
 if(r)upd("ChatReads",r._row,"ts",Date.now());else addT("ChatReads",[u.id,chat,Date.now()])}

/* ───── мини-игры ───── */
const BINS=["Бумага","Пластик","Стекло","Металл","Опасные отходы"];
const GAMES={
 sort:{per:2,fixed:true,q:[
  ["Газета",0,"Газеты - это бумага, их сдают в макулатуру."],["Картонная коробка",0,"Картон перерабатывают вместе с бумагой. Сложите коробку, чтобы она занимала меньше места."],
  ["Старая тетрадь",0,"Тетради - бумага, скрепки лучше снять."],["Пластиковая бутылка",1,"ПЭТ-бутылка - пластик. Сомните её и закрутите крышку."],
  ["Бутылка от шампуня",1,"Флаконы от шампуня делают из пластика - их можно переработать."],["Пластиковый стаканчик от йогурта",1,"Стаканчик - пластик, только сполосните его."],
  ["Стеклянная банка",2,"Стеклянные банки перерабатывают много раз без потери качества."],["Стеклянная бутылка от сока",2,"Стеклянные бутылки идут в контейнер для стекла."],
  ["Консервная банка",3,"Консервные банки из жести - это металл."],["Алюминиевая банка от напитка",3,"Алюминий перерабатывается почти бесконечно."],
  ["Металлическая крышка от банки",3,"Крышки делают из металла - отправляйте их к металлу."],["Батарейка",4,"Батарейки содержат вредные вещества. Их сдают в специальные пункты приёма."],
  ["Ртутный градусник",4,"Ртуть очень опасна - градусник сдают как опасные отходы."],["Энергосберегающая лампа",4,"В таких лампах есть ртуть, их нельзя выбрасывать в обычный мусор."],
  ["Старый телефон",4,"В электронике есть вредные вещества - её сдают в пункты приёма техники."],
  ["Коробка из-под хлопьев",0,"Тонкий картон от коробок сдают вместе с бумагой."],["Журнал",0,"Журналы и брошюры - это бумага."],
  ["Бумажный пакет",0,"Чистый бумажный пакет можно сдать в макулатуру."],["Втулка от туалетной бумаги",0,"Втулка сделана из картона - это бумага."],
  ["Крышка от пластиковой бутылки",1,"Крышки делают из пластика, их тоже перерабатывают."],["Пластиковый контейнер от еды",1,"Чистый контейнер - это пластик. Сполосни его перед сдачей."],
  ["Пластиковая бутылка от молока",1,"Бутылки от молока делают из пластика."],["Стеклянная бутылка от лимонада",2,"Стеклянные бутылки сдают в контейнер для стекла."],
  ["Банка от варенья",2,"Банку сдают в стекло, а металлическую крышку - к металлу."],["Чистая фольга",3,"Алюминиевая фольга - это металл."],
  ["Банка от сгущёнки",3,"Жестяные банки сдают вместе с металлом."],["Сломанные наушники",4,"Электронику сдают в пункты приёма техники."],
  ["Аккумулятор от игрушки",4,"Аккумуляторы, как и батарейки, сдают в специальные пункты."],["Просроченные лекарства",4,"Лекарства нельзя выбрасывать в обычный мусор - их принимают в специальных пунктах."],
  ["Банка с остатками краски",4,"Краска относится к опасным отходам."]]},
 quiz:{per:3,q:[
  ["Что деревья поглощают из воздуха при фотосинтезе?",["Углекислый газ","Только азот","Пыль","Метан"],"Деревья поглощают углекислый газ и выделяют кислород."],
  ["Сколько лет может разлагаться пластиковая бутылка?",["Сотни лет","Один год","10 дней","5 лет"],"Пластик разлагается сотни лет, поэтому его важно перерабатывать."],
  ["Какой источник энергии возобновляемый?",["Солнечный свет","Уголь","Нефть","Природный газ"],"Солнце светит постоянно, а запасы угля, нефти и газа заканчиваются."],
  ["Что лучше всего помогает сократить мусор?",["Многоразовые вещи","Одноразовая посуда","Новый пакет на каждую покупку","Выбрасывать всё в одну урну"],"Многоразовые бутылки, сумки и контейнеры заменяют сотни одноразовых вещей."],
  ["Какой газ люди выбрасывают больше всего, усиливая парниковый эффект?",["Углекислый газ","Кислород","Гелий","Аргон"],"Углекислый газ появляется при сжигании топлива и удерживает тепло в атмосфере."],
  ["Какая часть воды на Земле пресная?",["Около 3%","Около 50%","Около 90%","Вся вода пресная"],"Почти вся вода на Земле солёная, пресной - всего около 3%."],
  ["Что означает знак ♻️ на упаковке?",["Материал можно переработать","Упаковка съедобна","Товар из другой страны","Упаковку нельзя выбрасывать"],"Знак из трёх стрелок говорит, что упаковку можно переработать."],
  ["Куда правильно выбрасывать батарейки?",["В специальный пункт приёма","В обычную урну","В раковину","Закопать в землю"],"Пункты приёма батареек есть во многих магазинах и школах."],
  ["Какое животное опыляет растения?",["Пчела","Акула","Крот","Кит"],"Пчёлы переносят пыльцу с цветка на цветок, и появляются плоды."],
  ["Что помогает экономить электричество?",["Выключать свет, уходя","Оставлять зарядку в розетке","Надолго открывать холодильник","Включать все лампы днём"],"Выключенный свет - самый простой способ сберечь энергию."],
  ["Из чего делают бумагу?",["Из древесины","Из нефти","Из песка","Из металла"],"Бумагу делают из древесины, поэтому сдавать макулатуру - значит беречь деревья."],
  ["Из чего делают стекло?",["Из песка","Из дерева","Из нефти","Из хлопка"],"Основа стекла - песок, его плавят при очень высокой температуре."],
  ["Как называется хвойный лес на севере России?",["Тайга","Саванна","Джунгли","Прерия"],"Тайга - самый большой лесной пояс на планете."],
  ["Какой транспорт меньше всего загрязняет воздух?",["Велосипед","Грузовик","Самолёт","Мотоцикл"],"Велосипед совсем не выбрасывает вредных газов."],
  ["Что такое компост?",["Удобрение из растительных отходов","Вид пластика","Морская водоросль","Ядовитый газ"],"Из очисток и листьев получается полезное удобрение для растений."],
  ["Сколько может разлагаться стеклянная бутылка?",["Больше тысячи лет","Месяц","Год","10 лет"],"Стекло в природе почти не разлагается - поэтому его важно сдавать в переработку."],
  ["Какое животное занесено в Красную книгу России?",["Амурский тигр","Домашняя кошка","Воробей","Голубь"],"Амурских тигров осталось мало, их охраняют."],
  ["Что такое переработка отходов?",["Превращение отходов в новые вещи","Сжигание мусора","Закапывание мусора","Покупка новых вещей"],"При переработке из старых вещей делают сырьё для новых."],
  ["Что вырабатывает электричество из ветра?",["Ветрогенератор","Угольная станция","Дизельный генератор","Газовая плита"],"Ветрогенератор крутится от ветра и не сжигает топливо."],
  ["Почему нельзя оставлять мусор в лесу?",["Он вредит животным и растениям","Он быстро исчезает","Лесу нужен мусор","Так лес становится чище"],"Животные путаются в пакетах и глотают пластик."],
  ["Что делают из переработанных пластиковых бутылок?",["Ткань для одежды","Стеклянные банки","Бумагу","Батарейки"],"Из переработанного пластика делают волокно для одежды и ковров."],
  ["Какое хвойное дерево сбрасывает хвою на зиму?",["Лиственница","Ель","Сосна","Кедр"],"Лиственница - хвойное дерево, которое каждую осень сбрасывает хвою."],
  ["Как называют дымку загрязнённого воздуха над городом?",["Смог","Туман","Радуга","Иней"],"Смог появляется из-за выхлопов машин и дыма заводов."],
  ["Что из этого - возобновляемый ресурс?",["Лес, если его восстанавливать","Нефть","Уголь","Природный газ"],"Лес может вырасти снова, а нефть и уголь - нет."],
  ["Кто помогает очищать воду в реках и озёрах?",["Моллюски и водные растения","Камни","Лодки","Рыбаки"],"Моллюски пропускают воду через себя и задерживают грязь."],
  ["Когда отмечают Международный день Земли?",["22 апреля","1 января","8 марта","1 сентября"],"День Земли отмечают 22 апреля во многих странах."],
  ["Что лучше сделать со старой одеждой?",["Отдать или сдать на переработку","Сжечь","Выбросить в лесу","Закопать"],"Одежда может ещё кому-то послужить или стать сырьём."],
  ["Какая лампа экономит больше всего энергии?",["Светодиодная","Лампа накаливания","Свеча","Факел"],"Светодиодные лампы тратят в несколько раз меньше электричества."],
  ["Зачем нужны заповедники?",["Чтобы охранять природу","Чтобы рубить лес","Чтобы строить заводы","Чтобы охотиться"],"В заповедниках природу оставляют нетронутой."],
  ["Что сильнее всего загрязняет воздух в больших городах?",["Выхлопы машин","Деревья","Велосипеды","Дождь"],"Выхлопные газы - главный источник загрязнения городского воздуха."]]},
 myth:{per:3,fixed:true,opts:["Правда","Миф"],q:[
  ["Алюминиевую банку можно перерабатывать почти бесконечно.",0,"Правда: алюминий почти не теряет свойств при переработке."],
  ["Пластиковый пакет разлагается за пару месяцев.",1,"Миф: пакету нужны сотни лет."],
  ["Одно дерево может быть домом для сотен видов насекомых.",0,"Правда: на старых деревьях живут сотни видов насекомых, птицы и грибы."],
  ["Зарядка в розетке без телефона совсем не тратит электричество.",1,"Миф: она всё равно понемногу потребляет энергию."],
  ["Батарейку можно выбросить в обычную урну - она безопасна.",1,"Миф: вещества из батарейки отравляют почву и воду."],
  ["Стекло можно перерабатывать много раз без потери качества.",0,"Правда: из старого стекла получается такое же новое."],
  ["Душ обычно расходует меньше воды, чем ванна.",0,"Правда: короткий душ требует в несколько раз меньше воды."],
  ["Бумагу можно перерабатывать бесконечно.",1,"Миф: волокна укорачиваются, бумагу перерабатывают примерно 5-7 раз."],
  ["Пчёлы важны для урожая многих фруктов и овощей.",0,"Правда: без опыления не будет яблок, огурцов и многих других плодов."],
  ["В океане мусор собирается в огромные «мусорные пятна».",0,"Правда: течения сносят пластик в огромные скопления."],
  ["Почти весь кислород на Земле производят деревья.",1,"Миф: больше половины кислорода дают морские водоросли и фитопланктон."],
  ["Телевизор, выдернутый из розетки, продолжает тратить электричество.",1,"Миф: без розетки прибор ничего не потребляет."],
  ["Энергосберегающие лампы нужно сдавать в пункты приёма.",0,"Правда: в них есть ртуть."],
  ["Магазинные чеки всегда можно сдать в макулатуру.",1,"Миф: чеки обычно печатают на термобумаге, её не перерабатывают."],
  ["Очистки от овощей и фруктов можно компостировать.",0,"Правда: из них получается отличное удобрение."],
  ["Пластиковые бутылки можно переработать.",0,"Правда: из них делают новое волокно и упаковку."],
  ["Если выбросить мусор в реку, он исчезнет.",1,"Миф: течение уносит мусор дальше, и он загрязняет моря."],
  ["Деревья помогают уменьшить шум в городе.",0,"Правда: зелёные насаждения поглощают часть шума."],
  ["Белые медведи живут в Антарктиде.",1,"Миф: белые медведи живут в Арктике, на севере планеты."],
  ["Пчёлы - единственные опылители растений.",1,"Миф: растения опыляют ещё шмели, бабочки, птицы и даже летучие мыши."],
  ["Светодиодные лампы служат дольше обычных.",0,"Правда: они работают в десятки раз дольше ламп накаливания."],
  ["Потепление климата значит, что каждый день будет жарко.",1,"Миф: меняется климат в целом, а погода может быть и холодной."],
  ["Мидии очищают воду.",0,"Правда: мидии фильтруют воду, пропуская через себя десятки литров в сутки."],
  ["Жир можно спокойно выливать в раковину.",1,"Миф: жир застывает в трубах и загрязняет воду."],
  ["Большинство лесных пожаров возникает по вине людей.",0,"Правда: чаще всего виноваты непотушенные костры и окурки."],
  ["Перерабатывать можно только новые вещи.",1,"Миф: перерабатывают как раз использованные вещи."],
  ["Летучие мыши помогают бороться с комарами.",0,"Правда: за ночь летучая мышь может съесть сотни насекомых."],
  ["Стеклянную банку перед сдачей стоит сполоснуть.",0,"Правда: чистое вторсырьё легче переработать."],
  ["Мох растёт только с северной стороны деревьев.",1,"Миф: мох растёт там, где влажно и тенисто, - с любой стороны."],
  ["Электричество из розетки никак не влияет на природу.",1,"Миф: большую часть электричества получают на станциях, которые влияют на природу."]]},
 act:{per:3,q:[
  ["На улице лежит использованная батарейка. Как поступить?",["Взять и сдать в пункт приёма","Выкинуть в ближайшую урну","Оставить на месте"],"Батарейка в урне или на земле отравляет почву. Лучше донести её до пункта приёма."],
  ["Ты идёшь в магазин за хлебом. Что взять с собой?",["Свою сумку","Ничего - купишь пакет","Два пакета на всякий случай"],"Своя сумка заменяет сотни одноразовых пакетов."],
  ["После пикника остался мусор, а урна далеко. Что делать?",["Собрать мусор и донести до урны","Спрятать под кустом","Сжечь в костре"],"Сжигать пластик опасно, а мусор под кустом вредит животным."],
  ["В комнате никого нет, а свет горит. Как поступить?",["Выключить свет","Оставить - вдруг кто-то вернётся","Включить ещё и телевизор"],"Выключенный свет - самый простой способ сберечь энергию."],
  ["У тебя есть старые, но целые игрушки. Что с ними сделать?",["Отдать тем, кому они нужны","Выбросить в мусор","Сломать"],"Вещи, которые служат дольше, - это меньше мусора."],
  ["Друг хочет бросить пластиковую бутылку на газон. Что сделать?",["Предложить донести её до контейнера для пластика","Промолчать","Тоже бросить свою"],"Вежливо подсказать другу - это тоже забота о природе."],
  ["Ты чистишь зубы. Что делать с водой?",["Закрыть кран, пока чистишь","Пусть течёт","Открыть посильнее"],"Закрытый кран экономит несколько литров воды каждый раз."],
  ["До школы 10 минут пешком. Как лучше добраться?",["Пешком или на велосипеде","Попросить отвезти на машине","Вызвать такси"],"Пешая прогулка не загрязняет воздух и полезна для здоровья."],
  ["В парке на земле сидит птенец. Как поступить?",["Не трогать и понаблюдать издалека - родители рядом","Забрать домой","Унести в коробке"],"Слётков обычно кормят родители. Человек может им только помешать."],
  ["Ты покупаешь напиток. Что выбрать?",["Без трубочки или со своей многоразовой","Взять три трубочки","Взять трубочку и сразу выбросить"],"Одноразовые трубочки часто попадают в моря и вредят животным."],
  ["На кухне остались очистки от овощей. Что с ними сделать?",["Отправить в компост, если он есть","Выбросить в реку","Сжечь"],"Из очисток получается полезное удобрение."],
  ["После урока работают проектор и компьютер. Что сделать?",["Выключить, если они больше не нужны","Оставить до завтра","Не обращать внимания"],"Техника в режиме ожидания тоже тратит электричество."],
  ["Старая футболка ещё хорошая, но хочется новую. Как поступить?",["Носить старую, пока она в порядке","Выбросить старую сразу","Купить сразу пять новых"],"На производство одежды уходит много воды и энергии."],
  ["В школе из крана капает вода. Что сделать?",["Сказать взрослым, чтобы починили","Ничего","Открыть кран сильнее"],"Из капающего крана за день утекает много воды."],
  ["Тебе дали ненужную листовку. Что с ней сделать?",["Сдать в макулатуру","Бросить на землю","Сжечь"],"Бумага может стать новой бумагой, если её сдать."],
  ["Зимой птицам голодно. Как им помочь?",["Сделать кормушку с несолёными семечками","Покормить чипсами","Бросить заплесневелый хлеб"],"Солёное и испорченное птицам вредно, а несолёные семечки - в самый раз."],
  ["Как принести обед в школу?",["В многоразовом контейнере","В трёх пакетах","В одноразовой посуде"],"Многоразовый контейнер служит годами и не становится мусором."],
  ["Погода сухая и ветреная, а хочется развести костёр в лесу. Как поступить?",["Не разводить костёр","Развести побольше","Оставить костёр без присмотра"],"В сухую погоду от одной искры может начаться лесной пожар."]]},
 decay:{per:1,order:true,items:[
  ["Бумажное полотенце","🧻",21,"2-4 недели"],["Газета","📰",42,"около 6 недель"],["Огрызок яблока","🍎",60,"около 2 месяцев"],
  ["Пакет от молока","🥛",90,"около 3 месяцев"],["Шерстяная варежка","🧤",365,"около года"],["Фанера","🪵",730,"1-3 года"],
  ["Крашеная деревянная палочка","🥢",4745,"около 13 лет"],["Пластиковый пакет","🛍️",5475,"10-20 лет"],["Консервная банка","🥫",18250,"около 50 лет"],
  ["Алюминиевая банка","🥤",73000,"около 200 лет"],["Пластиковое кольцо от упаковки банок","⭕",146000,"около 400 лет"],
  ["Пластиковая бутылка","🧴",164250,"около 450 лет"],["Рыболовная леска","🎣",219000,"около 600 лет"]]}};
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const gameRight=(G,q)=>G.opts||G===GAMES.sort?q[1]:0;
// «Что дольше разлагается»: 3 раунда по 4 предмета, сроки в раунде заметно различаются
function decayRounds(){const it=GAMES.decay.items,rounds=[];
 for(let r=0;r<3;r++){let pick=[];
  for(let tries=0;tries<200&&pick.length<4;tries++){pick=[];shuffle(it.map((x,i)=>i)).forEach(i=>{if(pick.length<4&&pick.every(j=>Math.max(it[i][2],it[j][2])/Math.min(it[i][2],it[j][2])>=1.5))pick.push(i)})}
  rounds.push(pick)}
 return rounds}
const played=(u,g)=>rows("GamesPlayed").some(r=>r.userId===u.id&&r.date===today()&&r.game===g);

/* ───── задания дня, серия дней, лента, эко-сад, счётчик пользы ───── */
// imp - примерная польза от задания: вода (л), пластик (шт.), макулатура (кг), CO2 (кг), электричество (кВт·ч).
const TASKS=[
 {id:1,title:"Разделить мусор",description:"Отдели бумагу и пластик перед тем, как выбросить.",icon:"♻️",xp:10,imp:{plastic:2}},
 {id:2,title:"Своя бутылка",description:"Возьми многоразовую бутылку вместо одноразовой.",icon:"💧",xp:10,imp:{plastic:1}},
 {id:3,title:"Свет выключен",description:"Выключи свет в комнатах, где никого нет.",icon:"💡",xp:5,imp:{energy:0.1}},
 {id:4,title:"Пешком",description:"Пройди небольшое расстояние пешком, если это безопасно.",icon:"🚶",xp:10,imp:{co2:0.2}},
 {id:5,title:"Макулатура",description:"Собери старые тетради и газеты для сдачи.",icon:"📰",xp:15,imp:{paper:1}},
 {id:6,title:"Батарейки",description:"Найди на эко-карте, где рядом с тобой принимают батарейки.",icon:"🔋",xp:10,imp:{},map:1},
 {id:7,title:"Эко-факт",description:"Расскажи другу один интересный экологический факт.",icon:"🌍",xp:5,imp:{}},
 {id:8,title:"Что перерабатывают",description:"Узнай, какие отходы можно сдать в твоём городе.",icon:"🔎",xp:10,imp:{},map:1},
 {id:9,title:"Быстрый душ",description:"Прими короткий душ вместо ванны.",icon:"🚿",xp:10,imp:{water:50}},
 {id:10,title:"Закрой кран",description:"Закрывай воду, пока чистишь зубы.",icon:"🚰",xp:5,imp:{water:10}},
 {id:11,title:"Своя сумка",description:"Возьми в магазин многоразовую сумку вместо пакета.",icon:"🛍️",xp:10,imp:{plastic:1}},
 {id:12,title:"Зарядки из розеток",description:"Выдерни из розеток зарядки, к которым ничего не подключено.",icon:"🔌",xp:5,imp:{energy:0.05}},
 {id:13,title:"Ничего не выбросить",description:"Доешь всё, что положил себе на тарелку.",icon:"🍎",xp:5,imp:{}},
 {id:14,title:"Полей растение",description:"Полей комнатное растение или цветы во дворе.",icon:"🪴",xp:5,imp:{}}];
const dayShift=(d,n)=>{const t=new Date(d+"T12:00:00Z");t.setUTCDate(t.getUTCDate()+n);return t.toISOString().slice(0,10)};
function streakOf(uid,pd){const s=new Set(pd.filter(r=>r.userId===uid).map(r=>r.date));let d=today();
 if(!s.has(d))d=dayShift(d,-1);let n=0;while(s.has(d)){n++;d=dayShift(d,-1)}return n}
const playedToday=(uid,pd)=>pd.some(r=>r.userId===uid&&r.date===today());
const plural=(n,a,b,c)=>{const m=n%10,h=n%100;return n+" "+(m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c)};
const STAGES=[[0,"Семечко"],[30,"Росток"],[100,"Саженец"],[250,"Молодое дерево"],[500,"Дерево"],[900,"Могучее дерево"]];
const stageOf=xp=>STAGES.filter(s=>xp>=s[0]).length-1;
function addEvent(uid,type,emoji,text){addT("Events",[Utilities.getUuid(),uid,type,emoji,text,now()])}
function giveXp(u,n){const old=Number(u.xp)||0,nw=old+n;upd("Users",u._row,"xp",nw);u.xp=String(nw);
 if(Math.floor(nw/100)>Math.floor(old/100))addEvent(u.id,"level","⭐","Достигнут "+(Math.floor(nw/100)+1)+" уровень");
 if(stageOf(nw)>stageOf(old))addEvent(u.id,"tree","🌳","Эко-сад вырос: "+STAGES[stageOf(nw)][1].toLowerCase())}
function impactOf(ids,dt){const o={water:0,plastic:0,paper:0,co2:0,energy:0};
 dt.forEach(r=>{if(r.done==="1"&&ids.has(r.userId)){const t=TASKS.find(x=>x.id==r.taskId);if(t)for(const k in t.imp)o[k]+=t.imp[k]}});
 for(const k in o)o[k]=Math.round(o[k]*100)/100;return o}
const eventsOf=uid=>rows("Events").filter(e=>e.userId===uid).sort((a,b)=>a.created<b.created?1:-1).slice(0,30)
 .map(e=>({type:e.type,emoji:e.emoji,text:e.text,created:e.created}));
function forestOf(t){const users=rows("Users"),pd=rows("PlayDays");
 const ms=rows("Members").filter(m=>m.teacherId===t.id).map(m=>users.find(u=>u.id===m.studentId)).filter(Boolean);
 return{trees:[t].concat(ms).map(u=>({user:mini(u),xp:Number(u.xp)||0,streak:streakOf(u.id,pd),teacher:u.id===t.id})),
  impact:impactOf(new Set([t.id].concat(ms.map(u=>u.id))),rows("DailyTasks"))}}

/* ───── реакции ───── */
const REACTS=["👍","❤️","😂","😮","😢","🔥","🌱"];
function reactsFor(chat,ids,u,list){const users=rows("Users"),o={},last={};
 (list||rows("Reactions")).forEach(r=>{if(r.chat===chat&&ids.has(r.msgId))last[r.msgId+"|"+r.userId]=r});
 Object.keys(last).forEach(k=>{const r=last[k];if(!r.emoji)return;const x=o[r.msgId]=o[r.msgId]||{},e=x[r.emoji]=x[r.emoji]||{n:0,mine:false,who:[]};
  e.n++;e.who.push(mini(users.find(z=>z.id===r.userId)));if(r.userId===u.id)e.mine=true});
 return o}

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
 const pd=rows("PlayDays");o.streak=streakOf(u.id,pd);o.playedToday=playedToday(u.id,pd);o.bestStreak=bestStreak(u.id,pd);
 o.impact=impactOf(new Set([u.id]),rows("DailyTasks"));o.events=eventsOf(u.id);
 return o},
profileSet(d){const u=who(d),c=custOf(u.id)||{},v={cover:c.cover||"default",pattern:c.pattern||"none",frame:c.frame||"none",status:c.status||"",emoji:c.emoji||"",showcase:(c.sc||[]).map(b=>b.id)};
 if(d.cover!==undefined){if(COVERS.indexOf(d.cover)<0)throw"Неизвестная обложка";v.cover=d.cover}
 if(d.pattern!==undefined){if(PATTERNS.indexOf(d.pattern)<0)throw"Неизвестный узор";v.pattern=d.pattern}
 if(d.emoji!==undefined){if(P_EMOJI.indexOf(d.emoji)<0)throw"Такого эмодзи нет в списке";v.emoji=d.emoji}
 if(d.status!==undefined){const st=String(d.status).trim();if(st.length>60)throw"Статус не длиннее 60 символов";v.status=st}
 if(d.frame!==undefined){const f=FRAMES[d.frame];if(!f)throw"Неизвестная рамка";
  const pd=rows("PlayDays"),xs={lv:Math.floor((Number(u.xp)||0)/100)+1,best:bestStreak(u.id,pd),badges:rows("Badges").filter(b=>b.studentId===u.id).length,dev:isDev(u)};
  if(!f(xs))throw"Эта рамка пока закрыта";v.frame=d.frame}
 if(d.showcase!==undefined){const ids=(Array.isArray(d.showcase)?d.showcase:[]).map(String).slice(0,3),own=rows("Badges").filter(b=>b.studentId===u.id).map(b=>b.id);
  if(ids.some(id=>own.indexOf(id)<0))throw"В витрину можно поставить только свои бейджи";v.showcase=ids}
 const row=[u.id,v.cover,v.pattern,v.frame,v.status,v.emoji,JSON.stringify(v.showcase)],old=rowsRaw("Profiles").find(p=>p.userId===u.id);
 if(old)setRow("Profiles",old._row,row);else addT("Profiles",row);
 CU=null;return{cust:custOf(u.id)}},
profile(d){const me_=who(d),t=byName(d.username);if(!t)throw"Пользователь не найден";
 const users=rows("Users"),av=rows("Avatars").find(a=>a.userId===t.id),pd=rows("PlayDays");
 return{user:pub(t),avatar:av?av.data:"",streak:streakOf(t.id,pd),bestStreak:bestStreak(t.id,pd),impact:impactOf(new Set([t.id]),rows("DailyTasks")),
  badges:rows("Badges").filter(b=>b.studentId===t.id).sort(sortNew).map(b=>badgeOut(b,users)),events:eventsOf(t.id),
  self:t.id===me_.id,friend:t.id!==me_.id&&(friendsOf(d).friends||[]).some(f=>f.username===t.username)}},
classForest(d){const u=who(d),t=byName(d.username),c=t&&rows("Classes").find(x=>x.teacherId===t.id);
 if(!c||(t.id!==u.id&&!isMember(t.id,u.id)))throw"Вы не состоите в этом классе";
 return Object.assign({name:c.name},forestOf(t))},
tasks(d){const u=who(d),date=today();let mine=rows("DailyTasks").filter(t=>t.userId===u.id&&t.date===date);
 if(!mine.length){mine=shuffle(TASKS).slice(0,3).map((t,i)=>({slot:String(i+1),taskId:String(t.id),done:""}));mine.forEach(r=>addT("DailyTasks",[u.id,date,r.slot,r.taskId,""]))}
 const seen={};mine=mine.filter(r=>!seen[r.slot]&&(seen[r.slot]=1));
 return{tasks:mine.map(r=>{const t=TASKS.find(x=>x.id==r.taskId)||TASKS[0];
  return{slot:Number(r.slot),done:r.done==="1",icon:t.icon,title:t.title,description:t.description,xp:t.xp,imp:t.imp,map:!!t.map}}).sort((a,b)=>a.slot-b.slot)}},
complete(d){const u=who(d),r=rows("DailyTasks").find(x=>x.userId===u.id&&x.date===today()&&x.slot==String(d.slot));
 if(!r||r.done==="1")return{gained:0};const t=TASKS.find(x=>x.id==r.taskId);upd("DailyTasks",r._row,"done","1");
 const xp=t?t.xp:0;if(xp)giveXp(u,xp);return{gained:xp}},
avatarSet(d){const u=who(d),data=String(d.data||""),old=rows("Avatars").find(a=>a.userId===u.id);
 if(data&&!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data))throw"Неверный формат картинки";
 if(data.length>AV_MAX)throw"Картинка слишком большая";
 if(!data){if(old)delRows("Avatars",[old]);return{avatar:""}}
 if(old){upd("Avatars",old._row,"data",data);upd("Avatars",old._row,"updated",now())}else addT("Avatars",[u.id,data,now()]);
 return{avatar:data}},
avatars(d){who(d);const want=(Array.isArray(d.usernames)?d.usernames:[]).slice(0,100).map(s=>String(s).toLowerCase());
 const users=rows("Users"),av=rows("Avatars"),map={};
 want.forEach(un=>{const u=users.find(x=>x.username===un),a=u&&av.find(x=>x.userId===u.id);map[un]=a?a.data:""});
 return{map}},
classInfo(d){const t=who(d);needTeacher(t);const c=classOf(t),users=rows("Users"),bs=rows("Badges");
 const students=rows("Members").filter(m=>m.teacherId===t.id).map(m=>users.find(u=>u.id===m.studentId)).filter(Boolean)
  .map(s=>Object.assign(pub(s),{badges:bs.filter(b=>b.studentId===s.id&&b.teacherId===t.id).length}))
  .sort((a,b)=>(a.lastName+a.firstName).localeCompare(b.lastName+b.firstName,"ru"));
 return Object.assign({code:c.code,name:c.name,students},forestOf(t))},
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
 addT("Members",[c.teacherId,u.id,now()]);const t=byId(c.teacherId);return{teacher:pub(t),className:c.name}},
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
 const id=Utilities.getUuid();addT("Badges",[id,t.id,s.id,emoji,d.color,title,desc,now(),""]);
 addEvent(s.id,"badge",emoji,"Получен бейдж «"+title+"»");
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
 const o={messages:fresh.map(m=>msgOut(m,u,users)),gone:all.filter(m=>m.type==="del").slice(-50).map(m=>m.id),
  reacts:reactsFor(c.id,new Set(all.slice(-200).map(m=>m.id)),u)};
 if(!after){o.info=c.kind==="f"?{title:c.other.firstName+" "+c.other.lastName,user:pub(c.other)}
  :{title:c.cls.name,sub:"Учитель и "+rows("Members").filter(m=>m.teacherId===c.teacher.id).length+" учен.",teacher:c.teacher.username}}
 if(!after||fresh.some(m=>m.userId!==u.id))markRead(u,c.id);
 return o},
chatSend(d){const u=who(d),c=chatOf(u,d,d.chat),text=String(d.text||"").trim();
 if(!text)throw"Пустое сообщение";if(text.length>1000)throw"Сообщение не длиннее 1000 символов";spam(u);
 const m=[Utilities.getUuid(),c.id,u.id,"text",text,"",Date.now()];addT("Messages",m);
 return{message:msgOut({id:m[0],type:"text",text,created:String(m[6]),userId:u.id},u,[u])}},
chatReact(d){const u=who(d),c=chatOf(u,d,d.chat),id=String(d.id||""),e=String(d.emoji||"");
 if(REACTS.indexOf(e)<0)throw"Такой реакции нет";
 if(!msgTail(3000).some(x=>x.id===id&&x.chat===c.id&&x.type!=="del"))throw"Сообщение не найдено";
 const mine=rowsRaw("Reactions").filter(x=>x.msgId===id&&x.userId===u.id),r=mine[mine.length-1];
 if(r)upd("Reactions",r._row,"emoji",r.emoji===e?"":e);else addT("Reactions",[id,c.id,u.id,e]);
 return{reacts:reactsFor(c.id,new Set([id]),u,rowsRaw("Reactions"))[id]||{}}},
chatDelete(d){const u=who(d),c=chatOf(u,d,d.chat),m=msgTail(3000).find(x=>x.id===String(d.id||"")&&x.chat===c.id);
 if(!m||m.type==="del")throw"Сообщение не найдено";
 if(m.userId!==u.id&&!(c.kind==="c"&&(c.teacher.id===u.id||isDev(u))))throw"Можно удалить только своё сообщение";
 upd("Messages",m._row,"type","del");upd("Messages",m._row,"text","");return{}},

gameStart(d){const u=who(d),G=GAMES[d.game];if(!G)throw"Неизвестная игра";
 if(G.order){const rounds=decayRounds();CacheService.getScriptCache().put("gm_"+u.id+"_"+d.game,JSON.stringify(rounds),3600);
  return{kind:"order",rounds:rounds.map((r,k)=>({id:k,items:shuffle(r).map(i=>({k:i,name:G.items[i][0],icon:G.items[i][1]}))})),played:played(u,d.game)}}
 const picked=shuffle(G.q.map((q,i)=>i)).slice(0,5);
 CacheService.getScriptCache().put("gm_"+u.id+"_"+d.game,JSON.stringify(picked),3600);
 const items=picked.map(i=>{const q=G.q[i],o=G===GAMES.sort?BINS:G.opts||q[1],ix=G.fixed?o.map((x,k)=>k):shuffle(o.map((x,k)=>k));
  return{id:i,q:G===GAMES.sort?"Куда выбросить: "+q[0]+"?":q[0],o:ix.map(k=>o[k]),ix}});
 return{items,played:played(u,d.game)}},
gameSubmit(d){const u=who(d),G=GAMES[d.game];if(!G)throw"Неизвестная игра";
 const c=CacheService.getScriptCache(),k="gm_"+u.id+"_"+d.game,ids=JSON.parse(c.get(k)||"null");
 if(!ids)throw"Игра устарела - начните заново";c.remove(k);
 const ans=Array.isArray(d.answers)?d.answers:[];let results,score,total;
 if(G.order){results=ids.map((r,k)=>{const right=r.slice().sort((a,b)=>G.items[a][2]-G.items[b][2]),a=ans.find(x=>Number(x.id)===k),ord=a&&Array.isArray(a.order)?a.order.map(Number):[];
   const pos=right.filter((x,i)=>ord[i]===x).length;
   return{id:k,ok:pos===right.length,pos,order:ord,right:right.map(i=>({k:i,name:G.items[i][0],icon:G.items[i][1],time:G.items[i][3]}))}});
  score=results.reduce((s,r)=>s+r.pos,0);total=ids.length*4}
 else{results=ids.map(i=>{const q=G.q[i],right=gameRight(G,q),a=ans.find(x=>Number(x.id)===i);
   return{id:i,ok:!!a&&typeof a.a==="number"&&a.a===right,right,e:q[2]}});
  score=results.filter(r=>r.ok).length;total=ids.length}
 const was=played(u,d.game),xp=was?0:score*G.per;
 if(xp)addT("GamesPlayed",[u.id,today(),d.game]);  // попытка без правильных ответов не сгорает
 if(xp)giveXp(u,xp);
 // серия дней: засчитывается любая сыгранная мини-игра
 const pd=rows("PlayDays"),first=!playedToday(u.id,pd);if(first)addT("PlayDays",[u.id,today()]);
 const streak=streakOf(u.id,rows("PlayDays"));
 if(first&&[3,7,14,30,50,100,200,365].indexOf(streak)>=0)addEvent(u.id,"streak","🔥",plural(streak,"день","дня","дней")+" подряд в мини-играх");
 return{score,total,xp,results,streak,newDay:first}}});

/* ───── новости об экологии из RSS ───── */
// Источники - в листе NewsSources (название, адрес RSS, фильтр «да»/«нет»). Их можно менять прямо в Таблице.
// Фильтр «да» пропускает только новости про природу - нужен для общих научных и новостных лент.
// Адреса ниже - стартовый список; работают ли они, сервер пишет в колонку status.
const NEWS_SEED=[["N+1","https://nplus1.ru/rss","да"],["Naked Science","https://naked-science.ru/feed","да"],
 ["РИА Новости: Наука","https://ria.ru/export/rss2/science/index.xml","да"],["ТАСС","https://tass.ru/rss/v2.xml","да"],
 ["Минприроды России","https://www.mnr.gov.ru/press/news/rss/","нет"]];
const ECO_RE=/эколог|климат|природ|отход|мусор|переработ|вторсыр|загрязн|выброс|заповедн|нацпарк|национальн\S* парк|красн\S* книг|вымира|редк\S* вид|биоразнообраз|экосистем|углекисл|парников|возобновля|пластик|животн|птиц|лесн|лесов|океан|пресн\S* вод|засух|ледник|наводнен|потеплен/i;
const unent=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]+>/g," ").replace(/&#x([0-9a-f]+);/gi,(m,h)=>String.fromCharCode(parseInt(h,16)))
 .replace(/&#(\d+);/g,(m,d)=>String.fromCharCode(+d)).replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">")
 .replace(/&nbsp;/g," ").replace(/&laquo;/g,"«").replace(/&raquo;/g,"»").replace(/&mdash;|&ndash;/g,"-").replace(/&amp;/g,"&").replace(/[—–]/g,"-").replace(/\s+/g," ").trim();
// RSS 2.0 и Atom; разбор без строгого XML, чтобы не падать на чуть «кривых» лентах
function parseFeed(xml){const out=[];
 (xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g)||[]).forEach(b=>{
  const tag=n=>{const m=b.match(new RegExp("<"+n+"(?:\\s[^>]*)?>([\\s\\S]*?)</"+n+">","i"));return m?unent(m[1]):""};
  let link=tag("link");if(!/^https?:\/\//.test(link)){const m=b.match(/<link[^>]*href=["']([^"']+)["']/i);link=m?unent(m[1]):""}
  if(!/^https?:\/\//.test(link)){const g=tag("guid");link=/^https?:\/\//.test(g)?g:""}
  const d=new Date(tag("pubDate")||tag("published")||tag("updated")||tag("dc:date")),title=tag("title");
  if(title&&link)out.push({title:title.slice(0,200),url:link,published:isNaN(d)?"":d.toISOString(),text:(tag("description")||tag("summary")).slice(0,500)})});
 return out}
function newsRefresh(force){const c=CacheService.getScriptCache(),hit=c.get("eco_news");
 if(hit&&!force)return JSON.parse(hit);
 if(!force&&c.get("eco_news_busy")){const old=c.get("eco_news_old");return old?JSON.parse(old):[]}
 c.put("eco_news_busy","1",90);
 let src=rows("NewsSources");if(!src.length){NEWS_SEED.forEach(x=>addT("NewsSources",[x[0],x[1],x[2],"",""]));src=rowsRaw("NewsSources")}
 let all=[];
 src.filter(x=>/^https?:\/\//.test(x.url)).forEach(x=>{let st;
  try{const r=UrlFetchApp.fetch(x.url,{muteHttpExceptions:true,followRedirects:true}),code=r.getResponseCode();
   if(code!==200)st="не работает: сайт ответил кодом "+code;
   else{const items=parseFeed(r.getContentText()),eco=/^да/i.test(x.filter)?items.filter(i=>ECO_RE.test(i.title+" "+i.text)):items;
    eco.forEach(i=>all.push({title:i.title,url:i.url,source:x.name,published:i.published}));
    st=items.length?"работает: "+plural(items.length,"новость","новости","новостей")+", про экологию "+eco.length:"не работает: по адресу нет RSS"}}
  catch(e){st="не работает: "+String(e).slice(0,100)}
  try{upd("NewsSources",x._row,"status",st);upd("NewsSources",x._row,"checked",now())}catch(e){}});
 const seen={};all=all.filter(n=>!seen[n.url]&&(seen[n.url]=1)).sort((a,b)=>(b.published||"").localeCompare(a.published||"")).slice(0,40);
 const js=JSON.stringify(all);c.put("eco_news",js,3600);c.put("eco_news_old",js,21600);c.remove("eco_news_busy");return all}
ecoNewsRefresh_=newsRefresh;
A.news=d=>{who(d);return{news:newsRefresh(false)}};

/* ───── ускорение: запросы на чтение не ждут общую очередь ───── */
// Раньше каждый запрос ждал, пока закончится предыдущий. Теперь очередь только у действий,
// которые меняют данные; чтения выполняются параллельно и читают каждый лист один раз.
const FAST={news:1,me:1,extra:1,avatars:1,friends:1,search:1,chats:1,chatMessages:1,chatSend:1,chatReact:1,chatDelete:1,studentBadges:1,profile:1,classForest:1};
const reply=o=>ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
try{doPost=function(e){
 let d,lock=null,orig=null;
 try{
  d=JSON.parse(e.postData.contents);devId=undefined;CU=null;held=false;
  if(!A[d.action])throw"Неизвестное действие";
  if(FAST[d.action]){try{const _rows=orig=rows,memo={};rows=n=>(memo[n]||(memo[n]=_rows(n))).slice()}catch(x){orig=null}}
  else{lock=LockService.getScriptLock();lock.waitLock(20000);held=true}
  return reply(Object.assign({ok:true},A[d.action](d)));
 }catch(err){
  if(typeof err!=="string")console.error(err);
  return reply({ok:false,error:typeof err==="string"?err:"Ошибка сервера: "+err});
 }finally{if(orig)rows=orig;if(lock)try{lock.releaseLock()}catch(x){}}
}}catch(e){}
})();
