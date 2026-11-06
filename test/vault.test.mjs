import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {protect,vault} from '../lib/vault.mjs';
test('DPAPI encrypts, restores and forgets a synthetic local credential',async()=>{
 const id=randomBytes(32).toString('hex'),value={username:'00000000',password:'synthetic-vault-test-only'};
 try{await vault.save(id,value);assert.equal(await vault.has(id),true);const file=join(homedir(),'.local/share/fdudash/credentials',`${id}.bin`);const encrypted=await readFile(file);assert.equal(encrypted.includes(Buffer.from(value.password)),false);assert.equal((await stat(file)).mode&0o777,0o600);assert.deepEqual(await vault.load(id),value);await assert.rejects(protect(Buffer.from('tampered'),true));await vault.forget(id);assert.equal(await vault.has(id),false);}finally{await vault.forget(id);}
});
