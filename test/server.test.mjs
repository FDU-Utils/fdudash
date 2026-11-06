import http from 'node:http';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('local server protects sessions, CSRF, host and cross-origin access',async()=>{
 const proc=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'15173'},stdio:['ignore','pipe','pipe']});
 try{await Promise.race([once(proc.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(Error('startup timeout')),60000).unref())]);const base='http://127.0.0.1:15173';
 const page=await fetch(base);assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 const first=await fetch(base+'/api/session');const cookie=first.headers.get('set-cookie').split(';')[0];const s=await first.json();assert.equal(s.authenticated,false);assert.equal(s.csrf.length,64);
 assert.equal((await fetch(base+'/api/login',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/session',{headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal(await new Promise((resolve,reject)=>{http.get(base,{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);}),403);
 const invalid=await fetch(base+'/api/login',{method:'POST',headers:{Cookie:cookie,'X-CSRF-Token':s.csrf,'Content-Type':'application/json'},body:'{}'});assert.equal((await invalid.json()).code,'INPUT');
 assert.equal((await fetch(base+'/api/timetable?semester=42',{headers:{Cookie:cookie,'X-CSRF-Token':s.csrf}})).status,401);
 // Hold the first request body open to reproduce overlapping tabs deterministically.
 const headers={Cookie:cookie,'X-CSRF-Token':s.csrf,'Content-Type':'application/json'};
 let finishFirst;
 const firstPending=new Promise((resolve,reject)=>{
  const request=http.request(base+'/api/login',{method:'POST',headers},response=>{response.resume();resolve(response.statusCode);});
  request.on('error',reject);request.flushHeaders();request.write('{');finishFirst=()=>request.end('}');
 });
 await new Promise(resolve=>setTimeout(resolve,30));
 let secondFinished=false;
 const secondPending=fetch(base+'/api/timetable?semester=42',{headers}).then(response=>{secondFinished=true;return response.status;});
 try{await new Promise(resolve=>setTimeout(resolve,50));assert.equal(secondFinished,false);}finally{finishFirst();}
 assert.equal(await firstPending,400);assert.equal(await secondPending,401);
 const other=await fetch(base+'/api/session');assert.notEqual(other.headers.get('set-cookie').split(';')[0],cookie);
 }finally{proc.kill();await once(proc,'exit');}
});
