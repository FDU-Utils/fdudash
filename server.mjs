import {localBridge,parseWebOrigins} from './lib/device-bridge.mjs';
import {chaoxingAction,forgetChaoxing} from './lib/chaoxing.mjs';
import {vpnClassroomRead} from './lib/webvpn.mjs';
import {loadClassrooms,buildings} from './lib/classrooms.mjs';
import {courseCore,courseNavigation,courseModuleData} from './lib/elearning.mjs';
import {acquireSession} from './lib/session-queue.mjs';
import {loadWeather} from './lib/weather.mjs';
import {loadLinks} from './lib/links.mjs';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {FudanClient,CampusError} from './lib/fudan.mjs';
import {vault,profileCache} from './lib/vault.mjs';
import {restoreProfile,dashboardData,readCampus,elearningBundle,withService,sessionExams} from './lib/dashboard.mjs';
const port=Number(process.env.PORT||5173),origin=`http://127.0.0.1:${port}`;
const hosted = process.env.FDUDASH_HOSTED === '1';
const desktop = process.env.FDUDASH_DESKTOP === '1';
const webOrigins = hosted ? parseWebOrigins(process.env.FDUDASH_WEB_ORIGIN) : [origin];
if (!webOrigins.length) throw Error('Hosted mode requires an HTTPS website origin');
let bridgeConfig={};try{bridgeConfig=JSON.parse(await readFile(new URL('./connector-config.json',import.meta.url),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const bridge=(hosted||desktop)?null:localBridge(parseWebOrigins(process.env.FDUDASH_WEB_ORIGINS||bridgeConfig.webOrigins?.join(',')||''),process.env.FDUDASH_DEVICE_DIR);await bridge?.ready;
const sessions=new Map();const ttl=30*60*1000;
setInterval(()=>{for(const [key,s] of sessions)if(Date.now()-s.time>ttl)sessions.delete(key);},60000).unref();
const paths={'/transport.js':['transport.js','text/javascript'],'/bridge-ui.js':['bridge-ui.js','text/javascript'],'/connect':['connect.html','text/html'],'/chaoxing-cards.js':['chaoxing-cards.js','text/javascript'],'/chaoxing-view.js':['chaoxing-view.js','text/javascript'],'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/schedule.js':['schedule.js','text/javascript'],'/course-order.js':['course-order.js','text/javascript'],'/course-cards.js':['course-cards.js','text/javascript'],'/i18n.js':['i18n.js','text/javascript'],'/time.js':['time.js','text/javascript'],'/dashboard-view.js':['dashboard-view.js','text/javascript'],'/weather-view.js':['weather-view.js','text/javascript'],'/links-view.js':['links-view.js','text/javascript'],'/latin.js':['latin.js','text/javascript'],'/traditional.js':['traditional.js','text/javascript'],'/classrooms.js':['classrooms.js','text/javascript'],'/assets/fudan-emblem.png':['assets/fudan-emblem.png','image/png']};
function respond(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8192)throw new CampusError('INPUT','请求过大。');}try{return JSON.parse(text);}catch{throw new CampusError('INPUT','请求格式错误。');}}
const server=http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 if(req.headers.host!==`127.0.0.1:${port}`){respond(res,403,{message:'请使用本机 127.0.0.1 地址。'});return;}
 const url=new URL(req.url,origin);if(desktop&&url.pathname==='/desktop/health'){if(req.method!=='GET'||!process.env.FDUDASH_DESKTOP_TOKEN||req.headers['x-fdudash-desktop']!==process.env.FDUDASH_DESKTOP_TOKEN){respond(res,403,{});return;}res.end('ready');return;}if(!bridge&&url.pathname.startsWith('/bridge/')){respond(res,404,{});return;}let deviceId=null;const requestOrigin=req.headers.origin,isRemote=!!requestOrigin&&!webOrigins.includes(requestOrigin);
 try{
 if(isRemote){if(!bridge?.accepts(requestOrigin)){respond(res,403,{message:'不允许跨站请求。'});return;}res.setHeader('Access-Control-Allow-Origin',requestOrigin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type,X-CSRF-Token,X-FDUDash-Device');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Expose-Headers','X-FDUDash-Device-Expired');if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}if(url.pathname==='/bridge/pair'&&req.method==='POST'){try{respond(res,200,await bridge.pair((await body(req)).code,requestOrigin));}catch{respond(res,403,{message:'配对码无效、已过期或尝试过于频繁。'});}return;}deviceId=await bridge.authenticate(String(req.headers['x-fdudash-device']||''),requestOrigin);if(!deviceId){res.setHeader('X-FDUDash-Device-Expired','1');respond(res,401,{message:'请重新配对本机连接器。'});return;}if(!url.pathname.startsWith('/api/')){respond(res,403,{});return;}}
 if(hosted&&!url.pathname.startsWith('/api/')){respond(res,404,{});return;}
 if(!isRemote&&url.pathname==='/bridge/health'&&req.method==='GET'){respond(res,200,{service:'fdudash-connector',shutdown:true,origins:[...bridge.origins]});return;}
 if(!isRemote&&['/bridge/code','/bridge/revoke','/bridge/stop'].includes(url.pathname)){const id=(req.headers.cookie||'').match(/(?:^|;\s*)fdudash=([a-f0-9]{64})(?:;|$)/)?.[1],session=id&&sessions.get(id);if(!session||!session.csrf||req.headers['x-csrf-token']!==session.csrf){respond(res,403,{});return;}if(url.pathname==='/bridge/code'&&req.method==='GET'){respond(res,200,await bridge.code(id));return;}if(url.pathname==='/bridge/revoke'&&req.method==='POST'){await bridge.revoke(id);respond(res,200,{ok:true});return;}if(url.pathname==='/bridge/stop'&&req.method==='POST'){res.once('finish',()=>{setImmediate(()=>{server.close(()=>process.exit(0));server.closeIdleConnections();setTimeout(()=>{server.closeAllConnections();process.exit(0);},2000).unref();});});respond(res,202,{ok:true,stopping:true});return;}respond(res,405,{});return;}

 if(paths[url.pathname]&&req.method==='GET'){const [file,type]=paths[url.pathname];if(type.startsWith('image/'))res.setHeader('Cache-Control','public, max-age=86400');res.writeHead(200,{'Content-Type':type.startsWith('image/')?type:`${type}; charset=utf-8`});res.end(await readFile(new URL(`./public/${file}`,import.meta.url)));return;}
 if(!url.pathname.startsWith('/api/')){respond(res,404,{message:'未找到页面。'});return;}
 if(isRemote&&!deviceId){respond(res,403,{message:'不允许跨站请求。'});return;}
 const cookie=deviceId||(req.headers.cookie||'').match(/(?:^|;\s*)fdudash=([a-f0-9]{64})(?:;|$)/)?.[1];let session=cookie&&sessions.get(cookie);
 if(session&&Date.now()-session.time>ttl){sessions.delete(cookie);session=null;}
 if(url.pathname==='/api/session'&&req.method==='GET'){
  if(!session){if(hosted&&sessions.size>=512){respond(res,503,{message:'服务器会话已满，请稍后重试。'});return;}const id=(!hosted&&cookie)||randomBytes(32).toString('hex');session={id,hosted,csrf:randomBytes(32).toString('hex'),time:Date.now(),client:null};sessions.set(id,session);if(hosted)res.setHeader('Set-Cookie',`fdudash=${id}; HttpOnly; Secure; SameSite=Strict; Path=/api`);else if(!isRemote)res.setHeader('Set-Cookie',`fdudash=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`);}
  session.time=Date.now();
  respond(res,200,{csrf:session.csrf,authenticated:!!session.client,profile:session.client?session.profile||null:null,hasSaved:!hosted&&await vault.has(session.id)});return;
 }
 if(!session){respond(res,401,{message:'本机会话已过期，请刷新页面。'});return;}
 const token=Buffer.from(String(req.headers['x-csrf-token']||'')),expected=Buffer.from(session.csrf);
 if(token.length!==expected.length||!timingSafeEqual(token,expected)){respond(res,403,{message:'请求校验失败，请刷新页面。'});return;}
 session.time=Date.now();
 const release=await acquireSession(session);
 try{
 if(res.destroyed)return;
 if(sessions.get(session.id)!==session){respond(res,401,{message:'本机会话已过期，请刷新页面。'});return;}
 session.time=Date.now();
 if(url.pathname==='/api/logout'&&req.method==='POST'){await forgetChaoxing(session);if(!hosted){await profileCache.forget(session.id);await vault.forget(session.id);}delete session.credentials;session.profile=null;session.accountKey=null;session.client=null;session.courseIds=null;session.dashboardCache=null;session.todoCache=null;session.learningCourses=null;session.examCache=null;session.homeWidgets=null;session.serviceAuthErrors=null;session.serviceAuth=null;respond(res,200,{ok:true});return;}
 if(['/api/login','/api/restore'].includes(url.pathname)&&req.method==='POST'){
  if(hosted)await forgetChaoxing(session);
  const restoring=url.pathname==='/api/restore';
  const data=restoring?(hosted?null:await vault.load(session.id)):await body(req);if(!data)throw new CampusError('VAULT','没有已保存账号，请重新登录。');if(typeof data.username!=='string'||!/^\d{5,20}$/.test(data.username)||typeof data.password!=='string'||!data.password||data.password.length>256)throw new CampusError('INPUT','请输入有效学号和密码。');
  session.dashboardCache=null;session.todoCache=null;session.learningCourses=null;session.examCache=null;session.homeWidgets=null;session.serviceAuthErrors=null;session.serviceAuth=null;session.client=null;session.courseIds=null;delete session.credentials;const client=new FudanClient(),profileReady=restoreProfile(session,data.username);let bundle,warning;try{bundle=await client.login(data.username,data.password);if(hosted){session.credentials={username:data.username,password:data.password};}else if(!restoring){try{if(data.remember)await vault.save(session.id,{username:data.username,password:data.password});else await vault.forget(session.id);}catch{warning='已登录，但加密保存失败，下次需要重新输入。';}}}finally{data.password='';}session.client=client;await profileReady;respond(res,200,{...bundle,warning,profile:session.profile});return;
 }
 if(url.pathname==='/api/weather'&&req.method==='GET'){respond(res,200,await loadWeather(url.searchParams.get('force')==='1'));return;}
 if(url.pathname==='/api/links'&&req.method==='GET'){respond(res,200,await loadLinks());return;}
 if(url.pathname==='/api/classrooms/buildings'&&req.method==='GET'){respond(res,200,{buildings});return;}
 if(url.pathname==='/api/classrooms'&&req.method==='GET'){respond(res,200,await loadClassrooms(url.searchParams.get('building'),url.searchParams.get('date'),session.client?path=>withService(session,'https://webvpn.fudan.edu.cn/login?cas_login=true',client=>vpnClassroomRead(client,path)):undefined));return;}
 if(url.pathname==='/api/chaoxing/logout'&&req.method==='POST'){await forgetChaoxing(session);respond(res,200,{ok:true});return;}
 if(url.pathname.startsWith('/api/chaoxing/')&&req.method==='POST'){const action=url.pathname.split('/').pop();if(!['courses','start','status','qr','core','module','folder','file'].includes(action)){respond(res,404,{});return;}const result=await chaoxingAction(session,action,url.searchParams.get('force')==='1',url.searchParams);if(result.download){res.writeHead(200,{'Content-Type':result.type,'Content-Disposition':'attachment'});res.end(result.download);}else if(action==='qr'){res.writeHead(200,{'Content-Type':result.type});res.end(result.image);}else respond(res,200,result);return;}
 if(!session.client){respond(res,401,{message:'请先登录 UIS。'});return;}
 if(url.pathname==='/api/elearning'&&req.method==='POST'){respond(res,200,await courseCore(session,url.searchParams.get('force')==='1'));return;}
 if(url.pathname==='/api/elearning/navigation'&&req.method==='GET'){respond(res,200,await courseNavigation(session,url.searchParams.get('course')));return;}
 if(url.pathname==='/api/elearning/module'&&req.method==='GET'){respond(res,200,await courseModuleData(session,url.searchParams.get('course'),url.searchParams.get('module')));return;}
 if(url.pathname==='/api/elearning/file'&&req.method==='GET'){
  const course=url.searchParams.get('course'),file=url.searchParams.get('file');if(!session.courseIds?.has(course))throw new CampusError('INPUT','请先加载此账号的课程。');
  const result=await session.client.downloadFile(course,file);const safeType=/^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/plain)$/.test(result.type)?result.type:'application/octet-stream';
  res.writeHead(200,{'Content-Type':safeType,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(result.name)}`});res.end(result.bytes);return;
 }
 if(url.pathname==='/api/elearning/page'&&req.method==='GET'){
  const course=url.searchParams.get('course'),slug=url.searchParams.get('slug');if(!session.courseIds?.has(course)||!slug||slug.length>300)throw new CampusError('INPUT','课程页面地址无效。');
  respond(res,200,await session.client.coursePage(course,slug));return;
 }
 if(url.pathname==='/api/dashboard'&&req.method==='GET'){
  const holiday=url.searchParams.get('holiday')==='1',cached=session.dashboardCache,force=url.searchParams.get('force')==='1',reuse=!force&&cached&&cached.holiday===holiday&&Date.now()-cached.time<10000,stream=url.searchParams.get('stream')==='1';
  const send=value=>{if(!res.destroyed)res.write(JSON.stringify(value)+'\n');};
  if(stream){res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'});res.flushHeaders();send({type:'snapshot',data:reuse?cached.data:{profile:session.profile||null}});}
  try{const data=reuse?cached.data:await dashboardData(session,holiday,force,stream?(key,value)=>send({type:'widget',key,value}):undefined);if(!reuse)session.dashboardCache={holiday,data,time:Date.now()};if(stream){send({type:'done',profile:data.profile,loadedAt:data.loadedAt});res.end();}else respond(res,200,data);}catch(error){if(!stream)throw error;send({type:'error',code:error.code||'INTERNAL',message:'首页读取中断，请刷新重试。'});res.end();}return;
 }
 if(url.pathname==='/api/campus'&&req.method==='GET'){respond(res,200,await readCampus(session,url.searchParams.get('service'),url.searchParams.get('holiday')==='1'));return;}
 if(url.pathname==='/api/exams'&&req.method==='GET'){respond(res,200,await sessionExams(session,url.searchParams.get('force')==='1'));return;}
 if(url.pathname==='/api/semesters'  &&req.method==='GET'){respond(res,200,await session.client.getSemesters());return;}
 if(url.pathname==='/api/timetable'&&req.method==='GET'){respond(res,200,{courses:await session.client.timetable(url.searchParams.get('semester')||'')});return;}
 respond(res,404,{message:'接口不存在。'});
 }finally{release();}
 }catch(error){if(error.code==='EXPIRED'){/* UI asks the user to authenticate again. */}respond(res,error instanceof CampusError?400:500,{code:error instanceof CampusError?error.code:'INTERNAL',message:error instanceof CampusError?error.message:'本机服务处理失败，未记录认证信息。'});}
}).listen(port,'127.0.0.1',()=>console.log(`fdudash: ${origin} (local only; local encrypted credential storage)`));
