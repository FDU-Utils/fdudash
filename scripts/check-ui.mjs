import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'15174'},stdio:['ignore','pipe','pipe']});
let browser;
try{
 await once(server.stdout,'data');browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:15174');await page.getByRole('button',{name:'查看演示'}).click();await page.getByText('演示 · 高等数学',{exact:true}).waitFor();
 assert.equal(await page.locator('.slot-label').count(),14);assert.match(await page.locator('.slot-label').first().innerText(),/08:00/);assert.match(await page.getByText('演示 · 高等数学',{exact:true}).locator('..').innerText(),/示例教室/);assert.equal(await page.getByText('演示 · 高等数学',{exact:true}).locator('..').evaluate(e=>e.style.gridRow),'2 / 4');await page.locator('#week').selectOption('2');assert.equal(await page.getByText('演示 · 大学英语',{exact:true}).count(),0);assert.equal(await page.getByText('演示 · 高等数学',{exact:true}).count(),0);assert.equal(await page.getByText('演示 · 第二周课程',{exact:true}).count(),1);assert.match(await page.locator('#week-summary').innerText(),/2026-09-14 — 2026-09-20/);await page.getByRole('button',{name:'上一周',exact:true}).click();assert.equal(await page.getByText('演示 · 第二周课程',{exact:true}).count(),0);assert.equal(await page.getByText('演示 · 高等数学',{exact:true}).count(),1);
 await page.locator('#week').selectOption('1');await page.screenshot({path:'work/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'work/mobile.png',fullPage:true});
 await page.route('**/api/session',route=>route.fulfill({json:{csrf:'test',authenticated:true,hasSaved:true}}));
 await page.route('**/api/semesters',route=>route.fulfill({json:{defaultId:'42',semesters:[{id:'42',name:'测试学期',startDate:'2026-09-06'}]}}));
 await page.route('**/api/timetable?*',route=>route.fulfill({json:{courses:[{name:'周次隔离一',day:1,start:1,end:2,weeks:[1],room:'一号教室',teachers:[]},{name:'周次隔离二',day:1,start:1,end:2,weeks:[2],room:'二号教室',teachers:[]}]}}));
 let elearningRequests=0;
 await page.route('**/api/elearning',route=>{elearningRequests++;return route.fulfill({json:{accessible:true,courses:[{id:'42',name:'测试 eLearning 课程',code:'TEST',assignments:[{id:'1',name:'待交作业',dueAt:'2099-01-01T00:00:00Z',completed:false,status:'未提交',url:'https://elearning.fudan.edu.cn/courses/42/assignments/1'},{id:'2',name:'已交作业',completed:true,status:'已完成',url:'https://elearning.fudan.edu.cn/courses/42/assignments/2'}]},{id:'43',name:'空课程',code:'EMPTY',assignments:[]},{id:'44',name:'异常课程',code:'FAIL',assignments:[],error:'模拟权限限制'}]}});});
 await page.reload();await page.locator('#connect-elearning:enabled').waitFor({state:'attached'});await page.locator('#week').selectOption('1');await page.getByText('周次隔离一',{exact:true}).waitFor();assert.equal(await page.getByText('周次隔离二',{exact:true}).count(),0);await page.getByRole('button',{name:'下一周',exact:true}).click();await page.getByText('周次隔离二',{exact:true}).waitFor();assert.equal(await page.getByText('周次隔离一',{exact:true}).count(),0);
 assert.equal(elearningRequests,0);await page.getByRole('link',{name:'eLearning 作业'}).click();await page.getByRole('link',{name:'待交作业',exact:true}).waitFor();assert.equal(elearningRequests,1);assert.equal(await page.locator('#timetable-page').isVisible(),false);assert.equal(await page.getByRole('link',{name:'已交作业',exact:true}).isVisible(),false);assert.equal(await page.locator('.completed-assignments').getAttribute('open'),null);assert.match(await page.locator('#elearning-status').innerText(),/1 门课程读取失败/);await page.locator('.completed-assignments summary').click();assert.equal(await page.getByRole('link',{name:'已交作业',exact:true}).isVisible(),true);
 await page.reload();await page.getByRole('link',{name:'待交作业',exact:true}).waitFor();assert.equal(elearningRequests,2);assert.equal(await page.getByRole('link',{name:'已交作业',exact:true}).isVisible(),false);
 await page.screenshot({path:'work/elearning-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('UI passed: demo, week filtering, desktop/mobile layout, no browser errors.');
}finally{if(browser)await browser.close();server.kill();await once(server,'exit');}
