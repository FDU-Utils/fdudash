import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FudanClient,assignmentInfo,CampusError} from '../lib/fudan.mjs';
const assignment=(submission,extra={})=>({id:1,name:'测试作业',submission_types:['online_upload'],submission,...extra});
test('submitted, graded and excused work complete; missing zero and redo stay pending',()=>{
 for(const submission of [{workflow_state:'submitted'},{workflow_state:'pending_review'},{workflow_state:'graded',score:0,missing:false},{excused:true}])assert.equal(assignmentInfo(assignment(submission),'42').completed,true);
 for(const submission of [{workflow_state:'unsubmitted'},{workflow_state:'graded',score:0,missing:true},{workflow_state:'submitted',submitted_at:'2026-01-01',redo_request:true}])assert.equal(assignmentInfo(assignment(submission),'42').completed,false);
 assert.equal(assignmentInfo(assignment(undefined),'42').unknown,true);assert.equal(assignmentInfo(assignment({workflow_state:'unsubmitted'},{submission_types:['none']}),'42').informational,true);
 assert.equal(assignmentInfo(assignment({workflow_state:'unsubmitted'},{due_at:'2020-01-01'}),'42').completed,false);
});
test('Canvas list follows pagination but rejects off-site links',async()=>{
 const c=new FudanClient();let calls=0;c.request=async(url)=>{calls++;return {url,text:JSON.stringify([{id:calls}]),link:calls===1?'<https://elearning.fudan.edu.cn/api/v1/courses?page=2>; rel="next"':null};};assert.equal((await c.canvasList('/api/v1/courses')).length,2);assert.equal(calls,2);
 c.request=async(url)=>({url,text:'[]',link:'<https://evil.example/api/v1/courses>; rel="next"'});await assert.rejects(c.canvasList('/api/v1/courses'),e=>e.code==='UNSAFE_REDIRECT');
});
test('each course retains independent assignment result or error',async()=>{
 const c=new FudanClient();c.canvasList=async()=>[];c.courseAssignments=async id=>{if(id==='2')throw new CampusError('UPSTREAM','当前课程无权限');return [assignmentInfo(assignment({workflow_state:'submitted'}),id)];};
 const result=await c.elearningDashboard({accessible:true,courses:[{id:'1',name:'甲'},{id:'2',name:'乙'}]});assert.equal(result.courses.find(c=>c.id==='1').assignments[0].completed,true);assert.equal(result.courses.find(c=>c.id==='2').error,'当前课程无权限');
});
