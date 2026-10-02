/** Generate lazy locale data; checked lookup lives in src/shared/runtime-i18n-runtime.ts. */
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {buildSourceArtifact} from "./build-src-cards.mjs";
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),"..");
const runtimeDir=path.join(root,"i18n/runtime");
const langs=fs.readdirSync(runtimeDir).filter(file=>file.endsWith(".json")).map(file=>file.slice(0,-5)).sort((a,b)=>a==="en"?-1:b==="en"?1:a.localeCompare(b));
if(!langs.includes("en")) throw new Error("Missing English runtime locale");
const functions=langs.map(lang=>{
  if(!/^[a-z]{2}$/.test(lang)) throw new Error("Invalid runtime locale "+lang);
  const data=JSON.parse(fs.readFileSync(path.join(runtimeDir,lang+".json"),"utf8"));
  return "function locale_"+lang+"()"+(lang==="en"?"":":RuntimeLocale")+" {return "+JSON.stringify(data,null,2)+";}";
});
const output="// Generated locale data by scripts/gen-runtime-i18n.mjs. Do not edit.\n"+
  functions.join("\n")+"\n"+
  "type IndexedLocale<T> = {[K in keyof T]:T[K] extends string?string:IndexedLocale<T[K]>}&([T[keyof T]] extends [string]?Record<string,string|undefined>:Record<string,unknown>);\n"+
  "export type RuntimeLocale=IndexedLocale<ReturnType<typeof locale_en>>;\n"+
  "export const PACK:Record<string,unknown>&{en:RuntimeLocale|(()=>RuntimeLocale)}={"+
  langs.map(lang=>lang+":locale_"+lang).join(",")+"};\n";
fs.writeFileSync(path.join(root,"src/shared/runtime-i18n-data.ts"),output);
await buildSourceArtifact({entry:"src/shared/runtime-i18n-runtime.ts",outfile:"nodalia-i18n.js"});
console.log("Generated checked runtime i18n",langs.length,"locales");
