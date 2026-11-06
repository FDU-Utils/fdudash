import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {FudanClient,CampusError} from './lib/fudan.mjs';
import {vault} from './lib/vault.mjs';
const port=Number(process.env.PORT||5173),origin=`http://127.0.0.1:${port}`;
const sessions=new Map();const ttl=30*60*1000;
setInterval(()=>{for(const [key,s] of sessions)if(Date.now()-s.time>ttl)sessions.delete(key);},60000).unref();
const paths={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/schedule.js':['schedule.js','text/javascript'],'/course-order.js':['course-order.js','text/javascript'],'/course-cards.js':['course-cards.js','text/javascript']};
function respond(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8192)throw new CampusError('INPUT','请求过大。');}try{return JSON.parse(text);}catch{throw new CampusError('INPUT','请求格式错误。');}}
http.createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 if(req.headers.host!==`127.0.0.1:${port}`){respond(res,403,{message:'请使用本机 127.0.0.1 地址。'});return;}
 const url=new URL(req.url,origin);
 try{
 if(paths[url.pathname]&&req.method==='GET'){const [file,type]=paths[url.pathname];res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`});res.end(await readFile(new URL(`./public/${file}`,import.meta.url)));return;}
 if(!url.pathname.startsWith('/api/')){respond(res,404,{message:'未找到页面。'});return;}
 if(req.headers.origin&&req.headers.origin!==origin){respond(res,403,{message:'不允许跨站请求。'});return;}
 const cookie=(req.headers.cookie||'').match(/(?:^|;\s*)fdudash=([a-f0-9]{64})(?:;|$)/)?.[1];let session=cookie&&sessions.get(cookie);
 if(session&&Date.now()-session.time>ttl){sessions.delete(cookie);session=null;}
 if(url.pathname==='/api/session'&&req.method==='GET'){
  if(!session){const id=cookie||randomBytes(32).toString('hex');session={id,csrf:randomBytes(32).toString('hex'),time:Date.now(),client:null,busy:false};sessions.set(id,session);res.setHeader('Set-Cookie',`fdudash=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000`);}
  respond(res,200,{csrf:session.csrf,authenticated:!!session.client,hasSaved:await vault.has(session.id)});return;
 }
 if(!session){respond(res,401,{message:'本机会话已过期，请刷新页面。'});return;}
 const token=Buffer.from(String(req.headers['x-csrf-token']||'')),expected=Buffer.from(session.csrf);
 if(token.length!==expected.length||!timingSafeEqual(token,expected)){respond(res,403,{message:'请求校验失败，请刷新页面。'});return;}
 session.time=Date.now();
 if(url.pathname==='/api/logout'&&req.method==='POST'){if(session.busy){respond(res,409,{message:'请等待当前请求完成再退出。'});return;}await vault.forget(session.id);session.client=null;session.courseIds=null;respond(res,200,{ok:true});return;}
 if(session.busy){respond(res,409,{message:'上一个请求仍在进行。'});return;}
 session.busy=true;
 try{
 if(['/api/login','/api/restore'].includes(url.pathname)&&req.method==='POST'){
  const restoring=url.pathname==='/api/restore';
  const data=restoring?await vault.load(session.id):await body(req);if(!data)throw new CampusError('VAULT','没有已保存账号，请重新登录。');if(typeof data.username!=='string'||!/^\d{5,20}$/.test(data.username)||typeof data.password!=='string'||!data.password||data.password.length>256)throw new CampusError('INPUT','请输入有效学号和密码。');
  session.client=null;session.courseIds=null;const client=new FudanClient();let bundle,warning;try{bundle=await client.login(data.username,data.password);if(!restoring){try{if(data.remember)await vault.save(session.id,{username:data.username,password:data.password});else await vault.forget(session.id);}catch{warning='已登录，但加密保存失败，下次需要重新输入。';}}}finally{data.password='';}session.client=client;respond(res,200,{...bundle,warning});return;
 }
 if(!session.client){respond(res,401,{message:'请先登录 UIS。'});return;}
 if(url.pathname==='/api/elearning'&&req.method==='POST'){
  let result;try{result=await session.client.elearning();}catch(error){
   if(error.code!=='ELEARNING_LOGIN')throw error;
   const info=await vault.load(session.id);if(!info)throw new CampusError('ELEARNING_LOGIN','请勾选记住账号并重新登录，以建立 eLearning 服务会话。');
   try{await session.client.login(info.username,info.password,'https://elearning.fudan.edu.cn/dash');}finally{info.password='';}
   result=await session.client.elearning();
  }session.courseIds=new Set(result.courses.map(c=>c.id));respond(res,200,await session.client.elearningDashboard(result));return;
 }
 if(url.pathname==='/api/elearning/file'&&req.method==='GET'){
  const course=url.searchParams.get('course'),file=url.searchParams.get('file');if(!session.courseIds?.has(course))throw new CampusError('INPUT','请先加载此账号的课程。');
  const result=await session.client.downloadFile(course,file);const safeType=/^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/plain)$/.test(result.type)?result.type:'application/octet-stream';
  res.writeHead(200,{'Content-Type':safeType,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(result.name)}`});res.end(result.bytes);return;
 }
 if(url.pathname==='/api/elearning/page'&&req.method==='GET'){
  const course=url.searchParams.get('course'),slug=url.searchParams.get('slug');if(!session.courseIds?.has(course)||!slug||slug.length>300)throw new CampusError('INPUT','课程页面地址无效。');
  respond(res,200,await session.client.coursePage(course,slug));return;
 }
 if(url.pathname==='/api/semesters'  &&req.method==='GET'){respond(res,200,await session.client.getSemesters());return;}
 if(url.pathname==='/api/timetable'&&req.method==='GET'){respond(res,200,{courses:await session.client.timetable(url.searchParams.get('semester')||'')});return;}
 respond(res,404,{message:'接口不存在。'});
 }finally{session.busy=false;}
 }catch(error){if(error.code==='EXPIRED'){/* UI asks the user to authenticate again. */}respond(res,error instanceof CampusError?400:500,{code:error instanceof CampusError?error.code:'INTERNAL',message:error instanceof CampusError?error.message:'本机服务处理失败，未记录认证信息。'});}
}).listen(port,'127.0.0.1',()=>console.log(`fdudash: ${origin} (local only; local encrypted credential storage)`));
