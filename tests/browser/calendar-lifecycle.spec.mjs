import { expect, test } from '@playwright/test';
test.use({ timezoneId: 'Europe/Madrid' });
async function mount(page, { deferred = false, weather = false } = {}) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-calendar-card'));
  await page.clock.setFixedTime(new Date('2026-10-01T10:00:00Z'));
  await page.evaluate(({ deferred, weather }) => {
    window.calendarRequests = []; window.calendarRestCalls = []; window.calendarSubscriptions = []; window.calendarDisposed = [];
    window.calendarWrites = []; window.calendarWriteMode = 'resolve';
    const connection = { subscribeMessage(callback, message) {
      if (this !== connection) throw new Error('Lost connection receiver');
      return new Promise((resolve, reject) => window.calendarSubscriptions.push({ callback, message, reject, resolve: () => resolve(() => window.calendarDisposed.push(message.entity_id)) }));
    } };
    window.calendarConnection = connection;
    window.calendarConfig = { calendars: ['calendar.one'], weather_entity: weather ? 'weather.one' : '', language: 'en', animations: { enabled: false } };
    window.calendarHass = window.createHassFixture({ entities: {
      'calendar.one': { state: 'off', attributes: { friendly_name: 'First', supported_features: 2 } },
      'calendar.two': { state: 'off', attributes: { friendly_name: 'Second', supported_features: 2 } },
      'weather.one': { state: 'sunny', attributes: { supported_features: 1, forecast: [{date:'2026-10-01',temperature:12,templow:2,condition:'sunny'}] } },
      'weather.two': { state: 'rainy', attributes: { supported_features: 1 } },
    }, overrides: {
      connection, user: { id: 'first', is_admin: true },
      callApi: (_method, path) => path.startsWith('calendars/') && deferred
        ? new Promise((resolve, reject) => window.calendarRequests.push({ path, resolve, reject }))
        : Promise.resolve(path.startsWith('calendars/') ? [{uid:'first',summary:'Initial event',start:{date:'2026-10-01'},end:{date:'2026-10-02'}}] : []),
      auth: { fetchWithAuth: async path => { window.calendarRestCalls.push(path); return new Response('[]', {status:200}); } },
      callWS: async message => { if (message.type.startsWith('weather/') || (message.type==='call_service' && message.domain==='weather')) return []; return window.calendarWrite('ws',message); },
      callService: async (domain, service, data, target) => domain === 'weather' ? [] : window.calendarWrite('service',{domain,service,data,target}),
    } });
    window.calendarWrite = (kind, payload) => {
      const entry = {kind,payload}; window.calendarWrites.push(entry);
      if (window.calendarWriteMode === 'defer') return new Promise((resolve,reject) => Object.assign(entry,{resolve,reject}));
      if (window.calendarWriteMode === 'reject') return Promise.reject(new Error('Write rejected'));
      return Promise.resolve();
    };
    const card = document.createElement('nodalia-calendar-card'); card.setConfig(window.calendarConfig); card.hass = window.calendarHass;
    document.querySelector('#fixture').append(card); window.calendarCard = card;
  }, { deferred, weather });
  return page.locator('nodalia-calendar-card');
}
async function composer(card) {
  await card.locator('ha-card .calendar-card').click();
  await card.locator('[data-action="add-native-event"]').click();
  await expect(card.locator('[data-native-field="title"]')).toBeVisible();
}
const event = summary => [{uid:summary,summary,start:{date:'2026-10-01'},end:{date:'2026-10-02'}}];
test('Calendar isolates queued refreshes, obsolete REST fallbacks and detached/reconnected requests', async ({page}) => {
  const card = await mount(page,{deferred:true});
  await expect.poll(() => page.evaluate(() => window.calendarRequests.length)).toBe(1);
  await page.evaluate(() => { window.calendarCard._refreshEvents(); window.calendarCard.setConfig({...window.calendarConfig,calendars:['calendar.two']}); });
  await expect.poll(() => page.evaluate(() => window.calendarRequests.length)).toBe(2);
  await page.evaluate(() => window.calendarRequests[0].reject(new Error('Obsolete request')));
  expect(await page.evaluate(() => ({active:window.calendarCard._refreshInFlight,calls:window.calendarRequests.length,rest:window.calendarRestCalls.length}))).toEqual({active:true,calls:2,rest:0});
  await page.evaluate(() => window.calendarCard._refreshEvents());
  expect(await page.evaluate(() => window.calendarRequests.length)).toBe(2);
  await page.evaluate(rows => window.calendarRequests[1].resolve(rows),event('Current event'));
  await expect.poll(() => page.evaluate(() => window.calendarRequests.length)).toBe(3);
  await page.evaluate(rows => window.calendarRequests[2].resolve(rows),event('Latest event'));
  await expect(card.locator('ha-card .calendar-event__summary')).toContainText('Latest event');
  await page.evaluate(() => { window.calendarCard._refreshEvents(); window.calendarCard.remove(); document.querySelector('#fixture').append(window.calendarCard); });
  await expect.poll(() => page.evaluate(() => window.calendarRequests.length)).toBe(5);
  await page.evaluate(rows => window.calendarRequests[3].resolve(rows),event('Detached stale event'));
  expect(await page.evaluate(() => window.calendarCard._refreshInFlight)).toBe(true);
  await page.evaluate(rows => window.calendarRequests[4].resolve(rows),event('Reconnected event'));
  await expect(card.locator('ha-card .calendar-event__summary')).toContainText('Reconnected event');
  await page.evaluate(() => { window.calendarHass.states['calendar.two'].attributes.friendly_name='Renamed'; window.calendarCard.hass={...window.calendarHass}; });
  await expect(card.locator('ha-card .calendar-event__summary small')).toHaveText('Renamed');
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
test('Calendar owns forecast subscriptions, retries failures and keeps empty live forecasts authoritative', async ({page}) => {
  await mount(page,{weather:true});
  await expect.poll(() => page.evaluate(() => window.calendarSubscriptions.length)).toBe(1);
  await page.evaluate(() => window.calendarSubscriptions[0].reject(new Error('Offline')));
  await expect.poll(() => page.evaluate(() => window.calendarCard._weatherForecastSubscription)).toBe(null);
  await page.evaluate(() => window.calendarCard.hass={...window.calendarHass});
  await expect.poll(() => page.evaluate(() => window.calendarSubscriptions.length)).toBe(2);
  await page.evaluate(() => window.calendarSubscriptions[1].callback({forecast:[null,'invalid',0,{date:'2026-10-01',temperature:0,templow:0,condition:'sunny'}]}));
  expect(await page.evaluate(() => [...window.calendarCard._weatherForecastByDay.values()])).toEqual([{condition:'sunny',tempMax:0,tempMin:0}]);
  await page.evaluate(() => window.calendarSubscriptions[1].callback({forecast:null}));
  expect(await page.evaluate(() => window.calendarCard._weatherForecastByDay.size)).toBe(1);
  await page.evaluate(async () => { window.calendarSubscriptions[1].callback({forecast:[]}); await window.calendarCard._refreshEvents(); });
  expect(await page.evaluate(() => window.calendarCard._weatherForecastByDay.size)).toBe(0);
  await page.evaluate(() => { window.calendarCard.setConfig({...window.calendarConfig,weather_entity:'weather.two'}); window.calendarSubscriptions[1].callback({forecast:[{date:'2026-10-01',temperature:999}]}); window.calendarSubscriptions[1].resolve(); });
  await expect.poll(() => page.evaluate(() => window.calendarDisposed)).toEqual(['weather.one']);
  expect(await page.evaluate(() => [...window.calendarCard._weatherForecastByDay.values()].some(row=>row.tempMax===999))).toBe(false);
  await page.evaluate(() => { const connection={subscribeMessage(callback,message){return new Promise(resolve=>window.calendarSubscriptions.push({callback,message,resolve:()=>resolve(()=>window.calendarDisposed.push('new'))}));}}; window.calendarCard.hass={...window.calendarHass,connection}; window.calendarSubscriptions[2].callback({forecast:[{date:'2026-10-01',temperature:888}]}); window.calendarSubscriptions[2].resolve(); });
  await expect.poll(() => page.evaluate(() => window.calendarDisposed.length)).toBe(2);
  expect(await page.evaluate(() => [...window.calendarCard._weatherForecastByDay.values()].some(row=>row.tempMax===888))).toBe(false);
  await page.evaluate(() => { window.calendarCard.remove(); window.calendarSubscriptions[3].resolve(); });
  await expect.poll(() => page.evaluate(() => window.calendarDisposed.length)).toBe(3);
  await page.evaluate(() => { window.calendarHass.connection.subscribeMessage=()=>{throw new Error('Synchronous offline');}; window.calendarCard.hass=window.calendarHass; document.querySelector('#fixture').append(window.calendarCard); });
  expect(await page.evaluate(() => window.calendarCard._weatherForecastSubscription)).toBe(null);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
test('Calendar keeps composer drafts/caret across refreshes and isolates duplicate or obsolete writes', async ({page}) => {
  const card = await mount(page); await expect(card.locator('ha-card .calendar-event__summary')).toBeVisible(); await composer(card);
  const title=card.locator('[data-native-field="title"]'); await title.fill('Draft title');
  await card.locator('[data-native-field="description"]').fill('Description'); await card.locator('[data-native-field="location"]').fill('Place');
  await card.locator('[data-native-field="allDay"]').check(); await card.locator('[data-native-field="colorEnabled"]').check();
  await card.locator('[data-native-field="color"]').fill('#123456'); await card.locator('[data-native-field="repeatKind"]').selectOption('custom');
  await card.locator('[data-native-field="repeatCustomInterval"]').fill('3');
  await title.focus(); await title.evaluate(input=>input.setSelectionRange(2,7));
  await page.evaluate(async () => { window.calendarHass.states['calendar.one'].attributes.friendly_name='Updated name'; window.calendarCard.hass={...window.calendarHass}; await window.calendarCard._refreshEvents(); });
  await expect(title).toHaveValue('Draft title'); await expect(title).toBeFocused();
  expect(await title.evaluate(input=>[input.selectionStart,input.selectionEnd])).toEqual([2,7]);
  await expect(card.locator('[data-native-field="description"]')).toHaveValue('Description'); await expect(card.locator('[data-native-field="location"]')).toHaveValue('Place');
  await expect(card.locator('[data-native-field="allDay"]')).toBeChecked(); await expect(card.locator('[data-native-field="colorEnabled"]')).toBeChecked();
  await expect(card.locator('[data-native-field="color"]')).toHaveValue('#123456'); await expect(card.locator('[data-native-field-group="repeatCustom"]')).toBeVisible();
  await expect(card.locator('[data-native-field="repeatCustomInterval"]')).toHaveValue('3');
  await page.evaluate(()=>window.calendarCard.setConfig({...window.calendarCard._config,styles:{...window.calendarCard._config.styles,title_size:'26px'}}));
  await expect(card.locator('.calendar-composer__title')).toHaveCSS('font-size','26px');
  await expect(card.locator('[data-native-field="calendar"]')).toHaveCSS('border-radius','12px');
  await expect(card.locator('[data-native-field="description"]')).toHaveCSS('min-height','76px');
  await expect(card.locator('[data-native-field="allDay"]')).toHaveCSS('width','40px');
  await expect(title).toHaveValue('Draft title');
  await page.evaluate(() => { window.calendarWriteMode='defer'; void window.calendarCard._submitNativeEventComposer(); void window.calendarCard._submitNativeEventComposer(); });
  expect(await page.evaluate(() => window.calendarWrites.length)).toBe(1);
  expect(await page.evaluate(() => window.calendarWrites[0].payload.event.rrule)).toBe('FREQ=WEEKLY;INTERVAL=3');
  await card.locator('button[data-action="close-native-composer"]').click(); await expect(card.locator('[data-native-field="title"]')).toHaveCount(0); await card.locator('[data-action="add-native-event"]').click(); await title.fill('New draft');
  await page.evaluate(() => window.calendarWrites[0].resolve()); await expect(title).toHaveValue('New draft'); await expect(title).toBeVisible();
  await page.evaluate(() => { window.calendarWriteMode='reject'; void window.calendarCard._submitNativeEventComposer(); });
  await expect(card.locator('[data-native-error]')).toContainText('Write rejected'); await expect(title).toHaveValue('New draft');
  await page.evaluate(() => { window.calendarWriteMode='defer'; void window.calendarCard._submitNativeEventComposer(); window.calendarCard.setConfig({...window.calendarConfig,calendars:['calendar.two']}); window.calendarWrites.at(-1).reject(new Error('Obsolete write')); });
  await expect(card.locator('[data-native-field="title"]')).toHaveCount(0); expect(await page.evaluate(() => window.calendarCard._nativeComposerError)).toBe('');
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
test('Calendar creates day and overnight events correctly through the autumn clock change and ignores obsolete deletes', async ({page}) => {
  const card=await mount(page); await expect(card.locator('ha-card .calendar-event__summary')).toBeVisible(); await composer(card);
  await card.locator('[data-native-field="title"]').fill('All day'); await card.locator('[data-native-field="date"]').fill('2026-10-25'); await card.locator('[data-native-field="allDay"]').check();
  await card.locator('[data-action="save-native-composer"]').click(); await expect.poll(()=>page.evaluate(()=>window.calendarWrites.length)).toBe(1);
  expect(await page.evaluate(()=>window.calendarWrites[0].payload.data)).toMatchObject({start_date:'2026-10-25',end_date:'2026-10-26'});
  await expect(card.locator('[data-native-field="title"]')).toHaveCount(0); await card.locator('[data-action="add-native-event"]').click();
  await card.locator('[data-native-field="title"]').fill('Overnight'); await card.locator('[data-native-field="date"]').fill('2026-10-25');
  await card.locator('[data-native-field="start"]').fill('23:30'); await card.locator('[data-native-field="end"]').fill('00:30');
  await card.locator('[data-action="save-native-composer"]').click(); await expect.poll(()=>page.evaluate(()=>window.calendarWrites.length)).toBe(2);
  expect(await page.evaluate(()=>window.calendarWrites[1].payload.data)).toMatchObject({start_date_time:'2026-10-25T23:30:00',end_date_time:'2026-10-26T00:30:00'});
  await expect(card.locator('[data-native-field="title"]')).toHaveCount(0);
  await page.evaluate(()=>{ window.calendarWriteMode='defer'; window.calendarCard.shadowRoot.querySelector('ha-card [data-action="delete-event"]').click(); window.calendarCard.setConfig({...window.calendarConfig,calendars:['calendar.two']}); window.calendarWrites.at(-1).reject(new Error('Obsolete delete')); });
  expect(await page.evaluate(()=>window.calendarCard._deleteRecurrenceError)).toBe(''); expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});


test('Calendar refreshes completed creates after composer close/reopen, without changing newer drafts or obsolete contexts', async ({page}) => {
  for (const route of ['service','ws','webhook']) {
    const card=await mount(page); await expect(card.locator('ha-card .calendar-event__summary')).toBeVisible();
    await page.evaluate(route=>{
      window.calendarReads=0;
      window.calendarHass.callApi=async(_method,path)=>{
        if(!path.startsWith('calendars/')) return [];
        window.calendarReads++;
        return [{uid:'created',summary:'Created '+route,start:{date:'2026-10-01'},end:{date:'2026-10-02'}}];
      };
      if(route==='webhook'){
        window.calendarCard.setConfig({...window.calendarConfig,native_event_webhook:'create-calendar'});
        window.NodaliaUtils.postHomeAssistantWebhook=(_id,body)=>window.calendarWrite('webhook',body);
      }
    },route);
    await composer(card); await card.locator('[data-native-field="title"]').fill('Pending');
    if(route==='ws') await card.locator('[data-native-field="repeatKind"]').selectOption('weekly');
    await page.evaluate(()=>{window.calendarWriteMode='defer';void window.calendarCard._submitNativeEventComposer();window.calendarReads=0;});
    await card.locator('button[data-action="close-native-composer"]').click();
    if(route!=='service') {await card.locator('[data-action="add-native-event"]').click();await card.locator('[data-native-field="title"]').fill('New draft');}
    await page.evaluate(()=>window.calendarWrites.at(-1).resolve(true));
    await expect.poll(()=>page.evaluate(()=>window.calendarReads)).toBe(1);
    await expect(card.locator('ha-card .calendar-event__summary')).toContainText('Created '+route);
    if(route==='service') await expect(card.locator('[data-native-field="title"]')).toHaveCount(0);
    else {await expect(card.locator('[data-native-field="title"]')).toHaveValue('New draft');await expect(card.locator('[data-native-field="title"]')).toBeVisible();}
    if(route==='service') await card.locator('[data-action="add-native-event"]').click();
    await card.locator('[data-native-field="title"]').fill('Obsolete');
    await page.evaluate(()=>{
      void window.calendarCard._submitNativeEventComposer();
      window.calendarCard.setConfig({...window.calendarConfig,calendars:['calendar.two']});
    });
    await expect.poll(()=>page.evaluate(()=>window.calendarCard._refreshInFlight)).toBe(false);
    const reads=await page.evaluate(()=>window.calendarReads);
    await page.evaluate(()=>window.calendarWrites.at(-1).resolve(true));
    await page.evaluate(()=>Promise.resolve());
    expect(await page.evaluate(()=>window.calendarReads)).toBe(reads);
    expect(await page.evaluate(()=>window.calendarCard._nativeComposerError)).toBe('');
    expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
  }
});

test('Calendar uses the official forecast service and clears stale forecasts after an authoritative empty response',async({page})=>{
 await mount(page,{weather:true});
 const result=await page.evaluate(async()=>{
  const card=window.calendarCard,hass=window.calendarHass;window.forecastCalls=[];let empty=false;
  hass.callWS=async message=>{window.forecastCalls.push(message);return {response:{'weather.one':{forecast:empty?[]:[{datetime:'2026-10-01T12:00:00Z',temperature:0,templow:0,condition:'sunny'}]}}};};
  hass.callService=async()=>{throw new Error('Duplicate service request');};
  card._weatherForecastEvents={};card._weatherForecastRevision+=1;
  await card._refreshWeatherForecastByDay();const first=[...card._weatherForecastByDay.values()];
  empty=true;await card._refreshWeatherForecastByDay();
  return {first,remaining:card._weatherForecastByDay.size,calls:window.forecastCalls};
 });
 expect(result.first).toHaveLength(1);expect(result.first[0].tempMax).toBe(0);expect(result.remaining).toBe(0);
 expect(result.calls.length).toBeGreaterThan(0);
 for(const message of result.calls)expect(message).toEqual({type:'call_service',domain:'weather',service:'get_forecasts',service_data:{type:'daily'},target:{entity_id:'weather.one'},return_response:true});
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Calendar falls back to the compatible service wrapper after a rejected forecast WebSocket request',async({page})=>{
 await mount(page,{weather:true});const result=await page.evaluate(async()=>{
  const card=window.calendarCard,hass=window.calendarHass,calls=[];card._weatherForecastEvents={};
  hass.callWS=async()=>{throw new Error('Transport unavailable');};
  hass.callService=async(...args)=>{calls.push(args);return {'weather.one':{forecast:[]}};};
  await card._refreshWeatherForecastByDay();return {calls,remaining:card._weatherForecastByDay.size};
 });
 expect(result.calls).toEqual([['weather','get_forecasts',{type:'daily'},{entity_id:'weather.one'},false,true]]);expect(result.remaining).toBe(0);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

for(const change of ['user','auth'])test(`Calendar retires pending data when ${change} mutates on the same HA object`,async({page})=>{
 const card=await mount(page,{deferred:true,weather:true});await expect.poll(()=>page.evaluate(()=>window.calendarRequests.length)).toBe(1);
 await page.evaluate(change=>{if(change==='user')window.calendarHass.user.id='second';else window.calendarHass.auth={};window.calendarCard.hass=window.calendarHass;},change);
 await expect.poll(()=>page.evaluate(()=>window.calendarRequests.length)).toBe(2);
 await page.evaluate(()=>{window.calendarRequests[0].reject(new Error('Retired'));window.calendarSubscriptions[0].callback({forecast:[{date:'2026-10-01',temperature:999}]});window.calendarSubscriptions[0].resolve();});
 expect(await page.evaluate(()=>window.calendarRestCalls.length)).toBe(0);await expect.poll(()=>page.evaluate(()=>window.calendarDisposed.length)).toBe(1);
 await page.evaluate(rows=>window.calendarRequests[1].resolve(rows),event('Current account'));
 await expect(card.locator('ha-card .calendar-event__summary')).toContainText('Current account');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
