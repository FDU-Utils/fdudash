import {loadWeather} from './weather.mjs';
import {createHash} from 'node:crypto';
import {CampusError} from './fudan.mjs';
import {vault,profileCache} from './vault.mjs';
import {CAMPUS,campusCard,campusElectricity,campusBus,campusNotices} from './campus.mjs';
const failure=error=>({error:error instanceof CampusError?error.message:'校园服务暂时无法读取。',code:error.code||'INTERNAL'});
export async function restoreProfile(session,username){session.accountKey=createHash('sha256').update(username).digest('hex');session.profile=null;try{const cached=await profileCache.load(session.id);if(cached?.accountKey===session.accountKey&&cached.name)session.profile={name:cached.name,cached:true};else if(cached)await profileCache.forget(session.id);}catch{/* A broken name cache must not block sign-in. */}}
export async function rememberName(session,value){if(session.profile?.name)return session.profile;const name=String(value||'').trim();if(!name||name.length>120)return null;let cached=false;try{await profileCache.save(session.id,{accountKey:session.accountKey,name});cached=true;}catch{}session.profile={name,cached};return session.profile;}
export async function withService(session,url,read){try{return await read(session.client);}catch(error){if(!['SERVICE_LOGIN','ELEARNING_LOGIN'].includes(error.code))throw error;const info=await vault.load(session.id);if(!info)throw new CampusError('SERVICE_LOGIN','此校园服务需要独立登录，请先在本机记住账号。');try{await session.client.login(info.username,info.password,url);}finally{info.password='';}return read(session.client);}}
export async function elearningBundle(session){return withService(session,'https://elearning.fudan.edu.cn/dash',client=>client.elearning());}
export async function todoCourses(session){const bundle=await elearningBundle(session),courses=new Array(bundle.courses.length);let cursor=0;const worker=async()=>{while(cursor<bundle.courses.length){const index=cursor++,course=bundle.courses[index];try{courses[index]={id:course.id,name:course.name,assignments:await session.client.courseAssignments(course.id)};}catch(error){courses[index]={id:course.id,name:course.name,assignments:[],...failure(error)};}}};await Promise.all([worker(),worker()]);if(!session.profile?.name){try{const profile=await session.client.canvasObject('/api/v1/users/self/profile');await rememberName(session,profile.name||profile.short_name);}catch{/* Keep greeting generic if no verified name is available. */}}return {courses,loadedAt:new Date().toISOString()};}
export async function readCampus(session,key,holiday=false){if(key==='notices')return campusNotices();const readers={ecard:campusCard,electricity:campusElectricity,bus:client=>campusBus(client,holiday)};if(!readers[key])throw new CampusError('INPUT','未知校园服务。');const data=await withService(session,CAMPUS[key],readers[key]);if(key==='ecard')await rememberName(session,data.name);return data;}
export async function dashboardData(session,holiday=false){
 const result={};const weather=loadWeather().then(value=>({value}),error=>({error}));const notices=campusNotices().then(value=>({value}),error=>({error}));
 // Authentication stays sequential so separate services cannot overwrite login state.
 for(const key of ['ecard','electricity','bus']){try{result[key]=await readCampus(session,key,holiday);}catch(error){result[key]=failure(error);}}
 try{result.todo=await todoCourses(session);}catch(error){result.todo=failure(error);}
 const announcement=await notices;result.notices=announcement.error?failure(announcement.error):announcement.value;
 const forecast=await weather;result.weather=forecast.error?failure(forecast.error):forecast.value;result.profile=session.profile||null;result.loadedAt=new Date().toISOString();return result;
}
