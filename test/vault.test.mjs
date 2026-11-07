import {existsSync} from 'node:fs';
const supportsDPAPI=process.platform==='win32'||existsSync('/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe');
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {protect,vault,profileCache} from '../lib/vault.mjs';
test('DPAPI encrypts, restores and forgets a synthetic local credential',{skip:!supportsDPAPI},async()=>{
 const id=randomBytes(32).toString('hex'),value={username:'00000000',password:'synthetic-vault-test-only'};
 try{await vault.save(id,value);assert.equal(await vault.has(id),true);const file=join(homedir(),'.local/share/fdudash/credentials',`${id}.bin`);const encrypted=await readFile(file);assert.equal(encrypted.includes(Buffer.from(value.password)),false);if(process.platform!=='win32')assert.equal((await stat(file)).mode&0o777,0o600);assert.deepEqual(await vault.load(id),value);await assert.rejects(protect(Buffer.from('tampered'),true));await vault.forget(id);assert.equal(await vault.has(id),false);}finally{await vault.forget(id);}
});

test('synthetic name cache is encrypted and can be forgotten',{skip:!supportsDPAPI},async()=>{const id=randomBytes(32).toString('hex'),value={accountKey:'synthetic-account',name:'Synthetic Name'};try{await profileCache.save(id,value);const raw=await readFile(join(homedir(),'.local/share/fdudash/profiles',`${id}.bin`));assert.equal(raw.includes(Buffer.from(value.name)),false);assert.deepEqual(await profileCache.load(id),value);await profileCache.forget(id);assert.equal(await profileCache.load(id),null);}finally{await profileCache.forget(id);}});
