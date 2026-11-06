export const periodTimes=[['08:00','08:45'],['08:55','09:40'],['09:55','10:40'],['10:50','11:35'],['11:45','12:30'],['13:30','14:15'],['14:25','15:10'],['15:25','16:10'],['16:20','17:05'],['17:15','18:00'],['18:30','19:15'],['19:25','20:10'],['20:20','21:05'],['21:15','22:00']];
import {t,formatDate} from './i18n.js';
const el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls;if(text!=null)e.textContent=t(text);return e;};
export const freeDuring=(room,from,to)=>room.slots.filter(s=>s.period>=from&&s.period<=to).length===to-from+1&&room.slots.filter(s=>s.period>=from&&s.period<=to).every(s=>!s.busy);
export function renderRooms(root,result,{from=1,to=2,onlyFree=true,query=''}={}){
 root.replaceChildren();if(from>to){root.append(el('p','widget-error',t('起始节次不能晚于结束节次。')));return;}
 const rooms=result.rooms.filter(r=>(!onlyFree||freeDuring(r,from,to))&&(!query||(r.name+' '+r.slots.map(s=>s.detail).join(' ')).toLowerCase().includes(query.toLowerCase())));
 root.append(el('p','module-note',`${rooms.length} / ${result.rooms.length} · ${t('读取于')} ${formatDate(result.loadedAt)}`));
 if(!rooms.length)root.append(el('p','module-note','所选时间段没有连续空闲的教室。'));
 for(const room of rooms){const details=el('details','room-card'),summary=el('summary',''),badge=el('span','task-remaining',freeDuring(room,from,to)?'连续空闲':'占用');summary.append(el('strong','',room.name),el('span','',`${room.capacity??'—'} ${t('座位')}`),badge);details.append(summary);const grid=el('div','room-schedule');for(const slot of room.slots){const row=el('div',`room-period ${slot.busy?'occupied':'free'}`);row.append(el('strong','',`${slot.period} · ${periodTimes[slot.period-1].join('–')}`),el('span','',slot.detail||'空闲'));grid.append(row);}details.append(grid);root.append(details);}
 root.append(el('p','module-note','数据来自在线课表；空闲不代表允许进入或已开放。'));
}
