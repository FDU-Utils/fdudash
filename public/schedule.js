const DAY=86400000;
export function semesterMonday(startDate){
 if(!/^\d{4}-\d{2}-\d{2}/.test(startDate||''))return null;
 const day=new Date(`${startDate.slice(0,10)}T00:00:00Z`);if(!Number.isFinite(day.getTime()))return null;
 const weekday=day.getUTCDay();day.setUTCDate(day.getUTCDate()+(weekday===0?1:1-weekday));return day;
}
export function teachingWeek(startDate,now=Date.now()){
 const monday=semesterMonday(startDate);if(!monday)return 1;
 return Math.floor((now+8*3600000-monday.getTime())/(7*DAY))+1;
}
export function weekRange(startDate,week){
 const start=semesterMonday(startDate);if(!start)return null;
 start.setUTCDate(start.getUTCDate()+(week-1)*7);const end=new Date(start.getTime()+6*DAY);
 return [start.toISOString().slice(0,10),end.toISOString().slice(0,10)];
}
export function layoutWeek(items,week){
 if(!Number.isInteger(week)||week<1)return [];
 const unique=new Map();
 for(const c of items){
  if(!c.weeks.map(Number).includes(week))continue;
  const identity=c.lessonId?`lesson:${c.lessonId}`:JSON.stringify([c.name,[...c.teachers].sort()]);
  const key=JSON.stringify([identity,c.day,c.start,c.end]),previous=unique.get(key);
  if(previous){previous.rooms=[...new Set([...previous.rooms,c.room].filter(Boolean))];previous.room=previous.rooms.join(' / ');previous.teachers=[...new Set([...previous.teachers,...c.teachers])];}
  else unique.set(key,{...c,teachers:[...c.teachers],rooms:[c.room]});
 }
 const result=[];
 for(let day=1;day<=7;day++){
  const sorted=[...unique.values()].filter(c=>c.day===day).sort((a,b)=>a.start-b.start||a.end-b.end||a.name.localeCompare(b.name));
  let group=[],maxEnd=0;
  function flush(){const laneEnds=[];for(const c of group){let lane=laneEnds.findIndex(end=>end<c.start);if(lane<0)lane=laneEnds.length;laneEnds[lane]=c.end;c.lane=lane;}for(const c of group)result.push({...c,lanes:laneEnds.length});group=[];}
  for(const c of sorted){if(group.length&&c.start>maxEnd){flush();maxEnd=0;}group.push(c);maxEnd=Math.max(maxEnd,c.end);}flush();
 }
 return result;
}
