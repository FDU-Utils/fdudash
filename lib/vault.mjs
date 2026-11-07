import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,rename,unlink,chmod,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {CampusError} from './fudan.mjs';
const directory=join(homedir(),'.local','share','fdudash','credentials');
const powershell=process.platform==='win32'?'powershell.exe':'/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
export async function protect(input,decrypt=false){
 const operation=decrypt?'Unprotect':'Protect';
 const script=`$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; [Console]::InputEncoding=[Text.Encoding]::UTF8; [Console]::OutputEncoding=[Text.Encoding]::UTF8; $raw=[Console]::In.ReadToEnd(); $bytes=[Convert]::FromBase64String($raw); $out=[Security.Cryptography.ProtectedData]::${operation}($bytes,[Text.Encoding]::UTF8.GetBytes('fdudash-v1'),[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($out));`;
 return new Promise((resolve,reject)=>{const child=spawn(powershell,['-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{stdio:['pipe','pipe','pipe'],windowsHide:true});let output='',failed=false;
 const timeout=setTimeout(()=>{child.kill();failed=true;reject(new CampusError('VAULT','本机加密服务超时，未保存明文。'));},15000);
 child.stdout.on('data',chunk=>{output+=chunk;if(output.length>32768){failed=true;child.kill();}});child.stderr.resume();child.on('error',()=>{clearTimeout(timeout);reject(new CampusError('VAULT','无法使用 Windows 本机加密服务，未保存明文。'));});child.on('close',code=>{clearTimeout(timeout);if(code||failed)reject(new CampusError('VAULT','本机凭据加解密失败，请重新登录或取消记住账号。'));else resolve(Buffer.from(output.trim().replace(/^\uFEFF/,''),'base64'));});child.stdin.on('error',()=>{});child.stdin.end(Buffer.from(input).toString('base64'));
 });
}
function path(id){if(!/^[a-f0-9]{64}$/.test(id))throw new CampusError('VAULT','本机账号标识无效。');return join(directory,`${id}.bin`);}
export const vault={
 async has(id){try{return (await stat(path(id))).isFile();}catch(e){if(e.code==='ENOENT')return false;throw e;}},
 async save(id,credentials){const encrypted=await protect(JSON.stringify(credentials));await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700);const file=path(id),temporary=`${file}.tmp`;try{await writeFile(temporary,encrypted,{mode:0o600});await chmod(temporary,0o600);await rename(temporary,file);}finally{await unlink(temporary).catch(()=>{});}},
 async load(id){try{return JSON.parse((await protect(await readFile(path(id)),true)).toString('utf8'));}catch(e){if(e.code==='ENOENT')return null;throw new CampusError('VAULT','无法解锁已保存账号，请忘记账号后重新登录。');}},
 async forget(id){try{await unlink(path(id));}catch(e){if(e.code!=='ENOENT')throw e;}}
};

const profileDirectory=join(homedir(),'.local','share','fdudash','profiles');
function profilePath(id){path(id);return join(profileDirectory,`${id}.bin`);}
export const profileCache={
 async load(id){try{return JSON.parse((await protect(await readFile(profilePath(id)),true)).toString('utf8'));}catch(e){if(e.code==='ENOENT')return null;throw new CampusError('VAULT','无法读取本机姓名缓存。');}},
 async save(id,profile){const encrypted=await protect(JSON.stringify(profile));await mkdir(profileDirectory,{recursive:true,mode:0o700});await chmod(profileDirectory,0o700);const file=profilePath(id),temp=`${file}.tmp`;try{await writeFile(temp,encrypted,{mode:0o600});await chmod(temp,0o600);await rename(temp,file);}finally{await unlink(temp).catch(()=>{});}},
 async forget(id){try{await unlink(profilePath(id));}catch(e){if(e.code!=='ENOENT')throw e;}}
};
