import {test} from 'node:test';
import assert from 'node:assert/strict';
import {layoutWeek,weekRange,teachingWeek} from '../public/schedule.js';
const course=(name,start,end,weeks=[1])=>({name,start,end,weeks,day:1,room:'测试教室',teachers:[]});
test('different teaching weeks never share a visible course slot',()=>{
 const items=[course('第一周',1,2,[1]),course('第二周',1,2,[2])];assert.deepEqual(layoutWeek(items,1).map(c=>c.name),['第一周']);assert.deepEqual(layoutWeek(items,2).map(c=>c.name),['第二周']);assert.equal(layoutWeek(items,3).length,0);
});
test('duplicate activities merge and transitive conflicts have disjoint lanes',()=>{
 const items=[course('A',1,2),course('A',1,2),course('B',2,4),course('C',3,5),course('D',6,7)];const result=layoutWeek(items,1);assert.equal(result.length,4);assert.equal(result.find(c=>c.name==='D').lanes,1);
 for(const a of result)for(const b of result)if(a!==b&&a.start<=b.end&&b.start<=a.end){assert.notEqual(a.lane,b.lane);assert.equal(a.lanes,b.lanes);}
 assert.equal(items[0].lane,undefined);
});
test('Sunday-based semester dates become Monday weeks in Shanghai time',()=>{
 assert.deepEqual(weekRange('2026-09-06',1),['2026-09-07','2026-09-13']);assert.deepEqual(weekRange('2026-09-06',2),['2026-09-14','2026-09-20']);assert.equal(teachingWeek('2026-09-06',Date.parse('2026-09-14T00:00:00+08:00')),2);assert.equal(teachingWeek('2026-09-06',Date.parse('2026-09-13T23:59:59+08:00')),1);assert.deepEqual(weekRange('2026-09-07',1),['2026-09-07','2026-09-13']);assert.equal(weekRange(null,1),null);
});
