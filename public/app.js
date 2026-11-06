import {renderWeather} from './weather-view.js';
import {renderLinks} from './links-view.js';
import {renderDashboard,greeting,examText,updateCountdowns} from './dashboard-view.js';
import {t,getLanguage,setLanguage,applyLanguage,formatDate,errorText} from './i18n.js';
import {sortCourses,pendingAssignments} from './course-order.js';
import {renderCourseCards} from './course-cards.js';
import {layoutWeek,teachingWeek,weekRange} from './schedule.js';
const moduleState=new Map();let weatherResult=null,weatherAttempted=false,linksResult=null,linksAttempted=false,timetableAttempted=false;let dashboardResult=null,dashboardAttempted=false,profile=null,loginRequested=false,greetingSeed=Date.now();let elearningResult=null,examResult=null,statusSource='尚未连接。登录后读取个人课表。',examStatusSource='进入页面后自动读取教务考试安排。',examsAttempted=false;
let csrf='',authenticated=false,bundle=null,items=[],busy=false,hasSaved=false,elearningAttempted=false,activePage=['dashboard','timetable','elearning','exams','weather','links'].includes(location.hash.slice(1))?location.hash.slice(1):'dashboard';
const $=id=>document.getElementById(id),form=$('login'),status=$('status');
function message(text){statusSource=text;status.textContent=t(text);}
function controls(){for(const e of form.elements)e.disabled=busy||authenticated;$('semester').disabled=busy||!bundle;$('refresh').disabled=busy||!authenticated;$('account-action').textContent=t(authenticated?'退出并忘记账号':'登录');$('account-action').disabled=busy;$('connect-elearning').disabled=busy||!authenticated;$('login-panel').hidden=authenticated||!loginRequested;$('refresh-dashboard').disabled=busy||!authenticated;$('bus-holiday').disabled=busy||!authenticated;$('refresh-exams').disabled=busy||!authenticated;$('refresh-weather').disabled=busy;$('import-links').disabled=busy;}
async function api(path,method='GET',data){const res=await fetch(`/api/${path}`,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:data?JSON.stringify(data):undefined});const result=await res.json();if(!res.ok)throw Error(errorText(result.code,result.message||'请求失败'));return result;}
async function task(fn){if(busy)return;busy=true;controls();try{await fn();}catch(e){message(e.message);}finally{busy=false;controls();maybeLoadActive();}}
function showBundle(value){bundle=value;$('semester').replaceChildren(...value.semesters.map(s=>new Option(s.name,s.id)));$('semester').value=value.defaultId;items=[];render();}
const slots=[['08:00','08:45'],['08:55','09:40'],['09:55','10:40'],['10:50','11:35'],['11:45','12:30'],['13:30','14:15'],['14:25','15:10'],['15:25','16:10'],['16:20','17:05'],['17:15','18:00'],['18:30','19:15'],['19:25','20:10'],['20:20','21:05'],['21:15','22:00']];
function node(tag,className,text){const e=document.createElement(tag);e.className=className;if(text!==undefined)e.textContent=['course-name','exam-name'].includes(className)?text:t(text);return e;}
function render(){
 const week=Number($('week').value),grid=$('grid'),days=['周一','周二','周三','周四','周五','周六','周日'];grid.replaceChildren();grid.append(node('div','corner','节次'));
 days.forEach((name,i)=>{const header=node('div','day-heading',name);header.style.gridColumn=String(i+2);header.style.gridRow='1';grid.append(header);});
 slots.forEach((times,i)=>{const label=node('div','slot-label');label.style.gridColumn='1';label.style.gridRow=String(i+2);label.append(node('strong','',String(i+1)),node('small','',times[0]),node('small','',times[1]));grid.append(label);for(let day=1;day<=7;day++){const cell=node('div','slot-cell');cell.style.gridColumn=String(day+1);cell.style.gridRow=String(i+2);grid.append(cell);}});
 const visible=layoutWeek(items,week).filter(c=>c.start<=slots.length);
 for(const course of visible){const card=node('article','course');card.style.gridColumn=String(course.day+1);card.style.gridRow=`${course.start+1} / ${Math.min(course.end,slots.length)+2}`;
 card.style.width=`calc(${100/course.lanes}% - 6px)`;card.style.marginLeft=`calc(${course.lane*100/course.lanes}% + 3px)`;
 card.append(node('strong','course-name',course.name));for(const text of [course.room,`${slots[course.start-1]?.[0]||'?'}–${slots[Math.min(course.end,slots.length)-1]?.[1]||'?'}`,`第 ${course.start}–${course.end} 节`,course.teachers.join(' / '),...(course.rooms?.length>1?['教务返回多个教室']:[]),...(course.lanes>1?['同时段安排，请核实']:[])])card.append(node('small','',text));grid.append(card);}
 const semester=bundle?.semesters.find(s=>s.id===$('semester').value),range=weekRange(semester?.startDate,week);
 $('week-summary').textContent=t(`第 ${week} 周${range?' · '+range.join(' — '):' · 开学日期未知'} · ${visible.length?visible.length+' 条安排':'本周暂无课程'}${visible.some(c=>c.lanes>1)?' · 冲突课程已并排显示':''}`);
 $('prev-week').disabled=week<=1;$('next-week').disabled=week>=Number($('week').lastElementChild.value);
}
function configureWeeks(){const selected=Number($('week').value)||1;const max=Math.min(60,Math.max(20,...items.flatMap(c=>c.weeks)));$('week').replaceChildren(...Array.from({length:max},(_,i)=>new Option(t(`第 ${i+1} 周`),String(i+1))));$('week').value=String(Math.min(max,selected));}
function currentWeek(){configureWeeks();const s=bundle?.semesters.find(s=>s.id===$('semester').value);$('week').value=String(Math.max(1,Math.min(Number($('week').lastElementChild.value),teachingWeek(s?.startDate))));render();}
form.addEventListener('submit',event=>{event.preventDefault();task(async()=>{message('正在连接 UIS，请稍候；不会自动重试密码。');const data={username:form.elements.username.value.trim(),password:form.elements.password.value,remember:form.elements.remember.checked};form.elements.password.value='';let result;try{result=await api('login','POST',data);}finally{data.password='';}authenticated=true;loginRequested=false;profile=result.profile||null;hasSaved=data.remember;renderGreeting();showBundle(result);currentWeek();message(result.warning||'UIS 已连接。');});});
async function loadTimetable(){timetableAttempted=true;if(!bundle){showBundle(await api('semesters'));currentWeek();}message('正在查询课表…');const table=await api(`timetable?semester=${encodeURIComponent($('semester').value)}`);items=table.courses;configureWeeks();render();message('已读取学期课表 · 下方仅显示所选教学周');}
$('refresh').onclick=()=>task(loadTimetable);
$('semester').onchange=()=>{items=[];currentWeek();render();message('学期已切换，请查询课表。');};$('week').onchange=render;
$('prev-week').onclick=()=>{$('week').value=String(Number($('week').value)-1);render();};$('next-week').onclick=()=>{$('week').value=String(Number($('week').value)+1);render();};$('this-week').onclick=currentWeek;
async function forgetAccount(){await task(async()=>{await api('logout','POST',{});authenticated=false;hasSaved=false;dashboardAttempted=false;timetableAttempted=false;dashboardResult=null;profile=null;loginRequested=false;renderDashboard(null);renderGreeting();elearningAttempted=false;examsAttempted=false;elearningResult=null;examResult=null;examStatusSource='进入页面后自动读取教务考试安排。';$('exams-status').textContent=t(examStatusSource);$('course-search').value='';moduleState.clear();$('exam-list').replaceChildren();$('course-nav-list').replaceChildren();bundle=null;items=[];form.reset();$('elearning-courses').replaceChildren();$('elearning-status').textContent=t('已清除 eLearning 会话。');$('semester').replaceChildren(new Option(t('登录后选择学期'),''));render();message('已清除本机校园会话和保存的账号。');location.hash='#dashboard';});}
function selectPage(){
 activePage=['dashboard','timetable','elearning','exams','weather','links'].includes(location.hash.slice(1))?location.hash.slice(1):'dashboard';
 $('dashboard-page').hidden=activePage!=='dashboard';$('dashboard-header').hidden=activePage!=='dashboard';$('timetable-page').hidden=activePage!=='timetable';$('elearning-page').hidden=activePage!=='elearning';$('exams-page').hidden=activePage!=='exams';$('weather-page').hidden=activePage!=='weather';$('links-page').hidden=activePage!=='links';document.title='FDUDash · '+(activePage==='dashboard'?'Dashboard':t(activePage==='timetable'?'课表':activePage==='exams'?'考试':activePage==='weather'?'天气':activePage==='links'?'链接站':'elearning'));
 for(const page of ['dashboard','timetable','elearning','exams','weather','links']){const link=$(`nav-${page}`);link.setAttribute('aria-label',t(page==='dashboard'?'总览':page==='timetable'?'课表':page==='exams'?'考试':page==='weather'?'天气':page==='links'?'链接站':'elearning'));link.classList.toggle('active',page===activePage);if(page===activePage)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}
 if(activePage==='weather'&&weatherResult)renderWeather($('weather-content'),weatherResult,true,$('weather-campus').value);if(activePage==='links'&&linksResult)renderLinks($('links-content'),linksResult,$('links-search').value);maybeLoadActive();
}
function maybeLoadActive(){if(busy)return;if(activePage==='links'&&!linksAttempted){task(loadLinkPage);return;}if((activePage==='weather'||activePage==='dashboard'&&!authenticated)&&!weatherAttempted){task(loadWeatherPage);return;}if(!authenticated)return;if(activePage==='dashboard'&&!dashboardAttempted)task(loadDashboard);if(activePage==='timetable'&&!timetableAttempted)task(loadTimetable);if(activePage==='elearning'&&!elearningAttempted)task(loadElearning);if(activePage==='exams'&&!examsAttempted)task(loadExams);}
function renderElearning(result){renderCourseCards($('elearning-courses'),result,{api,csrf:()=>csrf,status:$('elearning-status'),moduleState});renderCourseNavigation();}
function renderCourseNavigation(){const search=$('course-search').value.trim().toLowerCase(),list=$('course-nav-list');list.replaceChildren();for(const course of sortCourses(elearningResult?.courses||[])){if(!(course.name+' '+course.code).toLowerCase().includes(search))continue;const button=node('button','quick-course'),label=document.createElement('span');label.textContent=course.name;button.append(label);const count=pendingAssignments(course).length;if(count){button.append(node('span','task-badge',String(count)));button.setAttribute('aria-label',`${course.name} · ${t('未完成')} ${count}`);}button.onclick=()=>{const card=document.getElementById(`course-${course.id}`);card?.scrollIntoView({behavior:document.body.classList.contains('reduce-motion')?'auto':'smooth',block:'start'});card?.focus({preventScroll:true});};list.append(button);}}
$('course-search').oninput=renderCourseNavigation;
function renderExams(){const list=$('exam-list');list.replaceChildren();if(!examResult){$('exams-status').textContent=t(examStatusSource);return;}const exams=examResult.exams||[];$('exams-status').textContent=t(`已加载 ${exams.length} 条考试安排`);if(!exams.length){list.append(node('p','empty-assignments','暂无已发布的考试安排。'));return;}
 const upcoming=[],finished=[];for(const exam of exams){const past=exam.finished||(exam.endAt&&Date.parse(exam.endAt)<Date.now()),card=node('article','exam-card');card.append(node('h3','exam-name',exam.name),node('p','course-code',`${exam.code} · ${t(exam.type||'考试类型')}`),node('p','exam-time',exam.startAt?`${formatDate(exam.startAt)}${exam.endAt?' — '+formatDate(exam.endAt,{year:undefined,month:undefined,day:undefined}):''}`:t('时间待定')),node('p','exam-location',exam.location||t('地点待定')),examCountdownNode(exam,past));if(exam.note)card.append(node('p','exam-note',exam.note));(past?finished:upcoming).push(card);}
 list.append(...upcoming);if(finished.length){const details=node('details','past-exams'),summary=node('summary','',`${t('已结束')} (${finished.length})`);details.append(summary,...finished);list.append(details);}}
async function loadExams(){examsAttempted=true;examStatusSource='读取考试安排…';$('exams-status').textContent=t(examStatusSource);try{examResult=await api('exams');renderExams();}catch(error){examStatusSource='考试数据读取失败：'+error.message;$('exams-status').textContent=t(examStatusSource);}}
$('refresh-exams').onclick=()=>task(loadExams);
function examCountdownNode(exam,past){const e=node('span',past?'exam-state finished':'exam-state',examText(exam));e.dataset.examCountdown='';e.dataset.start=exam.startAt||'';e.dataset.end=exam.endAt||'';e.dataset.finished=String(!!exam.finished);return e;}
async function loadElearning(){
 elearningAttempted=true;$('elearning-status').textContent=t('正在读取课程、作业和开放的模块，请稍候…');$('elearning-courses').replaceChildren();
 try{elearningResult=await api('elearning','POST',{});if(dashboardResult){dashboardResult.todo={courses:elearningResult.courses};renderDashboard(dashboardResult,{authenticated});}moduleState.clear();renderElearning(elearningResult);}catch(error){$('elearning-status').textContent=t(`读取失败：${error.message}。可点击刷新重试。`);}
}
$('connect-elearning').onclick=()=>task(loadElearning);
window.addEventListener('hashchange',selectPage);

applyLanguage();render();
task(async()=>{const s=await api('session');csrf=s.csrf;authenticated=s.authenticated;hasSaved=s.hasSaved;profile=s.profile||null;renderGreeting();
 if(!authenticated&&hasSaved){message('正在解锁本机账号并连接 UIS…');const result=await api('restore','POST',{});authenticated=true;profile=result.profile||null;renderGreeting();showBundle(result);currentWeek();message('UIS 已连接。');}else if(authenticated){message('UIS 已连接。');}
});

selectPage();

const sidebarMedia=window.matchMedia('(max-width:760px)');let sidebarExplicit=false,sidebarCollapsed=sidebarMedia.matches;try{const saved=localStorage.getItem('fdudash.sidebarCollapsed');if(saved!==null){sidebarExplicit=true;sidebarCollapsed=saved==='true';}}catch{}
function applySidebar(){document.body.classList.toggle('sidebar-collapsed',sidebarCollapsed);$('sidebar-toggle').setAttribute('aria-expanded',String(!sidebarCollapsed));$('sidebar-toggle').setAttribute('aria-label',t(sidebarCollapsed?'展开侧栏':'收起侧栏'));$('sidebar-toggle').title=t(sidebarCollapsed?'展开侧栏':'收起侧栏');}
$('sidebar-toggle').onclick=()=>{sidebarExplicit=true;sidebarCollapsed=!sidebarCollapsed;try{localStorage.setItem('fdudash.sidebarCollapsed',String(sidebarCollapsed));}catch{}applySidebar();};
$('language-toggle').onclick=()=>setLanguage(getLanguage()==='zh'?'en':'zh');
window.addEventListener('fdudash-language',()=>{configureWeeks();render();message(statusSource);if(elearningResult)renderElearning(elearningResult);renderDashboard(dashboardResult,{authenticated});renderWeather($('home-weather'),weatherResult);renderWeather($('weather-content'),weatherResult,true,$('weather-campus').value);renderLinks($('links-content'),linksResult,$('links-search').value);renderGreeting();if(dashboardResult)$('dashboard-status').textContent=t('总览已更新');renderExams();controls();selectPage();applySidebar();});
applySidebar();

sidebarMedia.addEventListener('change',()=>{if(!sidebarExplicit){sidebarCollapsed=sidebarMedia.matches;applySidebar();}});

for(const link of document.querySelectorAll('.main-nav a'))link.addEventListener('click',()=>{if(sidebarMedia.matches){sidebarCollapsed=true;try{localStorage.setItem('fdudash.sidebarCollapsed','true');}catch{}applySidebar();}});

function renderGreeting(){$('dashboard-greeting').textContent=greeting(profile?.name,greetingSeed);}
async function loadDashboard(){dashboardAttempted=true;renderDashboard(dashboardResult,{authenticated});$('dashboard-status').textContent=t('正在读取总览…');try{dashboardResult=await api(`dashboard?holiday=${$('bus-holiday').value}`);profile=dashboardResult.profile||profile;if(dashboardResult.weather){weatherResult=dashboardResult.weather;weatherAttempted=true;}renderDashboard(dashboardResult,{authenticated});renderWeather($('home-weather'),weatherResult);renderGreeting();$('dashboard-status').textContent=t('总览已更新');if(profile?.cached===false)$('dashboard-status').textContent+=' · '+t('姓名缓存未能保存，下次可能重新读取。');}catch(error){$('dashboard-status').textContent=error.message;renderDashboard(dashboardResult,{authenticated,failed:true});}}
$('refresh-dashboard').onclick=()=>task(loadDashboard);
$('bus-holiday').onchange=()=>task(async()=>{try{const value=await api(`campus?service=bus&holiday=${$('bus-holiday').value}`);if(!dashboardResult)dashboardResult={};dashboardResult.bus=value;renderDashboard(dashboardResult,{authenticated});}catch(error){$('bus-content').textContent=error.message;}});
const settings=$('settings-popup'),settingsButton=$('settings-toggle');
function closeSettings(){settings.hidden=true;settingsButton.setAttribute('aria-expanded','false');}
settingsButton.onclick=()=>{settings.hidden=!settings.hidden;settingsButton.setAttribute('aria-expanded',String(!settings.hidden));};
document.addEventListener('pointerdown',event=>{if(!settings.contains(event.target)&&!settingsButton.contains(event.target))closeSettings();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!settings.hidden){closeSettings();settingsButton.focus();}});
$('account-action').onclick=()=>{closeSettings();if(authenticated){forgetAccount();return;}loginRequested=true;location.hash='#dashboard';controls();$('login-panel').scrollIntoView({behavior:document.body.classList.contains('reduce-motion')?'auto':'smooth',block:'center'});form.elements.username.focus({preventScroll:true});};
const motionMedia=window.matchMedia('(prefers-reduced-motion: reduce)');let motionExplicit=false,reducedMotion=motionMedia.matches;
try{const saved=localStorage.getItem('fdudash.reduceMotion');if(saved!==null){motionExplicit=true;reducedMotion=saved==='true';}}catch{}
function applyMotion(){document.body.classList.toggle('reduce-motion',reducedMotion);$('reduce-motion').checked=reducedMotion;}
$('reduce-motion').onchange=()=>{motionExplicit=true;reducedMotion=$('reduce-motion').checked;try{localStorage.setItem('fdudash.reduceMotion',String(reducedMotion));}catch{}applyMotion();};
motionMedia.addEventListener('change',()=>{if(!motionExplicit){reducedMotion=motionMedia.matches;applyMotion();}});
applyMotion();renderDashboard(null);renderWeather($('home-weather'),weatherResult);renderGreeting();setInterval(()=>updateCountdowns(),30000);

async function loadWeatherPage(force=false){weatherAttempted=true;try{weatherResult=await api(`weather${force?'?force=1':''}`);renderWeather($('home-weather'),weatherResult);renderWeather($('weather-content'),weatherResult,true,$('weather-campus').value);}catch(error){weatherResult={error:error.message};renderWeather($('home-weather'),weatherResult);renderWeather($('weather-content'),weatherResult,true);}}
$('refresh-weather').onclick=()=>task(()=>loadWeatherPage(true));
$('weather-campus').onchange=()=>renderWeather($('weather-content'),weatherResult,true,$('weather-campus').value);
async function loadLinkPage(){linksAttempted=true;try{linksResult=await api('links');renderLinks($('links-content'),linksResult,$('links-search').value);}catch(error){$('links-status').textContent=error.message;}}
$('links-search').oninput=()=>renderLinks($('links-content'),linksResult,$('links-search').value);
$('import-links').onclick=()=>task(async()=>{try{linksResult=await api('links/import','POST',{});renderLinks($('links-content'),linksResult,$('links-search').value);}catch(error){$('links-status').textContent=error.message;}});
