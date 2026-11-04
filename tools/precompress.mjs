import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {brotliCompressSync,gzipSync,constants} from 'node:zlib';
async function visit(root){for(const f of await readdir(root,{withFileTypes:true})){
 const p=join(root,f.name);if(f.isDirectory()){await visit(p);continue;}
 if(!/\.(?:html|js|css)$/.test(f.name))continue;
 const data=await readFile(p);await writeFile(p+'.br',brotliCompressSync(data,{params:{[constants.BROTLI_PARAM_QUALITY]:9}}));await writeFile(p+'.gz',gzipSync(data,{level:9}));
}}
await visit('dist');
