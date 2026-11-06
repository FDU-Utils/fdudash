import {layoutWeek,teachingWeek,weekRange} from './schedule.js';
let csrf='',authenticated=false,bundle=null,items=[],demo=false,busy=false,hasSaved=false,elearningAttempted=false,activePage=location.hash==='#elearning'?'elearning':'timetable';
const $=id=>document.getElementById(id),form=$('login'),status=$('status');
function message(text){status.textContent=text;}
function controls(){for(const e of form.elements)e.disabled=busy||authenticated;$('semester').disabled=busy||!bundle;$('refresh').disabled=busy||!authenticated||demo;$('demo').disabled=busy;$('logout').hidden=!authenticated&&!hasSaved;$('logout').disabled=busy;$('connect-elearning').disabled=busy||!authenticated;$('login-panel').hidden=authenticated;}
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
 $('week-summary').textContent=`${demo?'演示 · ':''}第 ${week} 周${range?' · '+range.join(' — '):' · 开学日期未知'} · ${visible.length?visible.length+' 条安排':'本周暂无课程'}${visible.some(c=>c.lanes>1)?' · 冲突课程已并排显示':''}`;
 $('prev-week').disabled=week<=1;$('next-week').disabled=week>=Number($('week').lastElementChild.value);
}
function configureWeeks(){const selected=Number($('week').value)||1;const max=Math.min(60,Math.max(20,...items.flatMap(c=>c.weeks)));$('week').replaceChildren(...Array.from({length:max},(_,i)=>new Option(`第 ${i+1} 周`,String(i+1))));$('week').value=String(Math.min(max,selected));}
function currentWeek(){configureWeeks();const s=bundle?.semesters.find(s=>s.id===$('semester').value);$('week').value=String(Math.max(1,Math.min(Number($('week').lastElementChild.value),teachingWeek(s?.startDate))));render();}
form.addEventListener('submit',event=>{event.preventDefault();task(async()=>{message('正在连接 UIS，请稍候；不会自动重试密码。');demo=false;const data={username:form.elements.username.value.trim(),password:form.elements.password.value,remember:form.elements.remember.checked};form.elements.password.value='';let result;try{result=await api('login','POST',data);}finally{data.password='';}authenticated=true;hasSaved=data.remember;showBundle(result);currentWeek();message('UIS 已连接，正在读取课表…');const table=await api(`timetable?semester=${encodeURIComponent($('semester').value)}`);items=table.courses;configureWeeks();render();message(result.warning||'已读取学期课表 · 下方仅显示所选教学周');});});
$('refresh').onclick=()=>task(async()=>{message('正在查询课表…');const table=await api(`timetable?semester=${encodeURIComponent($('semester').value)}`);items=table.courses;configureWeeks();render();message('已读取学期课表 · 下方仅显示所选教学周');});
$('semester').onchange=()=>{items=[];currentWeek();render();message('学期已切换，请查询课表。');};$('week').onchange=render;
$('prev-week').onclick=()=>{$('week').value=String(Number($('week').value)-1);render();};$('next-week').onclick=()=>{$('week').value=String(Number($('week').value)+1);render();};$('this-week').onclick=currentWeek;
$('logout').onclick=()=>task(async()=>{await api('logout','POST',{});authenticated=false;hasSaved=false;elearningAttempted=false;demo=false;bundle=null;items=[];form.reset();$('elearning-courses').replaceChildren();$('elearning-status').textContent='已清除 eLearning 会话。';$('semester').replaceChildren(new Option('登录后选择学期',''));render();message('已清除本机校园会话和保存的账号。');});
$('demo').onclick=()=>{demo=true;showBundle({semesters:[{id:'demo',name:'演示学期 · 非真实数据',startDate:'2026-09-06'}],defaultId:'demo'});$('week').value=1;items=[{name:'演示 · 第二周课程',day:1,start:1,end:2,weeks:[2],room:'第二周教室',teachers:[]},{name:'演示 · 高等数学',day:1,start:1,end:2,weeks:[1],room:'示例教室',teachers:['示例教师']},{name:'演示 · 大学英语',day:3,start:6,end:7,weeks:[1],room:'示例教室',teachers:['示例教师']},{name:'演示 · 通识选修',day:5,start:3,end:4,weeks:[1],room:'示例教室',teachers:[]}];configureWeeks();render();message('演示模式 · 以下均为虚构数据，未连接校园服务。');controls();};
function selectPage(){
 activePage=location.hash==='#elearning'?'elearning':'timetable';
 $('timetable-page').hidden=activePage!=='timetable';$('elearning-page').hidden=activePage!=='elearning';
 for(const page of ['timetable','elearning']){const link=$(`nav-${page}`);link.classList.toggle('active',page===activePage);if(page===activePage)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 maybeLoadElearning();
}
function maybeLoadElearning(){if(activePage==='elearning'&&authenticated&&!busy&&!elearningAttempted)task(loadElearning);}
const dueFormatter=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
function assignmentCard(a){
 const card=node('li','assignment'),link=node('a','assignment-name',a.name);link.href=a.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
 const date=a.dueAt&&Number.isFinite(Date.parse(a.dueAt))?dueFormatter.format(new Date(a.dueAt))+' 截止（北京时间）':'未设置截止时间';
 const overdue=!a.completed&&!a.informational&&a.dueAt&&Date.parse(a.dueAt)<Date.now();card.append(node('small',overdue?'overdue':'',`${a.status} · ${date}${overdue?' · 已逾期':''}${a.locked?' · 当前已锁定':''}`));return card;
}
function assignmentList(list){const ul=node('ul','assignment-list');list.forEach(a=>ul.append(assignmentCard(a)));return ul;}
function renderElearning(result){
 let pendingTotal=0,completedTotal=0,errors=0;$('elearning-courses').replaceChildren();
 for(const course of result.courses){
  const section=node('section','elearning-course'),heading=node('h3',''),link=node('a','',course.name);link.href=`https://elearning.fudan.edu.cn/courses/${encodeURIComponent(course.id)}`;link.target='_blank';link.rel='noopener noreferrer';heading.append(link);section.append(heading,node('p','course-code',course.code));
  if(course.error){errors++;section.append(node('p','course-error',`作业读取失败：${course.error}`));$('elearning-courses').append(section);continue;}
  const list=course.assignments||[],pending=list.filter(a=>!a.completed&&!a.informational),completed=list.filter(a=>a.completed),informational=list.filter(a=>a.informational&&!a.completed);pendingTotal+=pending.length;completedTotal+=completed.length;
  section.append(node('h4','',`未完成（${pending.length}）`));section.append(pending.length?assignmentList(pending):node('p','empty-assignments',list.length?'当前没有未完成的在线作业。':'此课程暂无已发布作业。'));
  if(completed.length){const details=node('details','completed-assignments');details.append(node('summary','',`已完成（${completed.length}）`),assignmentList(completed));section.append(details);}
  if(informational.length){const details=node('details','informational-assignments');details.append(node('summary','',`无需在线提交（${informational.length}）`),assignmentList(informational));section.append(details);}
  $('elearning-courses').append(section);
 }
 $('elearning-status').textContent=`已加载 ${result.courses.length} 门课程 · 未完成 ${pendingTotal} · 已完成 ${completedTotal}${errors?' · '+errors+' 门课程读取失败':''} · 仅供查看，不自动提交作业`;
}
async function loadElearning(){
 elearningAttempted=true;$('elearning-status').textContent='正在读取各门课程与作业，请稍候…';$('elearning-courses').replaceChildren();
 try{renderElearning(await api('elearning','POST',{}));}catch(error){$('elearning-status').textContent=`读取失败：${error.message}。可点击刷新重试。`;}
}
$('connect-elearning').onclick=()=>task(loadElearning);
window.addEventListener('hashchange',selectPage);

render();
task(async()=>{const s=await api('session');csrf=s.csrf;authenticated=s.authenticated;hasSaved=s.hasSaved;
 if(authenticated||hasSaved){message(authenticated?'正在读取课表…':'正在解锁本机账号并连接 UIS…');const result=authenticated?await api('semesters'):await api('restore','POST',{});authenticated=true;showBundle(result);currentWeek();const table=await api(`timetable?semester=${encodeURIComponent($('semester').value)}`);items=table.courses;configureWeeks();render();message('已自动连接 · 下方仅显示所选教学周');}
});

selectPage();
