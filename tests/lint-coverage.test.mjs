import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {ESLint} from 'eslint';import {RUNTIME_ENTRIES} from '../scripts/build-src-cards.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
test('Every source module receives typed promise lint and unchecked-file bans without per-card exclusions',async()=>{
 const lint=new ESLint({cwd:root});const files=[];
 function scan(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isDirectory())scan(file);else if(file.endsWith('.ts'))files.push(file);}}
 scan(path.join(root,'src'));
 for(const file of files){const config=await lint.calculateConfigForFile(file);assert.ok(config,file+' is ignored');assert.equal(config.rules['@typescript-eslint/no-floating-promises'][0],2,file);assert.equal(config.rules['@typescript-eslint/no-explicit-any'][0],2,file);assert.equal(config.rules['@typescript-eslint/ban-ts-comment'][1]['ts-nocheck'],true,file);assert.equal(config.languageOptions.parserOptions.project,'./tsconfig.json',file);}
 for(const entry of RUNTIME_ENTRIES)assert.ok(files.includes(path.join(root,entry.entry)),entry.outfile+' needs canonical checked source');
});
