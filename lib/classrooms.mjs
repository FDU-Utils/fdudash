import {load} from 'cheerio';
import {CampusError} from './fudan.mjs';
export const buildings=[['H2','邯郸','二教'],['H3','邯郸','三教'],['H4','邯郸','四教'],['H5','邯郸','五教'],['H6','邯郸','六教'],['HGD','邯郸','光华东'],['HGX','邯郸','光华西'],['HQOrHX','邯郸','新闻'],['JA','江湾','JA'],['JB','江湾','JB'],['Z2','张江','二教'],['F1','枫林','一教'],['F2','枫林','二教'],['FHL','枫林','护理楼'],['FKQ','枫林','口腔楼']].map(([id,campus,name])=>({id,campus,name}));
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
export function parseRooms(status,html){
 let rooms;try{rooms=JSON.parse(status.match(/"status"\s*:\s*(\[[\s\S]*?\])/)[1]);}catch{throw new CampusError('SCHEMA_CHANGED','教室列表格式不兼容。');}
 if(!Array.isArray(rooms)||rooms.length>1000)throw new CampusError('SCHEMA_CHANGED','教室列表格式不兼容。');
 return rooms.map((room,i)=>{if(!/^\d+$/.test(String(room.id))||!room.room)throw new CampusError('SCHEMA_CHANGED','教室标识无效。');
  const start=html.indexOf(`"c${room.id}"`),end=i+1<rooms.length?html.indexOf(`"r${rooms[i+1].id}"`,start):html.indexOf('innerHTML',start);
  if(start<0||end<=start)throw new CampusError('SCHEMA_CHANGED','教室课表格式不兼容。');
  const segment=html.slice(start,end),$=load(segment),matches=[...segment.matchAll(/<td style="background-color.*?>(.*?)<\/td>/g)];
  if(matches.length!==14)throw new CampusError('SCHEMA_CHANGED','教室节次数据不完整。');
  const slots=matches.map((match,index)=>{const text=clean(load(match[1]).text());return {period:index+1,busy:!!text,detail:text};});
  return {id:String(room.id),name:clean(room.room),capacity:Number(segment.match(/>(\d+)</)?.[1])||null,slots};
 });
}
const cache=new Map();
export async function loadClassrooms(building,date,proxyRead){
 if(!buildings.some(b=>b.id===building)||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new CampusError('INPUT','教学楼或日期无效。');
 const key=building+'/'+date,existing=cache.get(key);if(existing&&Date.now()-existing.time<120000)return {...existing.data,cached:true};
 const request=async path=>{let r;try{r=await fetch('http://10.64.130.6'+path,{signal:AbortSignal.timeout(8000),redirect:'error'});}catch{throw new CampusError('NETWORK','校内教室服务暂时无法连接，请检查校园网或 VPN。');}if(!r.ok)throw new CampusError('NETWORK','校内教室服务暂时无法连接，请检查校园网或 VPN。');const text=await r.text();if(Buffer.byteLength(text)>5*1024*1024)throw new CampusError('SCHEMA_CHANGED','教室数据超出读取上限。');return text;};
 const query=new URLSearchParams({b:building,day:date});let status,html,via='direct';
 try{[status,html]=await Promise.all([request('/daystatus.asp?'+query),request('/?'+query)]);}catch(error){if(error.code!=='NETWORK'||!proxyRead)throw error;via='webvpn';status=await proxyRead('/daystatus.asp?'+query);html=await proxyRead('/?'+query);}

 const data={building,date,via,rooms:parseRooms(status,html),loadedAt:new Date().toISOString(),source:'http://10.64.130.6/'};if(cache.size>=30)cache.delete(cache.keys().next().value);cache.set(key,{time:Date.now(),data});return data;
}
