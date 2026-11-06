import {sortModules} from '../public/course-order.js';
import {todoCourses} from './dashboard.mjs';
import {availableTabs} from './canvas-modules.mjs';
import {CampusError} from './fudan.mjs';
export async function courseCore(session,force=false){
 const result=await todoCourses(session,force),previous=session.learningCourses;session.learningCourses=new Map(result.courses.map(c=>[c.id,{...c,modules:previous?.get(c.id)?.modules||[]} ]));session.courseIds=new Set(session.learningCourses.keys());
 return {...result,staged:true,courses:result.courses.map(c=>({...c,modules:[{id:'assignments',label:'作业',data:{assignments:c.assignments}}]}))};
}
export async function courseNavigation(session,id){
 const course=session.learningCourses?.get(id);if(!course)throw new CampusError('INPUT','请先加载此账号的课程。');
 const tabs=availableTabs(await session.client.canvasList(`/api/v1/courses/${id}/tabs`),id);
 if(course.assignments.length&&!tabs.some(t=>t.id==='assignments'))tabs.unshift({id:'assignments',label:'作业'});
 const previous=new Map(course.modules.map(m=>[m.id,m]));course.modules=sortModules(tabs).map(tab=>({...tab,...(previous.get(tab.id)?.data?{data:previous.get(tab.id).data}:{}),...(['assignments','grades','syllabus'].includes(tab.id)?{data:null}:{pending:true})}));
 for(const module of course.modules)if(!module.pending)module.data=await session.client.courseModule(course,module);
 return {modules:course.modules};
}
export async function courseModuleData(session,id,key){
 const course=session.learningCourses?.get(id),module=course?.modules.find(m=>m.id===key);if(!module)throw new CampusError('INPUT','此课程未开放该模块。');
 if(module.pending){module.data=await session.client.courseModule(course,module);module.pending=false;}
 return {data:module.data};
}
