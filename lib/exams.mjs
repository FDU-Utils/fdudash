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
