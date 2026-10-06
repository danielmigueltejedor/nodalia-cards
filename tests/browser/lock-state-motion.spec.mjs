import { expect, test } from '@playwright/test';
async function mount(page) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-lock-card'));
  await page.evaluate(() => {
    window.lockHass = window.makeHass({'lock.front':{state:'locked',attributes:{friendly_name:'Front'}}});
    const card = document.createElement('nodalia-lock-card'); card.setConfig({entity:'lock.front'}); card.hass = window.lockHass;
    document.querySelector('#fixture').append(card); window.motionLock=card;
    window.lockNodes={surface:card.shadowRoot.querySelector('ha-card'),icon:card.shadowRoot.querySelector('.icon'),state:card.shadowRoot.querySelector('.state')};
  });
  return page.locator('nodalia-lock-card');
}
for (const reduced of [false,true]) test(`Lock state transitions are immediate, bounded and retain their surface (reduced=${reduced})`, async ({page}) => {
  await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
  const card = await mount(page);
  for (const state of ['unlocking','unlocked','locking','locked','jammed','unavailable','unknown','opening','open']) {
    const result = await page.evaluate(state => {
      const c=window.motionLock,h=window.lockHass;
      h.states['lock.front']={...h.states['lock.front'],state};c.hass={...h};
      const root=c.shadowRoot,n=window.lockNodes;
      return {immediate:root.querySelector('ha-card').dataset.lockState,stateText:root.querySelector('.state').textContent,
        stable:n.surface===root.querySelector('ha-card')&&n.icon===root.querySelector('.icon')&&n.state===root.querySelector('.state'),
        active:c.animationWork.cancels.size,icon:root.querySelector('.icon ha-icon').getAttribute('icon'),
        timings:root.querySelector('.state').getAnimations().map(a=>a.effect.getTiming())};
    }, state);
    expect(result.immediate).toBe(state); expect(result.stateText.length).toBeGreaterThan(0); expect(result.stable).toBe(true);
    expect(result.active).toBe(reduced?0:state==='unlocked'?2:3);
    expect(result.timings.every(t=>t.iterations===1&&t.duration<=220)).toBe(true);
    if (['unlocking','unlocked','open','opening'].includes(state)) expect(result.icon).toBe('mdi:lock-open-variant');
    if (['locking','opening','unlocking'].includes(state)) await expect(card.locator('ha-card')).toHaveAttribute('aria-busy','true');
  }
  await page.evaluate(()=>window.motionLock.remove());
  expect(await page.evaluate(()=>window.motionLock.animationWork.cancels.size)).toBe(0);
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Unrelated Lock attributes do not restart state feedback, and context retirement cancels it', async ({page}) => {
  await mount(page);
  const result=await page.evaluate(()=>{
    const c=window.motionLock,h=window.lockHass;h.auth={};c.hass=h;
    h.states['lock.front']={...h.states['lock.front'],state:'unlocking'};c.hass=h;
    const animations=[...c.animationWork.cancels];
    h.states['lock.front'].attributes.battery_level=50;c.hass=h;
    const same=animations.every(a=>c.animationWork.cancels.has(a));
    h.auth={};c.hass=h;return {same,remaining:c.animationWork.cancels.size};
  });
  expect(result).toEqual({same:true,remaining:0});
});
