import {cp,mkdir,writeFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true')throw Error('Build Windows desktop in GitHub Actions');
const root=new URL('../',import.meta.url),out=new URL('../dist/desktop/',import.meta.url);
execFileSync('dotnet',['build','desktop/FDUDash.csproj','-c','Release','-o','dist/desktop-shell'],{cwd:root,stdio:'inherit'});
await mkdir(out,{recursive:true});
await cp(new URL('../dist/desktop-shell/',import.meta.url),out,{recursive:true,filter:p=>!/[\\/](?:x86|arm64|win-x86|win-arm64)(?:[\\/]|$)/.test(p)&&!/[.](?:pdb|xml)$/.test(p)});
const backend=new URL('backend/',out);await mkdir(backend,{recursive:true});
for(const name of ['server.mjs','lib','public','licenses','LICENSE','package.json','package-lock.json','node_modules'])await cp(new URL(name,root),new URL(name,backend),{recursive:true});
await mkdir(new URL('runtime/',backend));await cp(process.execPath,new URL('runtime/node.exe',backend));
const license=await fetch('https://raw.githubusercontent.com/nodejs/node/'+process.version+'/LICENSE');if(!license.ok)throw Error('Node license unavailable');await writeFile(new URL('runtime/LICENSE',backend),await license.text());
await cp(new URL('LICENSE',root),new URL('LICENSE',out));
await writeFile(new URL('README.txt',out),`FDUDash for Windows x64 — portable preview
Extract the complete ZIP, then double-click FDUDash.exe. No WSL, Node installation or connector pairing is needed.
Requires Windows 10 22H2 / Windows 11, .NET Framework 4.8, and Microsoft Edge WebView2 Evergreen Runtime.
If WebView2 is missing, install it from https://developer.microsoft.com/microsoft-edge/webview2/
The app uses the shared WebView2 runtime instead of bundling Chromium. Campus requests run on this PC. Internet access is required.
Closing the window stops the bundled local backend. Only one instance runs per Windows login session.
Remembered accounts use Windows DPAPI for this Windows user. App browser data: %LOCALAPPDATA%/FDUDash/WebView2.
Encrypted account data: %USERPROFILE%/.local/share/fdudash. Sign out and forget accounts inside the app to remove saved credentials.
This preview is not code-signed. Do not disable Windows protection; use your device's normal software approval process if required.
Source and GPL-3.0-or-later license: https://github.com/FDU-Utils/fdudash
Node license is in backend/runtime/LICENSE; other notices are in backend/licenses and dependency directories.
Microsoft WebView2 SDK license: https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.4314.35/License
`);
await writeFile(new URL('version.json',out),JSON.stringify({version:process.env.GITHUB_SHA||'development',platform:'win-x64',runtime:process.version}));
await stat(new URL('FDUDash.exe',out));console.log('Portable Windows desktop package prepared.');
