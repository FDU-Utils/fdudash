import {reservationInfo} from './reservations.mjs';
import {load} from 'cheerio';
import {CampusError} from './fudan.mjs';
export const buildings=[['H2','邯郸','二教'],['H3','邯郸','三教'],['H4','邯郸','四教'],['H5','邯郸','五教'],['H6','邯郸','六教'],['HGD','邯郸','光华东'],['HGX','邯郸','光华西'],['OPTICS','邯郸','兴业光学楼'],['PSYCH','邯郸','心理学实验室'],['MEDIA','邯郸','新媒体中心'],['IMP','邯郸','现代物理研究所'],['XIANGHUI','邯郸','相辉堂'],['HQOrHX','邯郸','新闻'],['JA','江湾','JA'],['JB','江湾','JB'],['Z2','张江','二教'],['F1','枫林','一教'],['F2','枫林','二教'],['FHL','枫林','护理楼'],['FKQ','枫林','口腔楼'],['FJJOrF继','枫林','继续教育楼'],['FMDL-1LBGTOrFMDL-2LBGTOrFMDL-2LDGNTOrFSYL-2LBGTOrFTYG-dgnt','枫林','报告厅'],['HYCZX413OrHCL1-304OrHWLL243OrHGXLB201OrHGXLA304OrHYJL512','邯郸','实验楼'],['H元·创中心303OrH元·创中心413OrH元·创中心512OrH元·创中心513OrH光学楼A304OrH光学楼A305OrH光学楼C305','邯郸','机房']].map(([id,campus,name])=>({id,campus,name,...({OPTICS:{source:'HGX',prefixes:['H兴业光学楼','H光学楼']},HGD:{prefixes:['HGD','H光华楼东辅楼','东辅楼']},FHL:{prefixes:['FHL','F护理学院']},PSYCH:{source:'HX',prefixes:['H心理学实验室']},MEDIA:{source:'HX',prefixes:['H新媒体中心','HQ新媒体中心']},IMP:{source:'HX',prefixes:['H现代物理研究所']},XIANGHUI:{source:'HX',prefixes:['H相辉堂']}}[id]||{})}));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
export function parseRooms(status,html){
 // The legacy status response embeds device fields and scripts that are not valid JSON.
 // Read only adjacent room identity fields; never evaluate the surrounding script.
 const statusStart=status.search(/"status"\s*:\s*\[/);if(statusStart<0)throw new CampusError('SCHEMA_CHANGED','教室列表格式不兼容。');
 const roomFields=[...status.slice(statusStart).matchAll(/(?:[,{])\s*"id"\s*:\s*"?(\d+)"?\s*,\s*"room"\s*:\s*"((?:\\.|[^"\\])*)"/g)];
 let rooms;try{rooms=roomFields.map(match=>({id:match[1],room:JSON.parse('"'+match[2]+'"')}));}catch{throw new CampusError('SCHEMA_CHANGED','教室列表格式不兼容。');}
 if((!rooms.length&&!/"status"\s*:\s*\[\s*\]/.test(status))||rooms.length>2000)throw new CampusError('SCHEMA_CHANGED','教室列表格式不兼容。');
 const unique=[...new Map(rooms.map(room=>[String(room.id),room])).values()],positions=unique.map(room=>({room,start:html.indexOf(`"c${room.id}"`)})).sort((a,b)=>a.start-b.start);
 if(unique.length&&!positions.some(item=>item.start>=0))throw new CampusError('SCHEMA_CHANGED','教室课表格式不兼容。');
 return positions.map(({room,start},index)=>{
  if(!/^\d+$/.test(String(room.id))||!room.room)throw new CampusError('SCHEMA_CHANGED','教室标识无效。');
  const following=positions.slice(index+1).find(item=>item.start>start),tail=html.indexOf('innerHTML',start),end=following?.start??(tail>start?tail:html.length);
  if(start<0)return {id:String(room.id),name:clean(room.room),capacity:null,slots:[],scheduleUnavailable:true};
  const segment=html.slice(start,end),matches=[...segment.matchAll(/<td style="background-color.*?>(.*?)<\/td>/g)];
  if(matches.length!==14)return {id:String(room.id),name:clean(room.room),capacity:null,slots:[],scheduleUnavailable:true};
  const slots=matches.map((match,index)=>{const text=clean(load(match[1]).text());return {period:index+1,busy:!!text,detail:text};});
  return {id:String(room.id),name:clean(room.room),capacity:Number(segment.match(/>(\d+)</)?.[1])||null,slots};
 });
}
export function selectedBuildings(value){const ids=Array.isArray(value)?value:value==='all'?buildings.map(b=>b.id):String(value||'').startsWith('campus:')?buildings.filter(b=>b.campus===value.slice(7)).map(b=>b.id):String(value||'').split(',');const unique=[...new Set(ids)].sort();if(!unique.length||unique.length>buildings.length||unique.some(id=>!buildings.some(b=>b.id===id)))throw new CampusError('INPUT','教学楼或校区无效。');return unique;}
const roomName=value=>String(value||'').normalize('NFKC').replace(/\s+/g,'').replace(/^H兴业光学楼/,'H光学楼').toUpperCase();
export function roomInBuilding(room,building){const name=roomName(room.name);return (building.prefixes||building.id.split('Or')).some(prefix=>name.startsWith(roomName(prefix)));}
export function scopedRooms(rooms,ids){const selected=buildings.filter(b=>ids.includes(b.id)),seen=new Set();return rooms.filter(room=>selected.some(b=>roomInBuilding(room,b))).filter(room=>{if(seen.has(room.id))return false;seen.add(room.id);return true;}).map(room=>{const candidates=buildings.filter(b=>roomInBuilding(room,b));const physical=candidates.find(b=>b.prefixes)||candidates.find(b=>!b.id.includes('Or'))||candidates[0];return {...room,campus:physical?.campus||'',building:physical?.name||'',buildingId:physical?.id||'',reservation:reservationInfo(room,candidates)};});}
const cache=new Map(),sourceCache=new Map();let directOfflineUntil=0;
async function readBuilding(source,date,proxyRead){
 const key=source+'/'+date,cached=sourceCache.get(key);if(cached&&Date.now()-cached.time<120000)return cached.data;
 const request=async path=>{let response;try{response=await fetch('http://10.64.130.6'+path,{signal:AbortSignal.timeout(8000),redirect:'error'});}catch{throw new CampusError('NETWORK','校内教室服务暂时无法连接，请检查校园网或 VPN。');}if(!response.ok)throw new CampusError('NETWORK','校内教室服务暂时无法连接，请检查校园网或 VPN。');const text=await response.text();if(Buffer.byteLength(text)>5*1024*1024)throw new CampusError('SCHEMA_CHANGED','教室数据超出读取上限。');return text;};
 const query=new URLSearchParams({b:source,day:date});let status,html,via='direct';
 if(proxyRead&&Date.now()<directOfflineUntil){via='webvpn';status=await proxyRead('/daystatus.asp?'+query);html=await proxyRead('/?'+query);}else try{[status,html]=await Promise.all([request('/daystatus.asp?'+query),request('/?'+query)]);}catch(error){if(error.code!=='NETWORK'||!proxyRead)throw error;directOfflineUntil=Date.now()+60000;via='webvpn';status=await proxyRead('/daystatus.asp?'+query);html=await proxyRead('/?'+query);}
 if(/检测到SQL注入危险/.test(status)||/检测到SQL注入危险/.test(html))throw new CampusError('UPSTREAM_FILTER','校方暂未接受此楼宇的查询，未将其显示为空闲。');
 const data={rooms:parseRooms(status,html),via};if(sourceCache.size>=40)sourceCache.delete(sourceCache.keys().next().value);sourceCache.set(key,{time:Date.now(),data});return data;
}
export async function loadClassrooms(building,date,proxyRead){
 const ids=selectedBuildings(building);if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new CampusError('INPUT','教学楼或日期无效。');
 const key=ids.join(',')+'/'+date,existing=cache.get(key);if(existing&&Date.now()-existing.time<(existing.data.errors?.length?15000:120000))return {...existing.data,cached:true};
 // Use documented per-building requests rather than sending a long OR expression to the legacy server.
 const sources=[...new Set(ids.flatMap(id=>(buildings.find(b=>b.id===id).source||id).split('Or')))],responses=[],errors=[];let cursor=0;
 const worker=async()=>{while(cursor<sources.length){const source=sources[cursor++];try{responses.push(await readBuilding(source,date,proxyRead));}catch(error){errors.push({source,labels:ids.filter(id=>(buildings.find(b=>b.id===id).source||id).split('Or').includes(source)).map(id=>{const b=buildings.find(b=>b.id===id);return b.campus+' · '+b.name;}),buildings:ids.filter(id=>(buildings.find(b=>b.id===id).source||id).split('Or').includes(source)),code:error.code||'INTERNAL',message:error instanceof CampusError?error.message:'教室数据暂时无法读取。'});}}};await Promise.all([worker(),worker()]);
 if(!responses.length)throw new CampusError(errors[0]?.code||'NETWORK',errors[0]?.message||'教室数据暂时无法读取。');
 const data={building:ids.join(','),buildings:ids,date,via:responses.some(r=>r.via==='webvpn')?'webvpn':'direct',rooms:scopedRooms(responses.flatMap(r=>r.rooms),ids),errors,loadedAt:new Date().toISOString(),source:'http://10.64.130.6/'};if(cache.size>=30)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),data});return data;
}
