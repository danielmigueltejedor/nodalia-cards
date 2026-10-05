import {expect,test} from '@playwright/test';
for(const domain of ['light','fan','humidifier','cover'])test(`${domain} cancels an in-flight slider when its account changes`,async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-light-card'));
 const result=await page.evaluate(domain=>{
  const tag=`nodalia-${domain}-card`,entity=`${domain}.one`,calls=[];
  const hass=window.createHassFixture({entities:{[entity]:{state:domain==='cover'?'open':'on',attributes:{brightness:128,supported_color_modes:['brightness'],percentage:50,humidity:50,min_humidity:30,max_humidity:80,current_position:50,supported_features:255}}},overrides:{connection:{},auth:{},user:{id:'first',is_admin:true},callService:(...args)=>{calls.push(args);return Promise.resolve();}}});
  const card=document.createElement(tag);card.setConfig({entity,compact_layout_mode:'never',animations:{enabled:false}});card.hass=hass;document.querySelector('#fixture').append(card);
  const slider=card.shadowRoot.querySelector('input[type=range]');if(!slider)throw new Error('Missing slider');
  const rect=slider.getBoundingClientRect();card._startSliderDrag(slider,rect.left+rect.width*.7,null,7);
  hass.user.id='second';card.hass=hass;
  window.dispatchEvent(new PointerEvent('pointerup',{pointerId:7,clientX:rect.right}));
  return {drag:card._activeSliderDrag,listeners:card._dragWindowListenersAttached,calls:calls.length};
 },domain);
 expect(result).toEqual({drag:null,listeners:false,calls:0});expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

test('Fav retires its private alarm PIN and expanded panel on account replacement',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-fav-card'));
 const result=await page.evaluate(()=>{const hass=window.createHassFixture({entities:{'alarm_control_panel.one':{state:'disarmed',attributes:{supported_features:63}}},overrides:{connection:{},auth:{},user:{id:'first',is_admin:true}}});const card=document.createElement('nodalia-fav-card');card.setConfig({entity:'alarm_control_panel.one',alarm_show_code_input:true,animations:{enabled:false}});card.hass=hass;document.querySelector('#fixture').append(card);card._alarmMenuOpen=true;card._alarmCodeInput='private PIN';card._render();hass.user.id='second';card.hass=hass;return{pin:card._alarmCodeInput,open:card._alarmMenuOpen};});expect(result).toEqual({pin:'',open:false});expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Vacuum retires optimistic mode selections on account replacement',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-vacuum-card'));
 const result=await page.evaluate(()=>{const hass=window.createHassFixture({entities:{'vacuum.one':{state:'cleaning',attributes:{fan_speed:'balanced',fan_speed_list:['balanced','turbo'],supported_features:8191}}},overrides:{connection:{},auth:{},user:{id:'first',is_admin:true}}});const card=document.createElement('nodalia-vacuum-card');card.setConfig({entity:'vacuum.one',animations:{enabled:false}});card.hass=hass;document.querySelector('#fixture').append(card);card._setPendingModeSelection('suction','turbo');hass.user.id='second';card.hass=hass;return Object.values(card._pendingModeSelection).filter(Boolean);});expect(result).toEqual([]);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

for(const [tag,config,entity,selector]of [
 ['nodalia-person-card',{entity:'person.one',hold_action:'more-info'},'person.one','[data-person-action="primary"]'],
 ['nodalia-insignia-card',{entity:'sensor.one',hold_action:'more-info'},'sensor.one','[data-insignia-action="primary"]'],
])test(`${tag} cancels held actions on an in-place account change`,async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(tag=>customElements.get(tag),tag);await page.clock.install();
 await page.evaluate(({tag,config,entity,selector})=>{
  const hass=window.createHassFixture({entities:{[entity]:{state:entity.startsWith('person')?'home':'ready',attributes:{}}},overrides:{connection:{},auth:{},user:{id:'first',is_admin:true}}});const card=document.createElement(tag);card.setConfig({...config,animations:{enabled:false}});card.hass=hass;document.querySelector('#fixture').append(card);window.retiredHoldEvents=[];card.addEventListener('hass-more-info',event=>window.retiredHoldEvents.push(event.detail.entityId));
  card.shadowRoot.querySelector(selector).dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true,pointerId:18,button:0}));hass.user.id='second';card.hass=hass;
 },{tag,config,entity,selector});await page.clock.runFor(1000);expect(await page.evaluate(()=>window.retiredHoldEvents)).toEqual([]);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
