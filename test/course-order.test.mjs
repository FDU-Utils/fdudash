import {sortModules,defaultModuleId,moduleTaskCount} from '../public/course-order.js';
import {test} from 'node:test';import assert from 'node:assert/strict';

test('course tabs use fixed priority and default assignments or course home',()=>{const modules=['announcements','grades','home','files','assignments','people'].map(id=>({id}));assert.deepEqual(sortModules(modules).map(m=>m.id),['home','assignments','files','grades','announcements','people']);assert.equal(defaultModuleId({modules}),'assignments');assert.equal(defaultModuleId({modules:[{id:'home'}]}),'home');assert.equal(moduleTaskCount({}, {id:'announcements',data:{items:[{unread:true},{unread:false}]}}),1);});
