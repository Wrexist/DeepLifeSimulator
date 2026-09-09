import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const packRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function serve(port=0){return new Promise(resolve=>{const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const file=path.resolve(packRoot,'.'+(pathname==='/'?'/source/index.html':pathname));
 if(!file.startsWith(packRoot+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
 });server.listen(port,'127.0.0.1',()=>resolve(server));});}
