import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildSync} from 'esbuild';

const source=buildSync({entryPoints:['src/shared/numeric-values.ts'],bundle:true,write:false,format:'iife',globalName:'api'}).outputFiles[0].text;
function load() {
 let constructions=0;
 const box={Intl:{NumberFormat:class extends Intl.NumberFormat {constructor(...args){super(...args);constructions++;}}}};
 vm.createContext(box);vm.runInContext(source,box);
 return {api:box.api,count:()=>constructions};
}

test('Numeric formatting preserves native locale, grouping, zero and bounded decimals',()=>{
 const {api,count}=load();
 for(const absent of [null,undefined,'',' ',false,[],{},Infinity,NaN])assert.equal(api.formatFiniteNumericValue(absent), '--');
 assert.equal(count(),0);
 for(const locale of [undefined,'es','en-US','de','ar','zh'])for(const decimals of [-1,0,1,2,20,21,NaN,Infinity])for(const value of [0,-0,-2.5,1234567.125,'42.25']) {
  const digits=Number.isFinite(decimals)?Math.min(20,Math.max(0,Math.floor(decimals))):0;
  assert.equal(api.formatFiniteNumericValue(value,decimals,locale),Number(value).toLocaleString(locale,{minimumFractionDigits:digits,maximumFractionDigits:digits}));
 }
 assert.throws(()=>api.formatFiniteNumericValue(1,0,'invalid_locale'),RangeError);
});

test('Numeric formatting reuses formatters across updates and bounds locale cache growth',()=>{
 const {api,count}=load();
 for(let i=0;i<1000;i++)api.formatFiniteNumericValue(i/7,1,'es');
 assert.equal(count(),1);
 for(let i=0;i<70;i++)api.formatFiniteNumericValue(i,1,`en-x-test-${i}`);
 assert.equal(count(),71);
 assert.equal(api.formatFiniteNumericValue(0,1,'es'),'0,0');
 assert.equal(count(),72); // The oldest locale was evicted; it is recreated safely.
 assert.equal(api.formatFiniteNumericValue(2.5,1,'es'),'2,5');assert.equal(count(),72);
});
