import {cp,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
if(process.platform!=='darwin'||process.env.GITHUB_ACTIONS!=='true')throw Error('Build macOS in GitHub Actions');
const root=new URL('../',import.meta.url),out=new URL('../dist/FDUDash.app/Contents/',import.meta.url);
await mkdir(new URL('MacOS/',out),{recursive:true});
await mkdir(new URL('Resources/backend/runtime/',out),{recursive:true});
for(const [source,target] of [['App','FDUDash'],['Vault','vault']]){
 execFileSync('swiftc',['desktop/macos/'+source+'.swift','-parse-as-library',...(source==='Vault'?[]:[]),'-o',new URL('MacOS/'+target,out).pathname],{cwd:root,stdio:'inherit'});
}
const backend=new URL('Resources/backend/',out);
for(const name of ['server.mjs','lib','public','licenses','LICENSE','package.json','package-lock.json','node_modules'])await cp(new URL(name,root),new URL(name,backend),{recursive:true});
await cp(process.execPath,new URL('runtime/node',backend));
const license=await fetch('https://raw.githubusercontent.com/nodejs/node/'+process.version+'/LICENSE');
if(!license.ok)throw Error('Node license unavailable');
await writeFile(new URL('runtime/LICENSE',backend),await license.text());
await writeFile(new URL('Info.plist',out),`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>FDUDash</string><key>CFBundleIdentifier</key><string>org.fdu-utils.fdudash</string><key>CFBundleName</key><string>FDUDash</string><key>CFBundleVersion</key><string>0.1.1</string><key>CFBundleShortVersionString</key><string>0.1.1</string><key>LSMinimumSystemVersion</key><string>13.0</string><key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict></dict></plist>`);
execFileSync('codesign',['--force','--deep','--sign','-','dist/FDUDash.app'],{cwd:root,stdio:'inherit'});
