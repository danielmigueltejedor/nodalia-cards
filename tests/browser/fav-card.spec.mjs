import {expect,test} from '@playwright/test';
async function mount(page, config, states) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(()=>customElements.get('nodalia-fav-card'));
  await page.evaluate(({config,states})=>{
    const card=document.createElement('nodalia-fav-card');card.setConfig(config);
    document.querySelector('#fixture').append(card);window.favHassFixture=window.makeHass(states);card.hass=window.favHassFixture;
    window.favCardFixture=card;
  },{config,states});
  return page.locator('nodalia-fav-card');
}
test('Fav refreshes a selected attribute and light color without changing the entity state',async({page})=>{
  const card=await mount(page,{entity:'light.one',state_attribute:'battery'},{'light.one':{state:'on',attributes:{battery:20,rgb_color:[20,80,130]}}});
  await expect(card.locator('.fav-card__chip')).toHaveText('20%');
  await page.evaluate(()=>{window.favCardFixture.hass=window.makeHass({'light.one':{state:'on',attributes:{battery:80,rgb_color:[0,0,0]}}});});
  await expect(card.locator('.fav-card__chip')).toHaveText('80%');
  expect(await page.evaluate(()=>window.favCardFixture.shadowRoot.querySelector('style').textContent)).toContain('rgb(0, 0, 0)');
  await page.evaluate(()=>{window.favCardFixture.hass=window.makeHass({'light.one':{state:'on',attributes:{battery:80,rgb_color:['0); } </style><img src=x onerror=alert(1)>',0,0]}}});});
  expect(await page.evaluate(()=>window.favCardFixture.shadowRoot.innerHTML)).not.toContain('onerror=');
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Fav updates alarm modes and PIN requirements when only HA capabilities change',async({page})=>{
  const card=await mount(page,{entity:'alarm_control_panel.one'},{'alarm_control_panel.one':{state:'disarmed',attributes:{supported_features:1}}});
  await card.locator('ha-card[data-fav-action="primary"]').click();
  await expect(card.locator('[data-fav-alarm-action="alarm_arm_home"]')).toBeVisible();
  await expect(card.locator('[data-fav-alarm-action="alarm_arm_away"]')).toHaveCount(0);
  await page.evaluate(()=>{window.favCardFixture.hass=window.makeHass({'alarm_control_panel.one':{state:'disarmed',attributes:{supported_features:2,code_format:'number'}}});});
  await expect(card.locator('[data-fav-alarm-action="alarm_arm_home"]')).toHaveCount(0);
  await expect(card.locator('[data-fav-alarm-action="alarm_arm_away"]')).toBeVisible();
  await expect(card.locator('[data-fav-alarm-field="alarm-code"]')).toBeVisible();
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Fav retains a draft PIN on style changes and clears it when changing entity or disconnecting',async({page})=>{
  const card=await mount(page,{entity:'alarm_control_panel.one'},{'alarm_control_panel.one':{state:'disarmed',attributes:{code_format:'number'}},'alarm_control_panel.two':{state:'disarmed',attributes:{code_format:'number'}}});
  await page.evaluate(()=>{const wrapper=document.createElement('hui-card');window.favCardFixture.replaceWith(wrapper);wrapper.append(window.favCardFixture);window.favWrapperFixture=wrapper;});
  await card.locator('ha-card[data-fav-action="primary"]').click();
  await card.locator('[data-fav-alarm-field="alarm-code"]').fill('0123');
  await page.evaluate(()=>window.favCardFixture.setConfig({entity:'alarm_control_panel.one',styles:{card:{padding:'15px'}}}));
  await expect(card.locator('[data-fav-alarm-field="alarm-code"]')).toHaveValue('0123');
  await page.evaluate(()=>window.favCardFixture.setConfig({entity:'alarm_control_panel.missing'}));
  expect(await page.evaluate(()=>window.favWrapperFixture.hasAttribute('data-fav-alarm-open'))).toBe(false);
  await page.evaluate(()=>window.favCardFixture.setConfig({entity:'alarm_control_panel.two'}));
  await expect(card.locator('[data-fav-alarm-field="alarm-code"]')).toHaveCount(0);
  await card.locator('ha-card[data-fav-action="primary"]').click();
  await expect(card.locator('[data-fav-alarm-field="alarm-code"]')).toHaveValue('');
  await card.locator('[data-fav-alarm-field="alarm-code"]').fill('0987');
  const state=await page.evaluate(()=>{const card=window.favCardFixture;const oldSchedule=window.NodaliaUtils.scheduleDeferTimer;window.NodaliaUtils.scheduleDeferTimer=undefined;card._scheduleLayoutRefresh(2000);window.NodaliaUtils.scheduleDeferTimer=oldSchedule;card.remove();const state={pin:card._alarmCodeInput,timers:card._fallbackLayoutTimers.size,frame:card._layoutFrame};document.querySelector('#fixture').append(card);return state;});
  expect(state).toEqual({pin:'',timers:0,frame:0});
  await card.locator('ha-card[data-fav-action="primary"]').click();
  await expect(card.locator('[data-fav-alarm-field="alarm-code"]')).toHaveValue('');
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Fav preserves explicit service targets and false/zero data and handles failed calls',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const card=await mount(page,{entity:'switch.one',tap_action:'service',tap_service:'homeassistant.turn_on',tap_service_data:{brightness:0,flag:false},tap_service_target:{area_id:'living'}},{'switch.one':{state:'off'}});
  await page.evaluate(()=>{window.favCalls=[];window.favHassFixture.callService=(...args)=>{window.favCalls.push(args);return Promise.reject(new Error('offline'));};});
  await card.locator('ha-card[data-fav-action="primary"]').click();
  expect(await page.evaluate(()=>window.favCalls)).toEqual([['homeassistant','turn_on',{brightness:0,flag:false},{area_id:'living'}]]);
  await page.evaluate(()=>{window.NodaliaUtils.invokeHomeAssistantService=undefined;window.favHassFixture.callService=()=>{throw new Error('offline synchronously');};});
  await card.locator('ha-card[data-fav-action="primary"]').click();
  expect(errors).toEqual([]);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
