import {expect,test} from '@playwright/test';

async function load(page) {
 await page.route('**/tests/fixtures/browser.html',async route=>{
  const response=await route.fetch();const html=await response.text();
  await route.fulfill({response,body:html.replace('class extends HTMLElement {}',`class extends HTMLElement {constructor(){super();if(this.localName==='ha-card')this.attachShadow({mode:'open'}).innerHTML='<style>:host {display:block;box-sizing:border-box;position:relative}</style><slot></slot>';}}`)});
 });
 await page.goto('/tests/fixtures/browser.html');
 await page.waitForFunction(()=>customElements.get('nodalia-room-summary-card'));
 await page.evaluate(()=>{
  document.body.style.background='#e9eaec';
  document.documentElement.style.cssText='--primary-text-color:#171733;--secondary-text-color:#747481;--ha-card-background:#fff;--divider-color:#dedee5;--ha-card-box-shadow:0 1px 2px #0003;--info-color:#00a3d7';
 });
}

// A rounded control may clip its own contents. Its external shadow must not
// encounter a rectangular content ancestor before reaching the card boundary.
async function rectangularClips(locator) {
 return locator.evaluateAll(nodes=>nodes.flatMap(node=>{
  const shadow=getComputedStyle(node).boxShadow;
  if(shadow==='none'||!shadow.split(/,(?![^()]*\))/).some(part=>!part.includes('inset')))return [];
  const result=[];
  for(let parent=node.parentElement;parent&&parent.localName!=='ha-card';parent=parent.parentElement){
   const style=getComputedStyle(parent);
   if([style.overflowX,style.overflowY].some(value=>value!=='visible')&&parseFloat(style.borderTopLeftRadius)===0)result.push(parent.className);
  }
  return result;
 }));
}

for(const embedded of [false,true]){
 test(`TV name and source shadows reach the rounded boundary ${embedded?'inside Room Summary':'standalone'}`,async({page})=>{
  await load(page);
  await page.evaluate(embedded=>{
   window.shadowHass=window.makeHass({'media_player.tv':{state:'playing',attributes:{friendly_name:'Apple TV Salón',device_class:'tv',source:'Plex',source_list:['Plex','HDMI 1'],supported_features:131074}},'media_player.second':{state:'playing',attributes:{friendly_name:'Second TV',device_class:'tv',source:'HDMI 1'}}});
   const card=document.createElement(embedded?'nodalia-room-summary-card':'nodalia-media-player');
   card.setConfig(embedded?{name:'Living room',media_player:'media_player.tv',animations:{enabled:false}}:{players:[{entity:'media_player.tv',tv_mode:true},{entity:'media_player.second',tv_mode:true}],layout:{mode:'standard'},animations:{enabled:false}});
   card.hass=window.shadowHass;document.querySelector('#fixture').append(card);window.shadowCard=card;
  },embedded);
  const host=page.locator(embedded?'nodalia-room-summary-card':'nodalia-media-player').first();
  const player=embedded?host.locator('nodalia-media-player'):host;
  for(const width of [360,720]){
   await host.evaluate((node,width)=>node.style.width=`${width}px`,width);
   await expect(player.locator('.media-player__chip--top')).toContainText('Apple TV Salón');
   await expect(player.locator('.media-player__chip--top')).toBeVisible();
   expect(await rectangularClips(player.locator('.media-player__chip'))).toEqual([]);
   // Long names remain contained after the inner shadow clip is removed.
   await page.evaluate(()=>{window.shadowHass.states['media_player.tv'].attributes.friendly_name='Apple TV Salón with an exceptionally long player name';window.shadowCard.hass={...window.shadowHass};});
   const chip=player.locator('.media-player__chip--top');
   await expect(chip).toContainText('exceptionally long player name');
   expect(await chip.evaluate(node=>{const rect=node.getBoundingClientRect(),card=node.closest('.media-player-card').getBoundingClientRect();return rect.left>=card.left&&rect.right<=card.right;})).toBe(true);
   await page.evaluate(()=>{window.shadowHass.states['media_player.tv'].attributes.friendly_name='Apple TV Salón';window.shadowCard.hass={...window.shadowHass};});
  }
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
 });
}

test('Compact armed Alarm favourite shadows are clipped only by the rounded card',async({page})=>{
 await load(page);
 await page.evaluate(()=>{
  const card=document.createElement('nodalia-fav-card');card.style.width='184px';card.setConfig({entity:'alarm_control_panel.one',show_state:false,grid_options:{columns:6,rows:'auto'},alarm_show_code_input:false});
  card.hass=window.makeHass({'alarm_control_panel.one':{state:'armed_night',attributes:{supported_features:63}}});document.querySelector('#fixture').append(card);
 });
 const card=page.locator('nodalia-fav-card');
 expect(await rectangularClips(card.locator('.fav-card__icon'))).toEqual([]);
 await card.locator('.fav-card__hero').click();await expect(card.locator('.fav-card__alarm-panel')).toBeVisible();
 expect(await rectangularClips(card.locator('.fav-card__icon,.fav-card__alarm-button'))).toEqual([]);
});

test('Light color and temperature thumb shadows survive settled mode changes',async({page})=>{
 await load(page);
 await page.evaluate(()=>{
  const card=document.createElement('nodalia-light-card');card.style.width='360px';card.setConfig({entity:'light.one',compact_layout_mode:'never',animations:{enabled:true,mode_switch_duration:120}});
  card.hass=window.makeHass({'light.one':{state:'on',attributes:{brightness:128,hs_color:[42,60],supported_color_modes:['hs','color_temp'],min_color_temp_kelvin:2200,max_color_temp_kelvin:6500}}});document.querySelector('#fixture').append(card);
 });
 const card=page.locator('nodalia-light-card');
 for(const mode of ['temperature','color']){
  await card.locator(`[data-light-action="mode"][data-mode="${mode}"]`).click();
  await expect.poll(()=>card.evaluate(node=>node._modeTransition)).toBe(null);
  const thumb=card.locator(`.light-card__slider-thumb[data-light-control="${mode}"]`);await expect(thumb).toBeVisible();
  await expect.poll(()=>rectangularClips(thumb)).toEqual([]);
 }
});

test('Narrow Graph legend highlights stay within the scrollport',async({page})=>{
 await page.setViewportSize({width:390,height:700});await load(page);
 await page.evaluate(()=>{
  const states=Object.fromEntries([1,2,3,4].map(i=>[`sensor.${i}`,{state:String(i*10),attributes:{unit_of_measurement:'%'}}]));
  const hass=window.makeHass(states);hass.callWS=async()=>({});
  const card=document.createElement('nodalia-graph-card');card.style.width='340px';card.setConfig({entities:[1,2,3,4].map(i=>({entity:`sensor.${i}`,name:`Long sensor name ${i}`})),animations:{enabled:false}});card.hass=hass;document.querySelector('#fixture').append(card);
 });
 const items=page.locator('nodalia-graph-card .graph-card__legend-item');await expect(items).toHaveCount(4);
 expect(await rectangularClips(items)).toEqual([]);
 const legend=page.locator('nodalia-graph-card .graph-card__legend');
 await page.locator('nodalia-graph-card').evaluate(node=>{const style=document.createElement('style');style.textContent='.graph-card__primary-row .graph-card__legend {max-width:130px;justify-content:flex-start}';node.shadowRoot.append(style);});
 await expect.poll(()=>legend.evaluate(node=>node.scrollWidth>node.clientWidth)).toBe(true);
 await items.first().click();
 expect(await rectangularClips(items)).toEqual([]);
});

for(const view of ['cards','chart'])test(`Weather ${view} forecast hover highlights stay within the scrollport`,async({page})=>{
 await load(page);
 await page.evaluate(view=>{
  const forecast=Array.from({length:8},(_,i)=>({datetime:new Date(Date.now()+i*3600000).toISOString(),condition:'sunny',temperature:20+i,precipitation_probability:0}));
  const hass=window.makeHass({'weather.one':{state:'sunny',attributes:{temperature:20,temperature_unit:'°C',forecast}}});
  const card=document.createElement('nodalia-weather-card');card.style.width='340px';card.setConfig({entity:'weather.one',show_forecast_details:true,forecast_view:view,forecast_type:'hourly',animations:{enabled:false}});card.hass=hass;document.querySelector('#fixture').append(card);
 },view);
 if(view==='cards'){
  const items=page.locator('nodalia-weather-card .weather-card__forecast-item');await expect(items.first()).toBeVisible();await items.first().hover();expect(await rectangularClips(items.first())).toEqual([]);
 }else{
  const point=page.locator('nodalia-weather-card .weather-card__forecast-chart-hit').first();await point.focus();await point.press('Enter');
  const popup=page.locator('nodalia-weather-card .weather-card__forecast-popup');await expect(popup).toBeVisible();expect(await rectangularClips(popup)).toEqual([]);
 }
});
