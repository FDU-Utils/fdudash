import {execFileSync} from 'node:child_process';import {readFileSync} from 'node:fs';
const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean),blocked=[];
const privatePath=/^(?:docs|work|private|cache|\.cache|node_modules)\/|(?:\.sqlite(?:3)?|\.db|\.har|\.bin|\.pem|\.key|\.log)$|(?:^|\/)(?:\.env(?:\..*)?|cookies[^/]*\.json|session[^/]*\.json|profile[^/]*\.json|[^/]*history[^/]*\.json|[^/]*metrics[^/]*\.json)$/i;
const secret=/(?:gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
for(const path of paths){if(privatePath.test(path)){blocked.push(path);continue;}if(!/\.(?:png|jpe?g|webp|ico|woff2?)$/i.test(path)){const text=execFileSync('git',['show',':'+path],{encoding:'utf8',maxBuffer:5*1024*1024});if(secret.test(text))blocked.push(path);}}
if(blocked.length){console.error('Public export check blocked these paths: '+blocked.join(', '));process.exit(1);}console.log(`Public export check passed (${paths.length} tracked files; no private paths or recognized secret tokens).`);
