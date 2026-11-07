import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {once} from 'node:events';import {createServer} from 'node:net';
test('desktop serves local UI without exposing connector routes',async()=>{
 const listener=createServer();listener.listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port),FDUDASH_DESKTOP:'1',FDUDASH_HOSTED:'0',FDUDASH_DESKTOP_TOKEN:'synthetic-desktop-token'},stdio:['ignore','pipe','pipe']});const exited=once(child,'exit');
 try{await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Startup timeout')),60000).unref())]);const base='http://127.0.0.1:'+port;
 assert.equal((await fetch(base+'/desktop/health')).status,403);
 assert.equal(await fetch(base+'/desktop/health',{headers:{'X-FDUDash-Desktop':'synthetic-desktop-token'}}).then(r=>r.text()),'ready');
 assert.equal((await fetch(base+'/bridge/health')).status,404);
 assert.equal((await fetch(base+'/bridge/pair',{method:'POST',headers:{Origin:'https://example.com'}})).status,404);
 assert.equal((await fetch(base+'/api/session',{headers:{Origin:'https://example.com'}})).status,403);
 assert.match(await fetch(base+'/').then(r=>r.text()),/FDUDash/i);
 const session=await fetch(base+'/api/session').then(r=>r.json());assert.equal(session.authenticated,false);assert.equal(session.csrf.length,64);
 }finally{child.kill();await exited;}
});
