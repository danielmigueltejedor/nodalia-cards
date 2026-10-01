import {expect,test} from '@playwright/test';
const red='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path fill="red" d="M0 0h1v1H0z"/></svg>';
const blue=red.replace('red','blue');
async function mount(page,config,states,mockImages=false){
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-person-card'));
 await page.evaluate(({config,states,mockImages})=>{
  if(mockImages){window.personImages=[];window.Image=class{constructor(){window.personImages.push(this);}set src(value){this.url=value;}removeAttribute(name){if(name==='src')this.cancelled=true;}};}
  const card=document.createElement('nodalia-person-card');card.setConfig(config);const hass=window.makeHass(states);window.personLifecycleHass=hass;card.hass=hass;document.querySelector('#fixture').append(card);window.personLifecycleCard=card;
 },{config,states,mockImages});return page.locator('nodalia-person-card');
}
test('Person ignores stale pictures, cancels pending preloads on disconnect and retries after remount',async({page})=>{
 const card=await mount(page,{entity:'person.one'},{'person.one':{state:'home',attributes:{entity_picture:red}}},true);
 await page.evaluate(blue=>{window.personLifecycleCard.hass=window.makeHass({'person.one':{state:'home',attributes:{entity_picture:blue}}});window.personImages[0].onload();},blue);
 await expect(card.locator('img')).toHaveCount(0);
 await page.evaluate(()=>window.personImages[1].onload());await expect(card.locator('img')).toHaveAttribute('src',blue);
 const cleanup=await page.evaluate(red=>{const card=window.personLifecycleCard;card.hass=window.makeHass({'person.one':{state:'home',attributes:{entity_picture:red.replace('red','green')}}});const image=window.personImages.at(-1);card.remove();const result={pending:card._pendingImagePreloads.size,cancels:card._imagePreloadCancels.size,load:image.onload,error:image.onerror,cancelled:image.cancelled};document.querySelector('#fixture').append(card);return result;},red);
 expect(cleanup).toEqual({pending:0,cancels:0,load:null,error:null,cancelled:true});
 await page.evaluate(()=>window.personImages.at(-1).onload());await expect(card.locator('img')).toHaveAttribute('src',red.replace('red','green'));expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Person times out stalled images and bounds completed URL caches',async({page})=>{
 await mount(page,{entity:'person.one'},{'person.one':{state:'home',attributes:{entity_picture:red}}},true);
 await expect.poll(()=>page.evaluate(()=>window.personLifecycleCard._pendingImagePreloads.size),{timeout:6000}).toBe(0);
 expect(await page.evaluate(()=>window.personLifecycleCard._failedImageUrls.has(window.personImages[0].url))).toBe(true);
 const sizes=await page.evaluate(async()=>{const card=window.personLifecycleCard;for(let i=0;i<70;i++){const promise=card._preloadImageUrl('success-'+i);window.personImages.at(-1).onload();await promise;const failure=card._preloadImageUrl('failure-'+i);window.personImages.at(-1).onerror();await failure;}return [card._readyImageUrls.size,card._failedImageUrls.size,card._pendingImagePreloads.size];});
 expect(sizes).toEqual([64,64,0]);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Person resolves renamed zones again when the cached zone no longer matches',async({page})=>{
 const card=await mount(page,{entity:'person.one'},{'person.one':{state:'studio'},'zone.first':{state:'0',attributes:{friendly_name:'Studio',icon:'mdi:desk'}}});
 await expect(card.locator('.person-card__badge ha-icon')).toHaveAttribute('icon','mdi:desk');
 await page.evaluate(()=>{window.personLifecycleCard.hass=window.makeHass({'person.one':{state:'studio'},'zone.first':{state:'0',attributes:{friendly_name:'Garden',icon:'mdi:flower'}},'zone.second':{state:'0',attributes:{friendly_name:'Studio',icon:'mdi:palette'}}});});
 await expect(card.locator('.person-card__badge ha-icon')).toHaveAttribute('icon','mdi:palette');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Person owns fallback animation timers, resets consumed taps and catches service failures with explicit targets',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));const config={entity:'person.one',tap_action:'service',tap_service:'light.turn_on',tap_service_data:{brightness:0,flag:false},tap_service_target:{area_id:'living'},security:{allowed_services:['light.turn_on']}};
 const card=await mount(page,config,{'person.one':{state:'home'}});
 await page.evaluate(()=>{window.personServiceCalls=[];window.personLifecycleHass.callService=(...args)=>{window.personServiceCalls.push(args);return Promise.reject(new Error('offline'));};});
 await card.locator('ha-card[data-person-action="primary"]').click();expect(await page.evaluate(()=>window.personServiceCalls)).toEqual([['light','turn_on',{brightness:0,flag:false},{area_id:'living'}]]);
 const cleanup=await page.evaluate(config=>{const card=window.personLifecycleCard;card._suppressNextPersonTap=true;card.setConfig(config);const reset=card._suppressNextPersonTap;const original=window.NodaliaUtils.scheduleDeferTimer;window.NodaliaUtils.scheduleDeferTimer=undefined;card._triggerPrimaryPressAnimation();window.NodaliaUtils.scheduleDeferTimer=original;const scheduled=card._fallbackAnimationTimers.size;card.remove();const remaining=card._fallbackAnimationTimers.size;document.querySelector('#fixture').append(card);window.NodaliaUtils.invokeHomeAssistantService=undefined;window.personLifecycleHass.callService=()=>{throw new Error('offline synchronously');};return{reset,scheduled,remaining};},config);
 expect(cleanup.reset).toBe(false);expect(cleanup.scheduled).toBeGreaterThan(0);expect(cleanup.remaining).toBe(0);
 await card.locator('ha-card[data-person-action="primary"]').press('Enter');expect(errors).toEqual([]);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
