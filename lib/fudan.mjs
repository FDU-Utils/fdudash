import {parseExams,parseLevelExams} from './exams.mjs';
import {availableTabs,fileInfo,moduleDocument,richText,gradeSummary,publicLink} from './canvas-modules.mjs';
import {sortCourses} from '../public/course-order.js';
import { CookieJar } from 'tough-cookie';
import { load } from 'cheerio';
import { publicEncrypt, constants } from 'node:crypto';
export const TABLE='https://fdjwgl.fudan.edu.cn/student/for-std/course-table';
const ID='https://id.fudan.edu.cn';
const CHAOXING_SSO='https://fysso.chaoxing.com/oauthsso/fudan';
const chaoxingDestination=url=>['i.chaoxing.com','fudan.mooc.chaoxing.com'].includes(new URL(url).hostname);
const hosts=new Set(['fysso.chaoxing.com','fudan.mooc.chaoxing.com','i.chaoxing.com','id.fudan.edu.cn','uis.fudan.edu.cn','webvpn.fudan.edu.cn','fdjwgl.fudan.edu.cn','elearning.fudan.edu.cn','ecard.fudan.edu.cn','zlapp.fudan.edu.cn']);
function chaoxingCallback(html){
 const $=load(html);
 for(const form of $('form[action]').toArray()){
  let target;
  try{target=new URL($(form).attr('action'),ID);}catch{continue;}
  if(target.origin+target.pathname!==CHAOXING_SSO||target.username||target.password)continue;
  const values=new URLSearchParams();
  for(const name of ['code','state']){
   const value=target.searchParams.get(name)||$(form).find('input[type=hidden][name='+name+']').val();
   if(value)values.set(name,value);
  }
  if(!values.has('code')||!values.has('state'))continue;
  const url=new URL(CHAOXING_SSO);
  const method=($(form).attr('method')||'get').toUpperCase();
  if(method==='GET'){url.search=values;return {url};}
  if(method==='POST')return {url,options:{method,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:values.toString()}};
 }
 return null;
}
export class CampusError extends Error { constructor(code,message){super(message);this.code=code;} }
const fail=(code,message)=>{throw new CampusError(code,message);};
export function safeUrl(input){const u=new URL(input);if(u.protocol!=='https:'||!hosts.has(u.hostname)||u.port||u.username||u.password){const error=new CampusError('UNSAFE_REDIRECT','认证跳转到未支持的地址，已停止。');error.redirectOrigin=u.origin;throw error;}return u;}
export function semesters(html){
 const $=load(html);const match=html.match(/var\s+semesters\s*=\s*JSON\.parse\(([\s\S]*?)\);/);
 if(!match)fail('SCHEMA_CHANGED','未找到学期数据；学校页面可能已更新。');
 let literal=match[1].trim(), list;
 try {const decoded=literal.startsWith('"')?JSON.parse(literal):literal.slice(1,-1).replace(/\\'/g,"'").replace(/\\"/g,'"');list=JSON.parse(decoded);}catch{fail('SCHEMA_CHANGED','学期数据格式不兼容。');}
 if(!Array.isArray(list)||!list.length)fail('SCHEMA_CHANGED','学校未返回可选学期。');
 const result=list.map(s=>({id:String(s.id),name:s.name||`${s.schoolYear||''} ${s.nameZh||s.id}`,startDate:s.startDate||null})).reverse();
 return {semesters:result,defaultId:$('#allSemesters option').first().attr('value')||result[0].id};
}
export function courses(data){
 const activities=data?.studentTableVms?.[0]?.activities;
 if(!Array.isArray(activities))fail('SCHEMA_CHANGED','课表数据格式不兼容。');
 return activities.map(a=>{if(!Number.isInteger(a.weekday)||a.weekday<1||a.weekday>7||!Number.isInteger(a.startUnit)||!Number.isInteger(a.endUnit)||a.startUnit<1||a.endUnit<a.startUnit||!Array.isArray(a.weekIndexes))fail('SCHEMA_CHANGED','课程时间数据不兼容。');return {lessonId:a.lessonId==null?null:String(a.lessonId),name:String(a.courseName||'未命名课程'),teachers:Array.isArray(a.teachers)?a.teachers.map(String):[],room:String(a.room||'地点待定'),day:a.weekday,start:a.startUnit,end:a.endUnit,weeks:a.weekIndexes.map(w=>Number(w)-(a.weekday===7?1:0)).filter(w=>w>0)};});
}
export class FudanClient {
 constructor(){this.jar=new CookieJar();}
 async response(input,options={},depth=0,download=false){
  if(depth>12)fail('REDIRECT_LOOP','认证跳转次数过多。');const candidate=new URL(input),storage=download&&candidate.hostname==='elearning.obs.fudan.edu.cn'&&candidate.protocol==='https:'&&!candidate.port&&!candidate.username&&!candidate.password;const url=storage?candidate:safeUrl(candidate);let res;
  try {res=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 fdudash/0.1',...options.headers,Cookie:storage?'':await this.jar.getCookieString(url.href)}});}catch{fail('NETWORK','无法连接复旦服务，请检查校园网络或 VPN。');}
  if(!storage)for(const cookie of res.headers.getSetCookie())await this.jar.setCookie(cookie,url.href);
  if([301,302,303,307,308].includes(res.status)&&res.headers.has('location')){
   const next=new URL(res.headers.get('location'),url);const keep=[307,308].includes(res.status);
   if(keep&&options.body&&next.origin!==url.origin){const error=new CampusError('UNSAFE_REDIRECT','已阻止跨站转发认证内容。');error.redirectOrigin=next.origin;error.blockedBody=true;throw error;}
   return this.response(next,keep?options:{},depth+1,download);
  }
  if(!res.ok)fail(`HTTP_${res.status}`,`校园服务暂不可用（HTTP ${res.status}）。`);
  return {url:url.href,response:res};
 }
 async request(input,options={}){const {url,response}=await this.response(input,options);return {url,text:await response.text(),link:response.headers.get('link')};
 }
 async json(url,body){if(new URL(url).origin!==ID)fail('UNSAFE_REDIRECT','认证内容只能发送到复旦 UIS。');const r=await this.request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});try{return JSON.parse(r.text);}catch{fail('SCHEMA_CHANGED','认证系统返回了未知格式。');}}
 ticket(html){const $=load(html),action=$('#logon').attr('action'),ticket=$('#ticket').attr('value');if(!action||!ticket)return null;const u=safeUrl(new URL(action,ID));u.searchParams.set('ticket',ticket);return u;}
 async connectService(serviceUrl){
  const first=await this.request(serviceUrl);if(new URL(first.url).hostname===new URL(serviceUrl).hostname)return;
  if(new URL(first.url).hostname==='id.fudan.edu.cn'){const ticket=this.ticket(first.text);if(ticket){await this.request(ticket);return;}}
  fail('SERVICE_LOGIN','此校园服务需要独立登录，请先在本机记住账号。');
 }
 async login(username,password,serviceUrl=TABLE){
  const finish=()=>serviceUrl===TABLE?this.getSemesters():this.request(serviceUrl);
  const first=await this.request(serviceUrl);
  if(serviceUrl===CHAOXING_SSO&&chaoxingDestination(first.url))return first;
  if(new URL(first.url).hostname===new URL(serviceUrl).hostname){return serviceUrl===TABLE?semesters(first.text):first;}
  if(new URL(first.url).hostname!=='id.fudan.edu.cn')fail('UNSUPPORTED_AUTH','当前认证入口尚未支持。');
  const existing=this.ticket(first.text);if(existing){await this.request(existing);return finish();}
  const redirect=new URL(first.url),params=new URLSearchParams((redirect.hash.split('?')[1]||redirect.search.slice(1))),lck=params.get('lck'),entityId=params.get('entityId');
  if(!lck||!entityId)fail('SCHEMA_CHANGED','未找到 UIS 认证参数。');
  const methods=await this.json(`${ID}/idp/authn/queryAuthMethods`,{lck,entityId});
  if(methods.second)fail('INTERACTION_REQUIRED','学校要求双因素认证；当前原型尚未接入交互认证，请勿重复尝试。');
  const method=Array.isArray(methods.data)&&methods.data.find(m=>m.moduleCode==='userAndPwd');
  if(!method)fail('INTERACTION_REQUIRED','当前登录方式不支持密码认证。');
  const key=await this.json(`${ID}/idp/authn/getJsPublicKey`,{});
  if(typeof key.data!=='string')fail('SCHEMA_CHANGED','无法读取 UIS 公钥。');
  const encrypted=publicEncrypt({key:`-----BEGIN PUBLIC KEY-----\n${key.data}\n-----END PUBLIC KEY-----`,padding:constants.RSA_PKCS1_PADDING},Buffer.from(password)).toString('base64');
  const result=await this.json(`${ID}/idp/authn/authExecute`,{authModuleCode:'userAndPwd',authChainCode:method.authChainCode,entityId,requestType:'chain_type',lck,authPara:{loginName:username,password:encrypted,verifyCode:''}});
  if(!result.loginToken){if(String(result.message).includes('用户名或密码错误'))fail('CREDENTIALS','账号或密码错误；已停止，不会自动重试。');fail('INTERACTION_REQUIRED','认证未完成，可能需要验证码或双因素认证；当前原型暂不支持。');}
  const engine=await this.request(`${ID}/idp/authCenter/authnEngine`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({loginToken:result.loginToken}).toString()});
  if(serviceUrl===CHAOXING_SSO&&chaoxingDestination(engine.url))return engine;
  if(serviceUrl===CHAOXING_SSO&&new URL(engine.url).origin===ID){
   const callback=chaoxingCallback(engine.text);
   if(callback)return this.request(callback.url,callback.options);
  }
  const ticket=this.ticket(engine.text);if(!ticket)fail(serviceUrl===CHAOXING_SSO?'CHAOXING_UIS_CALLBACK':'SCHEMA_CHANGED',serviceUrl===CHAOXING_SSO?'Chaoxing UIS callback did not return a recognized service ticket (CHAOXING_UIS_CALLBACK).':'未取得校园服务登录票据。');await this.request(ticket);return finish();
 }
 async getSemesters(){const r=await this.request(TABLE);if(new URL(r.url).hostname!=='fdjwgl.fudan.edu.cn')fail('EXPIRED','校园会话已失效，请重新登录。');return semesters(r.text);}
 async timetable(id){if(!/^\d{1,12}$/.test(id))fail('INPUT','学期编号无效。');const r=await this.request(`${TABLE}/semester/${id}/print-data`);if(new URL(r.url).hostname!=='fdjwgl.fudan.edu.cn')fail('EXPIRED','校园会话已失效，请重新登录。');let data;try{data=JSON.parse(r.text);}catch{fail('SCHEMA_CHANGED','学校未返回课表 JSON。');}return courses(data);}
 async exams(){
  const exams=[],sources=[];
  for(const [id,read] of [['course',()=>this.courseExams()],['level',()=>this.levelExams()]]){
   try{const items=await read();exams.push(...items.map(exam=>({...exam,source:id})));sources.push({id,count:items.length,ok:true});}
   catch(error){sources.push({id,ok:false,code:error instanceof CampusError?error.code:'SCHEMA_CHANGED',message:error instanceof CampusError?error.message:'考试页面格式不兼容。'});}
  }
  return {exams:exams.sort((a,b)=>(Date.parse(a.startAt)||Infinity)-(Date.parse(b.startAt)||Infinity)),sources,loadedAt:new Date().toISOString()};
 }
 async levelExams(){
  const page=await this.request('https://fdjwgl.fudan.edu.cn/student/for-std/level-exam-signup');
  if(new URL(page.url).hostname!=='fdjwgl.fudan.edu.cn')fail('EXPIRED','校园会话已失效，请重新登录。');
  try{return parseLevelExams(page.text);}catch{fail('SCHEMA_CHANGED','水平测试页面格式不兼容，未将读取失败显示为无考试。');}
 }
 async courseExams(){

  const bundle=await this.getSemesters(),table=await this.request(`${TABLE}/semester/${bundle.defaultId}/print-data`);let data;
  try{data=JSON.parse(table.text);}catch{fail('EXPIRED','校园会话已失效，请重新登录。');}
  const studentId=data?.studentTableVms?.[0]?.id;if(!/^\d+$/.test(String(studentId)))fail('SCHEMA_CHANGED','未取得考试查询所需的学生标识。');
  const page=await this.request(`https://fdjwgl.fudan.edu.cn/student/for-std/exam-arrange/info/${studentId}`);if(new URL(page.url).hostname!=='fdjwgl.fudan.edu.cn')fail('EXPIRED','校园会话已失效，请重新登录。');
  try{return parseExams(page.text);}catch{fail('SCHEMA_CHANGED','考试页面格式不兼容，未将读取失败显示为无考试。');}
 }
 async elearning(){
  const entry=await this.request('https://elearning.fudan.edu.cn/dash');
  if(new URL(entry.url).hostname!=='elearning.fudan.edu.cn'){
   const ticket=this.ticket(entry.text);if(ticket)await this.request(ticket);else fail('ELEARNING_LOGIN','eLearning 需要单独建立 UIS 服务会话。');
  }
  const data=await this.canvasList('/api/v1/courses?enrollment_state=active&include[]=total_scores&include[]=teachers&include[]=term&include[]=syllabus_body&per_page=100');
  return {accessible:true,courses:data.filter(c=>c.name).map(c=>({id:String(c.id),name:String(c.name),code:String(c.course_code||''),createdAt:c.created_at||null,term:c.term?.name||'',defaultView:c.default_view||'feed',teachers:(c.teachers||[]).map(t=>String(t.display_name||t.name||'')).filter(Boolean),syllabus:richText(c.syllabus_body),grades:gradeSummary(c.enrollments)})),limited:false};
 }

 async canvasList(path){
  let next=new URL(path,'https://elearning.fudan.edu.cn'),result=[],pages=0;const visited=new Set();
  while(next){if(++pages>50||visited.has(next.href))fail('PAGINATION','eLearning 分页异常，未将不完整数据标为加载完成。');visited.add(next.href);
   if(next.origin!=='https://elearning.fudan.edu.cn'||!next.pathname.startsWith('/api/v1/'))fail('UNSAFE_REDIRECT','已阻止异常 eLearning 分页地址。');
   const response=await this.request(next.href);if(new URL(response.url).hostname!=='elearning.fudan.edu.cn')fail('ELEARNING_LOGIN','eLearning 会话已过期。');let list;
   try{list=JSON.parse(response.text);}catch{fail('ELEARNING_UNSUPPORTED','eLearning 未返回有效的列表数据。');}if(!Array.isArray(list))fail('ELEARNING_UNSUPPORTED','eLearning 列表数据格式不兼容。');result.push(...list);
   const link=String(response.link||'').split(',').find(s=>/rel="next"/.test(s)),match=link?.match(/<([^>]+)>/);next=match?new URL(match[1],next):null;
  }return result;
 }
 async courseAssignments(courseId){
  if(!/^\d+$/.test(String(courseId)))fail('INPUT','课程编号无效。');
  const list=await this.canvasList(`/api/v1/courses/${courseId}/assignments?include[]=submission&per_page=100`);
  return list.filter(a=>a.published!==false).map(a=>assignmentInfo(a,courseId)).sort((a,b)=>(a.dueAt?Date.parse(a.dueAt):Infinity)-(b.dueAt?Date.parse(b.dueAt):Infinity)||a.name.localeCompare(b.name));
 }
 async canvasObject(path){
  const u=new URL(path,'https://elearning.fudan.edu.cn');if(u.origin!=='https://elearning.fudan.edu.cn'||!u.pathname.startsWith('/api/v1/'))fail('INPUT','无效的课程数据地址。');
  const r=await this.request(u.href);if(new URL(r.url).hostname!=='elearning.fudan.edu.cn')fail('ELEARNING_LOGIN','eLearning 会话已过期。');try{return JSON.parse(r.text);}catch{fail('ELEARNING_UNSUPPORTED','课程数据格式不兼容。');}
 }
 async courseFiles(id){
  const files=await this.canvasList(`/api/v1/courses/${id}/files?sort=updated_at&order=desc&per_page=100`);let folders=new Map();
  try{folders=new Map((await this.canvasList(`/api/v1/courses/${id}/folders?per_page=100`)).map(f=>[String(f.id),String(f.full_name||f.name||'')]));}catch{/* Folder labels are optional; file retrieval succeeded. */}
  return files.filter(f=>!f.hidden_for_user).map(f=>fileInfo(f,folders));
 }
 async courseModule(course,tab){
  const id=course.id,path=`/api/v1/courses/${id}`;
  switch(tab.id){
   case 'assignments':return {assignments:course.assignments};
   case 'grades':return {summary:course.grades,items:course.assignments.map(a=>({id:a.id,name:a.name,score:a.score,points:a.points,grade:a.grade,excused:a.excused,status:a.status,dueAt:a.dueAt,submittedAt:a.submittedAt,feedback:a.feedback,url:a.url}))};
   case 'files':return {items:await this.courseFiles(id)};
   case 'announcements':return {items:(await this.canvasList(`${path}/discussion_topics?only_announcements=true&per_page=100`)).map(moduleDocument).sort((a,b)=>Date.parse(b.date||0)-Date.parse(a.date||0))};
   case 'discussions':return {items:(await this.canvasList(`${path}/discussion_topics?per_page=100`)).map(moduleDocument)};
   case 'people':return {items:(await this.canvasList(`${path}/users?enrollment_type[]=teacher&enrollment_type[]=ta&per_page=100`)).map(u=>({name:String(u.name||u.short_name||''),role:(u.enrollments||[]).some(e=>e.type==='TaEnrollment')?'助教':'教师 / 助教'}))};
   case 'syllabus':return {body:course.syllabus,items:course.assignments.map(a=>({title:a.name,date:a.dueAt,url:a.url}))};
   case 'home':{let body={text:'',links:[]};if(course.defaultView==='wiki'){try{body=richText((await this.canvasObject(`${path}/front_page`)).body);}catch(error){if(error.code!=='HTTP_404')throw error;}}return {body,term:course.term,teachers:course.teachers};}
   case 'pages':return {items:(await this.canvasList(`${path}/pages?per_page=100`)).map(p=>({...moduleDocument(p),pageSlug:p.url}))};
   case 'quizzes':return {items:(await this.canvasList(`${path}/quizzes?per_page=100`)).map(q=>({title:String(q.title||''),date:q.due_at||null,url:publicLink(q.html_url),body:richText(q.description),timeLimit:q.time_limit,questionCount:q.question_count}))};
   case 'modules':{
    const modules=await this.canvasList(`${path}/modules?include[]=items&per_page=100`),items=[];
    for(const m of modules){const entries=m.items?.length>=m.items_count?m.items:await this.canvasList(`${path}/modules/${m.id}/items?per_page=100`);items.push({title:String(m.name),state:m.state,items:entries.map(x=>({title:String(x.title),type:x.type,completed:x.completion_requirement?.completed??null,url:publicLink(x.html_url||x.external_url)}))});}return {items};
   }
   default:return {unsupported:true};
  }
 }
 async enrichCourse(course){
  const result={...course,assignments:[],modules:[]};
  try{result.assignments=await this.courseAssignments(course.id);}catch(error){result.errorCode=error.code;result.error=error instanceof CampusError?error.message:'作业暂时无法读取。';}
  let tabs;try{tabs=availableTabs(await this.canvasList(`/api/v1/courses/${course.id}/tabs`),course.id);}catch(error){result.moduleErrorCode=error.code;result.moduleError=error instanceof CampusError?error.message:'模块导航暂时无法读取。';tabs=[];}
  // A course can expose graded quizzes through Home without an Assignments tab.
  if(result.assignments.length&&!tabs.some(t=>t.id==='assignments'))tabs.unshift({id:'assignments',label:'作业',url:`https://elearning.fudan.edu.cn/courses/${course.id}/assignments`});
  const order=['assignments','grades','files','announcements','home','syllabus','discussions','modules','quizzes','pages','people'];tabs.sort((a,b)=>(order.indexOf(a.id)<0?99:order.indexOf(a.id))-(order.indexOf(b.id)<0?99:order.indexOf(b.id)));
  for(const tab of tabs){try{result.modules.push({...tab,data:await this.courseModule(result,tab)});}catch(error){result.modules.push({...tab,errorCode:error.code,error:error instanceof CampusError?error.message:'模块内容暂时无法读取。'});}}
  return result;
 }
 async elearningDashboard(bundle){
  const courses=new Array(bundle.courses.length);let cursor=0;
  const worker=async()=>{while(cursor<bundle.courses.length){const index=cursor++;courses[index]=await this.enrichCourse(bundle.courses[index]);}};
  await Promise.all([worker(),worker()]);return {...bundle,courses:sortCourses(courses),loadedAt:new Date().toISOString()};
 }
 async coursePage(courseId,slug){const p=await this.canvasObject(`/api/v1/courses/${courseId}/pages/${encodeURIComponent(slug)}`);return {title:String(p.title||''),body:richText(p.body)};}
 async downloadFile(courseId,fileId){
  if(!/^\d+$/.test(courseId)||!/^\d+$/.test(fileId))fail('INPUT','文件编号无效。');
  const meta=await this.canvasObject(`/api/v1/courses/${courseId}/files/${fileId}`);if(String(meta.id)!==fileId)fail('FILE_ID','文件信息与请求不一致。');if(meta.locked_for_user||meta.hidden_for_user)fail('FILE_LOCKED','当前文件不可访问。');
  if(meta.size>64*1024*1024)fail('FILE_SIZE','文件超过 64 MB，请从原平台下载。');
  const url=safeUrl(meta.url);if(url.hostname!=='elearning.fudan.edu.cn')fail('FILE_HOST','该文件使用外部存储，请从原平台打开。');
  const {response,url:finalUrl}=await this.response(url,{},0,true);if(!['elearning.fudan.edu.cn','elearning.obs.fudan.edu.cn'].includes(new URL(finalUrl).hostname))fail('ELEARNING_LOGIN','文件会话已过期。');
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>64*1024*1024)fail('FILE_SIZE','文件超过本机预览上限。');chunks.push(chunk);}
  return {bytes:Buffer.concat(chunks),name:String(meta.display_name||meta.filename||'download'),type:String(meta['content-type']||'application/octet-stream')};
 }

}

export function assignmentInfo(a,courseId){
 const s=a.submission,state=s?.workflow_state,needsRedo=s?.redo_request===true;
 const completed=!needsRedo&&!!(s?.excused||s?.submitted_at||['submitted','pending_review'].includes(state)||(state==='graded'&&!s?.missing&&(s?.grade!=null||s?.score!=null||s?.submission_type)));
 const informational=!needsRedo&&!completed&&a.submission_types?.length>0&&a.submission_types.every(t=>['none','not_graded','on_paper'].includes(t));
 const unknown=!completed&&!informational&&!s;
 return {id:String(a.id),name:String(a.name||'未命名作业'),quizId:a.quiz_id??null,body:richText(a.description),points:a.points_possible??null,score:s?.score??null,grade:s?.grade??null,excused:!!s?.excused,submittedAt:s?.submitted_at||null,feedback:(s?.submission_comments||[]).map(c=>({text:String(c.comment||''),date:c.created_at||null})),dueAt:a.due_at||null,completed,informational,unknown,status:needsRedo?'需重新提交':s?.excused?'已豁免':completed?'已完成':informational?'无需在线提交':unknown?'提交状态未知':s?.missing?'缺交':state==='unsubmitted'?'未提交':'未完成',locked:!!a.locked_for_user,url:`https://elearning.fudan.edu.cn/courses/${encodeURIComponent(courseId)}/assignments/${encodeURIComponent(a.id)}`};
}
