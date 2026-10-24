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
test('Fav updates immediately, keeps stale HA readings from flickering and reverses rapid toggles', async ({ page }) => {
  const card = await mount(page, { entity: 'light.one', language: 'en', haptics: { enabled: false } }, { 'light.one': { state: 'off' } });
  await page.evaluate(() => {
    window.favCalls = [];
    window.favHassFixture.callService = (...args) => { window.favCalls.push(args); return new Promise(() => {}); };
  });
  const button = card.locator('.fav-card__icon');
  await button.click();
  await expect(card.locator('ha-card')).toHaveClass(/is-on/);
  expect(await page.evaluate(() => window.favHassFixture.states['light.one'].state)).toBe('off');
  await page.evaluate(() => { window.favHassFixture.states['light.one'].attributes.friendly_name = 'Updated'; window.favCardFixture.hass = window.favHassFixture; });
  await expect(card.locator('ha-card')).toHaveClass(/is-on/);
  await button.click();
  await expect(card.locator('ha-card')).toHaveClass(/is-off/);
  expect(await page.evaluate(() => window.favCalls.map(call => call.slice(0, 2)))).toEqual([['homeassistant', 'turn_on'], ['homeassistant', 'turn_off']]);
  await page.evaluate(() => { window.favHassFixture.states['light.one'].state = 'on'; window.favCardFixture.hass = window.favHassFixture; });
  await expect(card.locator('ha-card')).toHaveClass(/is-off/);
  await page.evaluate(() => { window.favHassFixture.states['light.one'].state = 'off'; window.favCardFixture.hass = window.favHassFixture; });
  expect(await card.evaluate(card => ({ draft: card._optimisticToggle, timer: card._optimisticToggleTimer }))).toEqual({ draft: null, timer: 0 });
});
test('Fav rolls back rejected and timed-out commands without losing native keyboard focus', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const card = await mount(page, { entity: 'switch.one', language: 'en', haptics: { enabled: false } }, { 'switch.one': { state: 'off' } });
  await page.evaluate(() => { window.favHassFixture.callService = () => new Promise((resolve, reject) => { window.rejectFav = reject; }); });
  const button = card.locator('.fav-card__icon');
  await page.keyboard.press('Tab'); await button.focus(); await button.press('Enter');
  await expect(card.locator('ha-card')).toHaveClass(/is-on/); await expect(button).toBeFocused();
  await page.evaluate(() => window.rejectFav(new Error('offline')));
  await expect(card.locator('ha-card')).toHaveClass(/is-off/); await expect(button).toBeFocused();
  await page.evaluate(() => { window.favHassFixture.callService = () => new Promise(() => {}); });
  await page.clock.install();
  await button.press('Space'); await expect(card.locator('ha-card')).toHaveClass(/is-on/);
  await page.clock.fastForward(3300);
  await expect(card.locator('ha-card')).toHaveClass(/is-off/);
  expect(await card.evaluate(card => card._optimisticToggleTimer)).toBe(0);
  expect(errors).toEqual([]);
});
test('Fav ignores an old failed command after a newer toggle and clears drafts on context changes', async ({ page }) => {
  const card = await mount(page, { entity: 'light.one', haptics: { enabled: false } }, { 'light.one': { state: 'off' }, 'light.two': { state: 'on' } });
  await page.evaluate(() => { window.favRejects = []; window.favHassFixture.callService = () => new Promise((resolve, reject) => window.favRejects.push(reject)); });
  const button = card.locator('.fav-card__icon');
  await button.click(); await button.click();
  await page.evaluate(() => window.favRejects[0](new Error('old failure')));
  await expect(card.locator('ha-card')).toHaveClass(/is-off/);
  expect(await card.evaluate(card => card._optimisticToggle?.expectedState)).toBe('off');
  for (const change of ['user', 'connection', 'entity', 'detach']) {
    await page.evaluate(() => { window.favCardFixture.setConfig({ entity: 'light.one', haptics: { enabled: false } }); });
    await button.click(); await expect(card.locator('ha-card')).toHaveClass(/is-on/);
    await page.evaluate(change => {
      const card = window.favCardFixture, hass = window.favHassFixture;
      if (change === 'user') { hass.user = { id: 'different', is_admin: false }; card.hass = hass; }
      if (change === 'connection') { hass.connection = {}; card.hass = hass; }
      if (change === 'entity') card.setConfig({ entity: 'light.two' });
      if (change === 'detach') { card.remove(); document.querySelector('#fixture').append(card); }
    }, change);
    expect(await card.evaluate(card => ({ draft: card._optimisticToggle, timer: card._optimisticToggleTimer }))).toEqual({ draft: null, timer: 0 });
    await page.evaluate(() => window.favRejects.at(-1)(new Error('retired context')));
  }
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
test('Fav confirms optimistic state and immediately retires it for unavailable readings', async ({ page }) => {
  const card = await mount(page, { entity: 'fan.one', haptics: { enabled: false } }, { 'fan.one': { state: 'off' } });
  await page.evaluate(() => { window.favHassFixture.callService = async () => {}; });
  const button = card.locator('.fav-card__icon'); await button.click();
  await page.evaluate(() => { window.favHassFixture.states['fan.one'].state = 'on'; window.favCardFixture.hass = window.favHassFixture; });
  await expect(card.locator('ha-card')).toHaveClass(/is-on/);
  expect(await card.evaluate(card => card._optimisticToggle)).toBe(null);
  await button.click();
  await page.evaluate(() => { window.favHassFixture.states['fan.one'].state = 'unavailable'; window.favCardFixture.hass = window.favHassFixture; });
  expect(await card.evaluate(card => ({ draft: card._optimisticToggle, timer: card._optimisticToggleTimer }))).toEqual({ draft: null, timer: 0 });
  await expect(card.locator('.fav-card__unavailable-badge')).toBeVisible();
});
test('Fav retains pointer modality across optimistic rerenders and restores the frame with the keyboard', async ({ page }) => {
  const card = await mount(page, { entity: 'light.one', haptics: { enabled: false } }, { 'light.one': { state: 'off' } });
  await page.evaluate(() => { window.favHassFixture.callService = () => new Promise(() => {}); });
  const button = card.locator('.fav-card__icon');
  await page.keyboard.press('Tab'); await button.focus();
  expect(await card.locator('ha-card').evaluate(node => node.querySelectorAll('[data-nodalia-card-focus-frame]').length)).toBe(1);
  await button.click();
  await expect(card.locator('ha-card')).toHaveClass(/is-on/);
  expect(await card.locator('ha-card').evaluate(node => node.querySelectorAll('[data-nodalia-card-focus-frame]').length)).toBe(0);
  await page.keyboard.press('Tab'); await button.focus();
  expect(await card.locator('ha-card').evaluate(node => node.querySelectorAll('[data-nodalia-card-focus-frame]').length)).toBe(1);
});
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

test('Fav 6-column alarm centres the icon and name in both axes until its controls open', async ({ page }) => {
 const card = await mount(page, {
  entity: 'alarm_control_panel.casa',
  name: 'Alarma',
  use_entity_icon: true,
  show_state: false,
  alarm_show_code_input: false,
  grid_options: { columns: 6, rows: 'auto' },
  styles: { icon: { size: '52px' }, card: { border_radius: '28px' } },
 }, { 'alarm_control_panel.casa': {
  state: 'disarmed', attributes: { friendly_name: 'Casa', supported_features: 3 },
 } });
 for (const width of [210, 290, 380]) {
  await card.evaluate((node, width) => { node.style.width = `${width}px`; }, width);
  await expect(card.locator('ha-card')).toHaveClass(/fav-card--alarm-centered/);
  const geometry = await card.evaluate(node => {
   const root = node.shadowRoot;
   const outer = root.querySelector('ha-card').getBoundingClientRect();
   const icon = root.querySelector('.fav-card__icon').getBoundingClientRect();
   const label = root.querySelector('.fav-card__title').getBoundingClientRect();
   return {
    deltaX: Math.abs((outer.left + outer.right) / 2 - (icon.left + label.right) / 2),
    deltaY: Math.abs((outer.top + outer.bottom) / 2 - (icon.top + icon.bottom) / 2),
    title: root.querySelector('.fav-card__title').textContent,
    cardHeight: outer.height,
   };
  });
  expect(geometry.title).toBe('Alarma');
  expect(geometry.deltaX).toBeLessThan(4);
  expect(geometry.deltaY).toBeLessThan(4);
  expect(geometry.cardHeight).toBeGreaterThanOrEqual(68);
 }
 await card.locator('ha-card[data-fav-action="primary"]').click();
 await expect(card.locator('.fav-card--alarm-open')).toBeVisible();
 await expect(card.locator('[data-fav-alarm-action]')).not.toHaveCount(0);
 const panel = await card.evaluate(node => {
  const root = node.shadowRoot;
  const outer = root.querySelector('ha-card').getBoundingClientRect();
  const actions = root.querySelector('.fav-card__alarm-panel').getBoundingClientRect();
  return { height: outer.height, fits: actions.bottom <= outer.bottom + 1 };
 });
 expect(panel.height).toBeGreaterThan(68);
 expect(panel.fits).toBe(true);
 expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
