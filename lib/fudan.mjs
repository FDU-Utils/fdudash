import { CookieJar } from 'tough-cookie';
import { load } from 'cheerio';
import { publicEncrypt, constants } from 'node:crypto';
export const TABLE='https://fdjwgl.fudan.edu.cn/student/for-std/course-table';
const ID='https://id.fudan.edu.cn';
const hosts=new Set(['id.fudan.edu.cn','uis.fudan.edu.cn','fdjwgl.fudan.edu.cn','elearning.fudan.edu.cn']);
export class CampusError extends Error { constructor(code,message){super(message);this.code=code;} }
const fail=(code,message)=>{throw new CampusError(code,message);};
export function safeUrl(input){const u=new URL(input);if(u.protocol!=='https:'||!hosts.has(u.hostname)||u.port||u.username||u.password)fail('UNSAFE_REDIRECT','认证跳转到未支持的地址，已停止。');return u;}
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
 return activities.map(a=>{if(!Number.isInteger(a.weekday)||a.weekday<1||a.weekday>7||!Number.isInteger(a.startUnit)||!Number.isInteger(a.endUnit)||a.startUnit<1||a.endUnit<a.startUnit||!Array.isArray(a.weekIndexes))fail('SCHEMA_CHANGED','课程时间数据不兼容。');return {name:String(a.courseName||'未命名课程'),teachers:Array.isArray(a.teachers)?a.teachers.map(String):[],room:String(a.room||'地点待定'),day:a.weekday,start:a.startUnit,end:a.endUnit,weeks:a.weekIndexes.map(w=>Number(w)-(a.weekday===7?1:0)).filter(w=>w>0)};});
}
export class FudanClient {
 constructor(){this.jar=new CookieJar();}
 async request(input,options={},depth=0){
  if(depth>12)fail('REDIRECT_LOOP','认证跳转次数过多。');const url=safeUrl(input);let res;
  try {res=await fetch(url,{...options,redirect:'manual',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'Mozilla/5.0 fdudash/0.1',...options.headers,Cookie:await this.jar.getCookieString(url.href)}});}catch{fail('NETWORK','无法连接复旦服务，请检查校园网络或 VPN。');}
  for(const cookie of res.headers.getSetCookie())await this.jar.setCookie(cookie,url.href);
  if([301,302,303,307,308].includes(res.status)&&res.headers.has('location')){
   const next=new URL(res.headers.get('location'),url);const keep=[307,308].includes(res.status);
   if(keep&&options.body&&next.origin!==url.origin)fail('UNSAFE_REDIRECT','已阻止跨站转发认证内容。');
   return this.request(next,keep?options:{},depth+1);
  }
  if(!res.ok)fail('UPSTREAM',`校园服务暂不可用（HTTP ${res.status}）。`);
  return {url:url.href,text:await res.text()};
 }
 async json(url,body){const r=await this.request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});try{return JSON.parse(r.text);}catch{fail('SCHEMA_CHANGED','认证系统返回了未知格式。');}}
 ticket(html){const $=load(html),action=$('#logon').attr('action'),ticket=$('#ticket').attr('value');if(!action||!ticket)return null;const u=safeUrl(new URL(action,ID));u.searchParams.set('ticket',ticket);return u;}
 async login(username,password,serviceUrl=TABLE){
  const finish=()=>serviceUrl===TABLE?this.getSemesters():this.request(serviceUrl);
  const first=await this.request(serviceUrl);
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
  const ticket=this.ticket(engine.text);if(!ticket)fail('SCHEMA_CHANGED','未取得校园服务登录票据。');await this.request(ticket);return finish();
 }
 async getSemesters(){const r=await this.request(TABLE);if(new URL(r.url).hostname!=='fdjwgl.fudan.edu.cn')fail('EXPIRED','校园会话已失效，请重新登录。');return semesters(r.text);}
 async timetable(id){if(!/^\d{1,12}$/.test(id))fail('INPUT','学期编号无效。');const r=await this.request(`${TABLE}/semester/${id}/print-data`);if(new URL(r.url).hostname!=='fdjwgl.fudan.edu.cn')fail('EXPIRED','校园会话已失效，请重新登录。');let data;try{data=JSON.parse(r.text);}catch{fail('SCHEMA_CHANGED','学校未返回课表 JSON。');}return courses(data);}
 async elearning(){
  const entry=await this.request('https://elearning.fudan.edu.cn/dash');
  if(new URL(entry.url).hostname!=='elearning.fudan.edu.cn'){
   const ticket=this.ticket(entry.text);if(ticket)await this.request(ticket);else fail('ELEARNING_LOGIN','eLearning 需要单独建立 UIS 服务会话。');
  }
  const result=await this.request('https://elearning.fudan.edu.cn/api/v1/courses?enrollment_state=active&per_page=100');
  if(new URL(result.url).hostname!=='elearning.fudan.edu.cn')fail('ELEARNING_LOGIN','eLearning 会话未建立。');
  let data;try{data=JSON.parse(result.text);}catch{fail('ELEARNING_UNSUPPORTED','已到达 eLearning，但尚未取得课程接口的有效响应。');}
  if(!Array.isArray(data))fail('ELEARNING_UNSUPPORTED','eLearning 未返回可读取的课程列表。');
  return {accessible:true,courses:data.filter(c=>c.name).map(c=>({id:String(c.id),name:String(c.name),code:String(c.course_code||'')})),limited:data.length>=100};
 }

}
