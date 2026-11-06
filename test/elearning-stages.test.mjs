import {test} from 'node:test';import assert from 'node:assert/strict';import {courseCore,courseNavigation,courseModuleData} from '../lib/elearning.mjs';
test('core reuses homepage assignments and modules load only after navigation',async()=>{
 const calls=[],course={id:'42',name:'Synthetic',createdAt:'2026-01-01',assignments:[{id:'1',completed:false}]};const session={todoCache:{time:Date.now(),data:{courses:[course]}},client:{canvasList:async()=>[{id:'assignments',label:'Assignments',html_url:'https://elearning.fudan.edu.cn/courses/42/assignments'},{id:'files',label:'Files',html_url:'https://elearning.fudan.edu.cn/courses/42/files'}],courseModule:async(c,m)=>{calls.push(m.id);return {items:[]};}}};
 const core=await courseCore(session);assert.equal(core.staged,true);assert.equal(core.courses[0].assignments[0].id,'1');assert.deepEqual(calls,[]);
 const nav=await courseNavigation(session,'42');assert.ok(nav.modules.find(m=>m.id==='files').pending);assert.deepEqual(calls,['assignments']);
 await courseModuleData(session,'42','files');await courseModuleData(session,'42','files');assert.deepEqual(calls,['assignments','files']);await assert.rejects(courseModuleData(session,'43','files'));
});
