import {test} from 'node:test';
import assert from 'node:assert/strict';
import {acquireSession} from '../lib/session-queue.mjs';
test('requests wait in order and logout cannot overtake a campus request',async()=>{
 const session={},events=[];
 const release=await acquireSession(session);
 const second=(async()=>{const done=await acquireSession(session);try{events.push('dashboard');}finally{done();}})();
 const third=(async()=>{const done=await acquireSession(session);try{events.push('logout');}finally{done();}})();
 await Promise.resolve();assert.deepEqual(events,[]);
 release();await Promise.all([second,third]);assert.deepEqual(events,['dashboard','logout']);
});
test('a failed operation releases the queue for the next request',async()=>{
 const session={};
 await assert.rejects(async()=>{const release=await acquireSession(session);try{throw Error('synthetic failure');}finally{release();}});
 const release=await acquireSession(session);release();
});
