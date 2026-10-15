import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../website/dist');
const port=Number(process.env.ANIBR_SITE_PORT||5180);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.ttf':'font/ttf','.mp4':'video/mp4','.vtt':'text/vtt; charset=utf-8','.exe':'application/octet-stream'};
http.createServer(async(request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return}
  let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname));if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return}}catch{response.writeHead(400);response.end();return}
  try{const info=await stat(file);if(!info.isFile())throw Error('not a file');const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};let start=0,end=info.size-1,status=200;
    if(request.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(request.headers.range);if(!match){response.writeHead(416,{'Content-Range':`bytes */${info.size}`});response.end();return}start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(start>end||start>=info.size){response.writeHead(416,{'Content-Range':`bytes */${info.size}`});response.end();return}status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`}
    headers['Content-Length']=end-start+1;response.writeHead(status,headers);if(request.method==='HEAD'){response.end();return}createReadStream(file,{start,end}).pipe(response);
  }catch{response.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});response.end('Arquivo não encontrado.')}
}).listen(port,'127.0.0.1',()=>console.log(`AniBR apresentação: http://127.0.0.1:${port}/`));
