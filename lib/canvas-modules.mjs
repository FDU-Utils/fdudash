import {load} from 'cheerio';
const BASE='https://elearning.fudan.edu.cn';
export function publicLink(value,base=BASE){try{const u=new URL(value,base);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;return u.href;}catch{return null;}}
export function richText(html,limit=40000){
 const $=load(String(html||''));$('script,style,iframe,object,embed').remove();$('br').replaceWith('\n');$('p,div,li,h1,h2,h3,h4,tr').append('\n');
 const text=$.root().text().replace(/[\t ]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim();const links=[];
 $('a[href],img[src]').each((i,e)=>{const source=$(e).attr('href')||$(e).attr('src'),url=publicLink(source);if(!url)return;const file=new URL(url).hostname==='elearning.fudan.edu.cn'?new URL(url).pathname.match(/\/files\/(\d+)/)?.[1]:null;links.push({name:$(e).text().trim()||$(e).attr('alt')||($(e).is('img')?'图片附件':'相关资料'),url,fileId:file||null,image:$(e).is('img')});});
 return {text:text.slice(0,limit),truncated:text.length>limit,links:[...new Map(links.map(l=>[l.url,l])).values()]};
}
const labels={assignments:'作业',grades:'分数',files:'文件',announcements:'公告',home:'课程首页',discussions:'讨论',people:'教师与助教',syllabus:'教学大纲',modules:'学习单元',pages:'课程页面',quizzes:'测验',collaborations:'协作',conferences:'会议',outcomes:'学习目标'};
export function availableTabs(tabs,courseId){return tabs.filter(t=>!t.hidden&&!['none','admins'].includes(t.visibility)).map(t=>({id:String(t.id),label:labels[t.id]||String(t.label||t.id),url:publicLink(t.html_url,`${BASE}/courses/${courseId}`),external:t.type==='external'}));}
export function fileInfo(f,folders=new Map()) {return {id:String(f.id),name:String(f.display_name||f.filename||'未命名文件'),size:Number(f.size)||0,type:String(f['content-type']||'application/octet-stream'),updatedAt:f.modified_at||f.updated_at||f.created_at||null,folder:folders.get(String(f.folder_id))||'',locked:!!f.locked_for_user,url:`${BASE}/files/${encodeURIComponent(f.id)}`};}
export function moduleDocument(item){return {id:String(item.id||item.page_id||''),title:String(item.title||item.name||'未命名内容'),date:item.posted_at||item.last_reply_at||item.updated_at||item.created_at||null,url:publicLink(item.html_url),body:richText(item.message||item.body||item.description),unread:item.read_state==='unread',replies:Number(item.discussion_subentry_count)||0};}
export function gradeSummary(enrollments){const e=(enrollments||[]).find(x=>x.type==='student'||x.type==='StudentEnrollment')||(enrollments||[])[0]||{};return {currentScore:e.computed_current_score??e.grades?.current_score??null,finalScore:e.computed_final_score??e.grades?.final_score??null,currentGrade:e.computed_current_letter_grade??e.grades?.current_grade??null};}
