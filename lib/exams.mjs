import {load} from 'cheerio';
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
export function parseExams(html){
 const $=load(html);if(!$('table.exam-table').length)throw Error('EXAM_SCHEMA');const result=[];
 $('table.exam-table tbody tr:not(.tr-empty)').each((index,row)=>{
  const cells=$(row).children('td').toArray();if(cells.length<3)return;
  const timeCell=cells.find(c=>$(c).find('.time').length)||cells.find(c=>/\d{4}-\d{2}-\d{2}/.test($(c).text()));if(!timeCell)return;
  const courseCell=cells.find(c=>$(c).hasClass('table-mobile-card-header'))||cells.find(c=>c!==timeCell&&/[A-Z]{2,}\d{3,}/.test($(c).text()))||cells.find(c=>c!==timeCell);
  const spans=$(courseCell).find('div').first().find('span').toArray(),name=clean($(spans[0]).text())||clean($(courseCell).text()),code=clean($(spans[1]).text());
  const timeText=clean($(timeCell).find('.time').text())||clean($(timeCell).text()),date=timeText.match(/\d{4}-\d{2}-\d{2}/)?.[0]||null,times=timeText.match(/\d{1,2}:\d{2}/g)||[];
  const dedicatedLocation=cells.find(c=>c!==courseCell&&c!==timeCell&&$(c).find('span').length>=2),location=dedicatedLocation?clean($(dedicatedLocation).text()):clean($(timeCell).find('span').eq(2).text());
  const extra=clean($(courseCell).find('div').eq(1).text()),type=extra||clean($(spans[2]).text()).replace(/^[（(]|[）)]$/g,''),noteCell=cells.find(c=>c!==courseCell&&c!==timeCell&&c!==dedicatedLocation);
  result.push({name,code,type,date,time:times.length?times.join('–'):null,startAt:date&&times[0]?`${date}T${times[0].padStart(5,'0')}:00+08:00`:null,endAt:date&&times[1]?`${date}T${times[1].padStart(5,'0')}:00+08:00`:null,location:location||null,note:noteCell?clean($(noteCell).text()):'',finished:$(row).attr('data-finished')==='true'});
 });return result.sort((a,b)=>(Date.parse(a.startAt)||Infinity)-(Date.parse(b.startAt)||Infinity));
}

// Read only the arrangements tab; signup, payment and printing actions are never invoked.
export function parseLevelExams(html){
 const $=load(html),table=$('#examSignup table');
 const headers=table.find('thead th').map((i,e)=>clean($(e).text())).get();
 if(table.length!==1||!['学期','科目','考试时间','考试地点','准考证打印','考试须知'].every((h,i)=>headers[i]===h))throw Error('LEVEL_EXAM_SCHEMA');
 const result=[];
 table.find('tbody tr').each((i,row)=>{
  const cells=$(row).children('td');
  if(cells.length===1&&/暂无数据/.test(cells.text()))return;
  if(cells.length<6)throw Error('LEVEL_EXAM_SCHEMA');
  const term=clean(cells.eq(0).text()),name=clean(cells.eq(1).text()),time=clean(cells.eq(2).text()),location=clean(cells.eq(3).text());
  if(!name)throw Error('LEVEL_EXAM_SCHEMA');
  const dates=[...time.matchAll(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?/g)].map(m=>`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`),times=time.match(/\d{1,2}:\d{2}/g)||[];
  if(times.some(t=>Number(t.split(':')[0])>23||Number(t.split(':')[1])>59))throw Error('LEVEL_EXAM_SCHEMA');
  const startAt=dates[0]&&times[0]?`${dates[0]}T${times[0].padStart(5,'0')}:00+08:00`:null;
  const endAt=startAt&&times[1]?`${dates[1]||dates[0]}T${times[1].padStart(5,'0')}:00+08:00`:null;
  if(startAt&&(!Number.isFinite(Date.parse(startAt))||(endAt&&Date.parse(endAt)<Date.parse(startAt))))throw Error('LEVEL_EXAM_SCHEMA');
  result.push({name,code:'',type:'水平测试',source:'level',term,date:dates[0]||null,time:time||null,startAt,endAt,location:location||null,note:clean(cells.eq(5).text()),finished:false,url:'https://fdjwgl.fudan.edu.cn/student/for-std/level-exam-signup#examSignup'});
 });
 if(!table.find('tbody').length)throw Error('LEVEL_EXAM_SCHEMA');
 return result;
}
