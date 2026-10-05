import {readFileSync} from 'node:fs';
import {RUNTIME_ENTRIES} from '../../scripts/build-src-cards.mjs';
import {expect,test} from '@playwright/test';
const registry=JSON.parse(readFileSync(new URL('../../src/cards/registry.json',import.meta.url),'utf8'));
for(const entry of registry)test(`Cold standalone ${entry.artifact} preserves its card/editor registration and YAML`,async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/tests/fixtures/browser.html',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('await import("../../nodalia-cards.js");', [...RUNTIME_ENTRIES.map(runtime=>`await import("../../${runtime.outfile}");`), `await import("../../${entry.artifact}");`].join('\n'))});});
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(tag=>customElements.get(tag),entry.tag);
 const result=await page.evaluate(async entry=>{
  const Constructor=customElements.get(entry.tag),hass=window.createHassFixture({entities:{'sensor.test':{state:'0',attributes:{unit_of_measurement:'W'}},'light.test':{state:'off',attributes:{brightness:0,supported_color_modes:['brightness']}}}});
  const stub=Constructor.getStubConfig?.(hass)||{};const card=document.createElement(entry.tag);
  card.setConfig({...stub,type:`custom:${entry.tag}`,language:'en',animations:{enabled:false},audit_extension:{zero:0,flag:false,text:'東京'}});card.hass=hass;document.querySelector('#fixture').append(card);
  const editor=await Constructor.getConfigElement();editor.setConfig?.({...stub,type:`custom:${entry.tag}`});editor.hass=hass;document.querySelector('#fixture').append(editor);
  const result={card:card.localName,editor:editor.localName,cardShadow:!!card.shadowRoot,editorShadow:!!editor.shadowRoot,globals:['NodaliaUtils','NodaliaI18n','NodaliaBackend','NodaliaRenderSignature','NodaliaBubbleContrast'].every(key=>!!window[key]) && typeof window.NodaliaI18n.editorStr === 'function',errors:window.bundleErrors};
  editor.remove();card.remove();return result;
 },entry);
 expect(result).toEqual({card:entry.tag,editor:entry.editorTag,cardShadow:true,editorShadow:true,globals:true,errors:[]});expect(errors).toEqual([]);
});
