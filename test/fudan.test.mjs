import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,privateDecrypt,constants} from 'node:crypto';
import {FudanClient,semesters,courses,safeUrl,TABLE} from '../lib/fudan.mjs';
const html=`<select id="allSemesters"><option value="42">秋</option></select><script>var semesters = JSON.parse('[{"id":42,"name":"2026 秋","startDate":"2026-09-06"}]');</script>`;
test('semester parsing preserves school default and start date',()=>{assert.deepEqual(semesters(html),{semesters:[{id:'42',name:'2026 秋',startDate:'2026-09-06'}],defaultId:'42'});assert.throws(()=>semesters('login page'),/未找到学期/);});
test('courses handle Sunday offset, blank teachers, empty semester and invalid schema',()=>{const a={weekday:7,startUnit:3,endUnit:4,weekIndexes:[1,2,3],courseName:'测试',room:null,teachers:[]};assert.deepEqual(courses({studentTableVms:[{activities:[a]}]})[0].weeks,[1,2]);assert.equal(courses({studentTableVms:[{activities:[]}]}).length,0);assert.throws(()=>courses({}),/格式/);assert.throws(()=>courses({studentTableVms:[{activities:[{...a,weekday:9}]}]}),/时间/);});
test('only supported HTTPS campus destinations are allowed',()=>{for(const url of ['http://id.fudan.edu.cn','https://evil.example','https://id.fudan.edu.cn.evil.example','https://user:pass@id.fudan.edu.cn','https://id.fudan.edu.cn:8443'])assert.throws(()=>safeUrl(url));assert.equal(safeUrl(TABLE).hostname,'fdjwgl.fudan.edu.cn');});
test('complete UIS flow encrypts password, stores cookies and reads timetable',{concurrency:false},async()=>{
 const original=globalThis.fetch;const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});const key=publicKey.export({type:'spki',format:'pem'}).toString().replace(/-----[^\n]+-----|\s/g,'');let logged=false,calls=0;
 function response(url,text,headers={}){const r=new Response(text,{headers});Object.defineProperty(r,'url',{value:url.split('#')[0]});return r;}
 globalThis.fetch=async(input,opts)=>{const url=String(input);calls++;
 if(url===TABLE)return logged?response(url,html):response(url,'',{location:'https://id.fudan.edu.cn/idp/authn/#/login?lck=test&entityId=campus'});
 if(url.includes('/idp/authn/#'))return response(url,'<html>登录</html>');
 if(url.endsWith('queryAuthMethods'))return response(url,JSON.stringify({data:[{moduleCode:'userAndPwd',authChainCode:'chain'}]}));
 if(url.endsWith('getJsPublicKey'))return response(url,JSON.stringify({data:key}));
 if(url.endsWith('authExecute')){const data=JSON.parse(opts.body);assert.equal(data.authPara.loginName,'123456');assert.notEqual(data.authPara.password,'test-secret');assert.equal(Buffer.from(data.authPara.password,'base64').length,256);return response(url,JSON.stringify({loginToken:'test-token'}));}
 if(url.endsWith('authnEngine'))return response(url,'<form id="logon" action="https://fdjwgl.fudan.edu.cn/callback"><input id="ticket" value="ST-test"></form>');
 if(url.includes('/callback')){logged=true;return response(url,'ok',{'set-cookie':'session=local-only; Secure; Path=/'});}
 if(url.includes('/print-data')){assert.match(opts.headers.Cookie,/session=local-only/);return response(url,JSON.stringify({studentTableVms:[{activities:[]}]}));}
 throw Error('unexpected request');};
 // Redirect response must have 302 status.
 const mock=globalThis.fetch;globalThis.fetch=async(input,opts)=>{const r=await mock(input,opts);if(r.headers.has('location'))return new Response('',{status:302,headers:r.headers});return r;};
 try{const client=new FudanClient();assert.equal((await client.login('123456','test-secret')).defaultId,'42');assert.deepEqual(await client.timetable('42'),[]);assert.equal(calls,9);assert.equal(await new FudanClient().jar.getCookieString(TABLE),'');}finally{globalThis.fetch=original;}
});
test('interactive authentication stops before submitting credentials',{concurrency:false},async()=>{const c=new FudanClient();let calls=0;c.request=async()=>({url:'https://id.fudan.edu.cn/#/login?lck=x&entityId=y',text:''});c.json=async()=>{calls++;return {second:true};};await assert.rejects(c.login('123456','unused'),e=>e.code==='INTERACTION_REQUIRED');assert.equal(calls,1);});
