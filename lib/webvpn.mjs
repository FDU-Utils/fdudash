import {createCipheriv} from 'node:crypto';import {CampusError} from './fudan.mjs';
// The gateway hostname encoding is a routing format, not a credential or secret.
export function classroomProxy(path){
 if(!/^\/(?:\?|daystatus\.asp\?)/.test(path))throw new CampusError('INPUT','无效的教室查询路径。');
 const key=Buffer.from('wrdvpnisthebest!'),cipher=createCipheriv('aes-128-cfb',key,key),host=key.toString('hex')+Buffer.concat([cipher.update('10.64.130.6','utf8'),cipher.final()]).toString('hex');
 return 'https://webvpn.fudan.edu.cn/http/'+host+path;
}
export async function vpnClassroomRead(client,path){
 const target=classroomProxy(path),result=await client.request(target),url=new URL(result.url);
 if(url.hostname!=='webvpn.fudan.edu.cn'||!url.pathname.startsWith(new URL(target).pathname.split('/').slice(0,3).join('/')+'/'))throw new CampusError('SERVICE_LOGIN','此校园服务需要独立登录，请先在本机记住账号。');
 return result.text;
}
