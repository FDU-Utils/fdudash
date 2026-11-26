import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),out=new URL('../dist/web/',import.meta.url),origin=process.env.WEB_ORIGIN;
if(!origin||new URL(origin).protocol!=='https:'||new URL(origin).origin!==origin)throw Error('WEB_ORIGIN must be an exact HTTPS origin');
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Release builds run in GitHub Actions');
await mkdir(out,{recursive:true});await cp(new URL('public/',root),out,{recursive:true,filter:src=>!['connect.html','bridge-ui.js'].includes(src.split(/[\\/]/).pop())});let html=await readFile(new URL('index.html',out),'utf8');html=html.replace('src="/app.js"','src="/bootstrap.js"');if(['fdudash.aminiam.com','47.116.178.249'].includes(new URL(origin).hostname)){
 const footer='<footer class="site-registration" data-preserve-text><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">苏ICP备2026089130号-1</a><a href="https://beian.mps.gov.cn/#/query/webSearch?code=31010902101712" target="_blank" rel="noopener noreferrer">沪公网安备31010902101712号</a></footer>';
 if(!html.includes('</main>'))throw Error('Website footer insertion point missing');
 html=html.replace('</main>',footer+'</main>');
 const cssFile=new URL('style.css',out);
 const css=await readFile(cssFile,'utf8');
 await writeFile(cssFile,css+'\n.layout>main>.site-registration{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:4px 16px;margin:24px 0 0;padding:12px 0 0;font-size:12px;line-height:1.7;color:#65748a}.site-registration a{color:inherit;text-decoration:none}.site-registration a:hover,.site-registration a:focus-visible{text-decoration:underline}\n');
}
await writeFile(new URL('index.html',out),html);await writeFile(new URL('deployment.json',out),JSON.stringify({mode:'cloud',version:process.env.GITHUB_SHA,siteOrigin:origin,agentOrigin:'http://127.0.0.1:5173',downloadURL:'/downloads/fdudash-connector-windows-x64.zip'}));await cp(new URL('LICENSE',root),new URL('LICENSE',out));console.log('Static website artifact prepared.');
