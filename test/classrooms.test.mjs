import {classroomProxy,vpnClassroomRead} from '../lib/webvpn.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';import {parseRooms,loadClassrooms} from '../lib/classrooms.mjs';import {freeDuring} from '../public/classrooms.js';
const status='{"status":[{"id":"1","room":"TEST101"}]}';
const html='"c1"><td>60</td>'+Array.from({length:14},(_,i)=>`<td style="background-color:white">${i===2?'模拟课程':''}</td>`).join('')+'innerHTML';
test('room parser retains all 14 periods, capacity and useful course information',()=>{const [room]=parseRooms(status,html);assert.equal(room.capacity,60);assert.equal(room.slots.length,14);assert.equal(room.slots[2].detail,'模拟课程');assert.equal(freeDuring(room,1,2),true);assert.equal(freeDuring(room,1,4),false);assert.equal(freeDuring(room,13,14),true);assert.throws(()=>parseRooms(status,'changed page'));});
test('room query validates fixed buildings and calendar dates before requesting',async()=>{await assert.rejects(loadClassrooms('http://evil.example','2026-11-06'));await assert.rejects(loadClassrooms('HGX','2026-02-30'));});

test('WebVPN route is fixed to the classroom host and detects expired authentication',async()=>{assert.match(classroomProxy('/?b=HGX&day=2026-11-06'),/^https:\/\/webvpn\.fudan\.edu\.cn\/http\//);assert.throws(()=>classroomProxy('https://evil.example'));await assert.rejects(vpnClassroomRead({request:async()=>({url:'https://webvpn.fudan.edu.cn/login',text:''})},'/?b=HGX'),e=>e.code==='SERVICE_LOGIN');});
