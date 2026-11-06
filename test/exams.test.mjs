import {FudanClient,CampusError} from '../lib/fudan.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import {parseExams,parseLevelExams} from '../lib/exams.mjs';
test('current academic exam page maps course, dates, location and notes',()=>{const html=`<table class="exam-table"><tbody><tr><td class="table-mobile-card-header"><div><span>模拟考试</span><span>CS99999.01</span><span>期中</span></div></td><td><div class="time">2026-11-12 13:30~15:30</div></td><td><div><span>测试校区</span><span>教学楼</span><span>101</span></div></td><td>带证件</td></tr></tbody></table>`;const [exam]=parseExams(html);assert.equal(exam.name,'模拟考试');assert.equal(exam.type,'期中');assert.equal(exam.startAt,'2026-11-12T13:30:00+08:00');assert.equal(exam.endAt,'2026-11-12T15:30:00+08:00');assert.match(exam.location,/101/);assert.equal(exam.note,'带证件');});
test('empty published schedule and schema failure are distinct',()=>{assert.deepEqual(parseExams('<table class="exam-table"><tbody><tr class="tr-empty"><td>暂无</td></tr></tbody></table>'),[]);assert.throws(()=>parseExams('<html>login</html>'),/EXAM_SCHEMA/);});
test('legacy exam page and finished records remain readable',()=>{const [exam]=parseExams(`<table class="exam-table"><tbody><tr data-finished="true"><td><div class="time">2020-01-01 8:00~9:00</div><span>甲</span><span>乙</span><span>测试地点</span></td><td><div><span>旧课程</span><span>CS12345</span><span>（闭卷）</span></div><div><span>期末</span></div></td><td>旧备注</td><td></td></tr></tbody></table>`);assert.equal(exam.finished,true);assert.equal(exam.type,'期末');assert.equal(exam.location,'测试地点');assert.equal(exam.startAt,'2020-01-01T08:00:00+08:00');});

const levelTable=rows=>`<div id="examSignup"><table><thead><tr>${['学期','科目','考试时间','考试地点','准考证打印','考试须知'].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
test('proficiency arrangements preserve term, time, room and notes without executing actions',()=>{
 const [exam]=parseLevelExams(levelTable('<tr><td>测试学期</td><td>模拟英语水平考试</td><td>2026年11月12日 9:00～11:00</td><td>测试楼101</td><td><button onclick="pay()">打印</button></td><td>带证件</td></tr>'));
 assert.equal(exam.name,'模拟英语水平考试');assert.equal(exam.term,'测试学期');assert.equal(exam.source,'level');assert.equal(exam.startAt,'2026-11-12T09:00:00+08:00');assert.equal(exam.endAt,'2026-11-12T11:00:00+08:00');assert.equal(exam.location,'测试楼101');assert.equal(exam.note,'带证件');assert.ok(!JSON.stringify(exam).includes('pay()'));
});
test('proficiency empty schedule differs from unavailable or changed source',()=>{
 assert.deepEqual(parseLevelExams(levelTable('<tr><td colspan="5">暂无数据</td></tr>')),[]);
 assert.throws(()=>parseLevelExams('<html>login</html>'),/LEVEL_EXAM_SCHEMA/);
 assert.throws(()=>parseLevelExams(levelTable('<tr><td>unexpected</td><td>columns</td></tr>')),/LEVEL_EXAM_SCHEMA/);
 const [pending]=parseLevelExams(levelTable('<tr><td>测试学期</td><td>模拟测试</td><td>待定</td><td></td><td></td><td></td></tr>'));assert.equal(pending.startAt,null);
});

test('exam sources fail independently and merge chronologically',async()=>{
 const client=new FudanClient();client.courseExams=async()=>[{name:'later',startAt:'2099-02-01'}];client.levelExams=async()=>[{name:'earlier',startAt:'2099-01-01'}];
 let result=await client.exams();assert.deepEqual(result.exams.map(e=>e.source),['level','course']);assert.ok(result.sources.every(s=>s.ok));
 client.levelExams=async()=>{throw new CampusError('NETWORK','synthetic source failure');};result=await client.exams();assert.equal(result.exams.length,1);assert.equal(result.sources[1].ok,false);assert.equal(result.sources[1].code,'NETWORK');
});
