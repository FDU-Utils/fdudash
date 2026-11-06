export function remainingTime(target,now=Date.now()){
 const timestamp=Date.parse(target);if(!Number.isFinite(timestamp))return {state:'unknown'};
 const delta=timestamp-now,minutes=Math.max(1,Math.ceil(Math.abs(delta)/60000));return {state:delta>0?'future':'overdue',minutes,totalHours:Math.floor(minutes/60),days:Math.floor(minutes/1440),hours:Math.floor(minutes%1440/60),remainderMinutes:minutes%60};
}
export function examTiming(exam,now=Date.now()){
 const start=Date.parse(exam.startAt),end=Date.parse(exam.endAt);if(exam.finished||(Number.isFinite(end)&&now>=end))return {state:'finished'};if(!Number.isFinite(start))return {state:'unknown'};
 if(now>=start)return {state:Number.isFinite(end)?'ongoing':'started'};const remaining=remainingTime(exam.startAt,now);return {...remaining,state:remaining.minutes<=60&&start-now<3600000?'soon':'scheduled'};
}
export function dashboardTodos(courses,exams=[],now=Date.now()){const tasks=courses.flatMap(course=>(course.assignments||[]).filter(a=>!a.completed&&!a.informational).map(a=>({...a,courseId:course.id,courseName:course.name,kind:'assignment'})));const upcoming=exams.filter(e=>!e.finished&&(!e.endAt||Date.parse(e.endAt)>now)&&(!e.startAt||e.endAt||Date.parse(e.startAt)>=now)).map(e=>({...e,kind:'exam',dueAt:e.startAt,courseName:e.location||'',url:e.url||'https://fdjwgl.fudan.edu.cn/student/home'}));return [...tasks,...upcoming].sort((a,b)=>(Number.isFinite(Date.parse(a.dueAt))?Date.parse(a.dueAt):Infinity)-(Number.isFinite(Date.parse(b.dueAt))?Date.parse(b.dueAt):Infinity)||a.name.localeCompare(b.name));}
