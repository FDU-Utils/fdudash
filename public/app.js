import {renderCourseCards} from './course-cards.js';
import {layoutWeek,teachingWeek,weekRange} from './schedule.js';
let csrf='',authenticated=false,bundle=null,items=[],busy=false,hasSaved=false,elearningAttempted=false,activePage=location.hash==='#elearning'?'elearning':'timetable';
const $=id=>document.getElementById(id),form=$('login'),status=$('status');
function message(text){status.textContent=text;}
function controls(){for(const e of form.elements)e.disabled=busy||authenticated;$('semester').disabled=busy||!bundle;$('refresh').disabled=busy||!authenticated;$('logout').hidden=!authenticated&&!hasSaved;$('logout').disabled=busy;$('connect-elearning').disabled=busy||!authenticated;$('login-panel').hidden=authenticated;}
async function api(path,method='GET',data){const res=await fetch(`/api/${path}`,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:data?JSON.stringify(data):undefined});const result=await res.json();if(!res.ok)throw Error(result.message||'请求失败');return result;}
async function task(fn){if(busy)return;busy=true;controls();try{await fn();}catch(e){message(e.message);}finally{busy=false;controls();maybeLoadElearning();}}
function showBundle(value){bundle=value;$('semester').replaceChildren(...value.semesters.map(s=>new Option(s.name,s.id)));$('semester').value=value.defaultId;items=[];render();}
const slots=[['08:00','08:45'],['08:55','09:40'],['09:55','10:40'],['10:50','11:35'],['11:45','12:30'],['13:30','14:15'],['14:25','15:10'],['15:25','16:10'],['16:20','17:05'],['17:15','18:00'],['18:30','19:15'],['19:25','20:10'],['20:20','21:05'],['21:15','22:00']];
function node(tag,className,text){const e=document.createElement(tag);e.className=className;if(text!==undefined)e.textContent=text;return e;}
function render(){
 const week=Number($('week').value),grid=$('grid'),days=['周一','周二','周三','周四','周五','周六','周日'];grid.replaceChildren();grid.append(node('div','corner','节次'));
 days.forEach((name,i)=>{const header=node('div','day-heading',name);header.style.gridColumn=String(i+2);header.style.gridRow='1';grid.append(header);});
 slots.forEach((times,i)=>{const label=node('div','slot-label');label.style.gridColumn='1';label.style.gridRow=String(i+2);label.append(node('strong','',String(i+1)),node('small','',times[0]),node('small','',times[1]));grid.append(label);for(let day=1;day<=7;day++){const cell=node('div','slot-cell');cell.style.gridColumn=String(day+1);cell.style.gridRow=String(i+2);grid.append(cell);}});
 const visible=layoutWeek(items,week).filter(c=>c.start<=slots.length);
 for(const course of visible){const card=node('article','course');card.style.gridColumn=String(course.day+1);card.style.gridRow=`${course.start+1} / ${Math.min(course.end,slots.length)+2}`;
 card.style.width=`calc(${100/course.lanes}% - 6px)`;card.style.marginLeft=`calc(${course.lane*100/course.lanes}% + 3px)`;
 card.append(node('strong','course-name',course.name));for(const text of [course.room,`${slots[course.start-1]?.[0]||'?'}–${slots[Math.min(course.end,slots.length)-1]?.[1]||'?'}`,`第 ${course.start}–${course.end} 节`,course.teachers.join(' / '),...(course.rooms?.length>1?['教务返回多个教室']:[]),...(course.lanes>1?['同时段安排，请核实']:[])])card.append(node('small','',text));grid.append(card);}
 const semester=bundle?.semesters.find(s=>s.id===$('semester').value),range=weekRange(semester?.startDate,week);
 $('week-summary').textContent=`第 ${week} 周${range?' · '+range.join(' — '):' · 开学日期未知'} · ${visible.length?visible.length+' 条安排':'本周暂无课程'}${visible.some(c=>c.lanes>1)?' · 冲突课程已并排显示':''}`;
 $('prev-week').disabled=week<=1;$('next-week').disabled=week>=Number($('week').lastElementChild.value);
}
function configureWeeks(){const selected=Number($('week').value)||1;const max=Math.min(60,Math.max(20,...items.flatMap(c=>c.weeks)));$('week').replaceChildren(...Array.from({length:max},(_,i)=>new Option(`第 ${i+1} 周`,String(i+1))));$('week').value=String(Math.min(max,selected));}
function currentWeek(){configureWeeks();const s=bundle?.semesters.find(s=>s.id===$('semester').value);$('week').value=String(Math.max(1,Math.min(Number($('week').lastElementChild.value),teachingWeek(s?.startDate))));render();}
form.addEventListener('submit',event=>{event.preventDefault();task(async()=>{message('正在连接 UIS，请稍候；不会自动重试密码。');const data={username:form.elements.username.value.trim(),password:form.elements.password.value,remember:form.elements.remember.checked};form.elements.password.value='';let result;try{result=await api('login','POST',data);}finally{data.password='';}authenticated=true;hasSaved=data.remember;showBundle(result);currentWeek();message('UIS 已连接，正在读取课表…');const table=await api(`timetable?semester=${encodeURIComponent($('semester').value)}`);items=table.courses;configureWeeks();render();message(result.warning||'已读取学期课表 · 下方仅显示所选教学周');});});
$('refresh').onclick=()=>task(async()=>{message('正在查询课表…');const table=await api(`timetable?semester=${encodeURIComponent($('semester').value)}`);items=table.courses;configureWeeks();render();message('已读取学期课表 · 下方仅显示所选教学周');});
$('semester').onchange=()=>{items=[];currentWeek();render();message('学期已切换，请查询课表。');};$('week').onchange=render;
$('prev-week').onclick=()=>{$('week').value=String(Number($('week').value)-1);render();};$('next-week').onclick=()=>{$('week').value=String(Number($('week').value)+1);render();};$('this-week').onclick=currentWeek;
$('logout').onclick=()=>task(async()=>{await api('logout','POST',{});authenticated=false;hasSaved=false;elearningAttempted=false;bundle=null;items=[];form.reset();$('elearning-courses').replaceChildren();$('elearning-status').textContent='已清除 eLearning 会话。';$('semester').replaceChildren(new Option('登录后选择学期',''));render();message('已清除本机校园会话和保存的账号。');});
function selectPage(){
 activePage=location.hash==='#elearning'?'elearning':'timetable';
 $('timetable-page').hidden=activePage!=='timetable';$('elearning-page').hidden=activePage!=='elearning';
 for(const page of ['timetable','elearning']){const link=$(`nav-${page}`);link.classList.toggle('active',page===activePage);if(page===activePage)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 maybeLoadElearning();
}
function maybeLoadElearning(){if(activePage==='elearning'&&authenticated&&!busy&&!elearningAttempted)task(loadElearning);}
function renderElearning(result){renderCourseCards($('elearning-courses'),result,{api,csrf:()=>csrf,status:$('elearning-status')});}
async function loadElearning(){
 elearningAttempted=true;$('elearning-status').textContent='正在读取课程、作业和开放的模块，请稍候…';$('elearning-courses').replaceChildren();
 try{renderElearning(await api('elearning','POST',{}));}catch(error){$('elearning-status').textContent=`读取失败：${error.message}。可点击刷新重试。`;}
}
$('connect-elearning').onclick=()=>task(loadElearning);
window.addEventListener('hashchange',selectPage);

render();
task(async()=>{const s=await api('session');csrf=s.csrf;authenticated=s.authenticated;hasSaved=s.hasSaved;
 if(authenticated||hasSaved){message(authenticated?'正在读取课表…':'正在解锁本机账号并连接 UIS…');const result=authenticated?await api('semesters'):await api('restore','POST',{});authenticated=true;showBundle(result);currentWeek();const table=await api(`timetable?semester=${encodeURIComponent($('semester').value)}`);items=table.courses;configureWeeks();render();message('已自动连接 · 下方仅显示所选教学周');}
});

selectPage();
