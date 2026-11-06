const timestamp=value=>{const n=Date.parse(value);return Number.isFinite(n)?n:null;};
export const pendingAssignments=course=>(course.assignments||[]).filter(a=>!a.completed&&!a.informational);
export function sortAssignments(items){return [...items].sort((a,b)=>(timestamp(a.dueAt)??Infinity)-(timestamp(b.dueAt)??Infinity)||a.name.localeCompare(b.name));}
export function sortCourses(courses){return [...courses].sort((a,b)=>{
 const ap=pendingAssignments(a),bp=pendingAssignments(b),ab=ap.length?0:a.error?1:2,bb=bp.length?0:b.error?1:2;if(ab!==bb)return ab-bb;
 if(ab===0){const deadline=x=>Math.min(...x.map(t=>timestamp(t.dueAt)??Infinity));const diff=deadline(ap)-deadline(bp);if(diff)return diff;}
 return (timestamp(b.createdAt)??-Infinity)-(timestamp(a.createdAt)??-Infinity)||a.name.localeCompare(b.name);
});}

export function moduleTaskCount(course,module){if(module.id==='assignments')return pendingAssignments(course).length;if(module.id==='quizzes')return pendingAssignments(course).filter(a=>a.quizId!=null).length;if(module.id==='modules')return (module.data?.items||[]).reduce((total,g)=>total+(g.items||[]).filter(i=>i.completed===false).length,0);return 0;}

export function sortCompletedAssignments(items){return [...items].sort((a,b)=>(timestamp(b.dueAt)??timestamp(b.submittedAt)??-Infinity)-(timestamp(a.dueAt)??timestamp(a.submittedAt)??-Infinity)||a.name.localeCompare(b.name));}
