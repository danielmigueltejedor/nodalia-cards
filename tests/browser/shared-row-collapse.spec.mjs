import {expect,test} from '@playwright/test';

// HA's ha-card is a block with its own shadow styles; hui-card uses light DOM
// and remains inline inside the Sections grid cell. Making hui-card itself a
// block grid item hides WebKit's stale intrinsic row height after sibling updates.
async function openSectionsFixture(page) {
 await page.route('**/tests/fixtures/browser.html',async route=>{
  const response=await route.fetch();
  const html=await response.text();
  await route.fulfill({response,body:html.replace('class extends HTMLElement {}',`class extends HTMLElement {
   constructor(){super();if(this.localName==='ha-card') this.attachShadow({mode:'open'}).innerHTML='<style>:host { display:block; box-sizing:border-box; border:1px solid #ddd; transition:all .3s ease-out; position:relative; }</style><slot></slot>';}
  }`)});
 });
 await page.goto('/tests/fixtures/browser.html');
 await page.waitForFunction(()=>customElements.get('nodalia-fav-card'));
}

async function mountRow(page,{tag='nodalia-fav-card',config={},attributes={},columns=2}={}) {
 await openSectionsFixture(page);
 await page.evaluate(({tag,config,attributes,columns})=>{
  const fixture=document.querySelector('#fixture');
  fixture.style.cssText='display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:auto;gap:8px;width:360px;max-width:100%';
  const entity=tag==='nodalia-fav-card'||tag==='nodalia-light-card'?'light.one':tag==='nodalia-fan-card'?'fan.one':'humidifier.one';
  const states={
   [entity]:{state:'off',attributes},
   'alarm_control_panel.one':{state:'disarmed',attributes:{supported_features:63}},
  };
  const hass=window.makeHass(states);
  const cards=[];
  const append=(card,span)=>{
   const cell=document.createElement('div');cell.className='section-cell';cell.style.cssText=`display:block;grid-column:span ${span}`;
   const wrapper=document.createElement('hui-card');wrapper.append(card);cell.append(wrapper);fixture.append(cell);cards.push(card);
  };
  if(columns===2) for(let i=0;i<2;i++) {const chip=document.createElement('div');chip.style.cssText='height:68px';append(chip,2);}
  const card=document.createElement(tag);
  card.setConfig({entity,show_state:false,show_name:false,grid_options:{columns,rows:'auto'},...config});card.hass=hass;append(card,columns);
  const alarm=document.createElement('nodalia-fav-card');
  alarm.setConfig({entity:'alarm_control_panel.one',show_state:false,alarm_show_code_input:false,grid_options:{columns:6,rows:'auto'}});alarm.hass=hass;append(alarm,6);
  const heading=document.createElement('h2');heading.id='next-section';heading.textContent='Weather and information';heading.style.cssText='grid-column:1/-1;margin:0';fixture.append(heading);
  window.rowFixture={card,alarm,entity,states,hass,cards,events:[],resizes:0};
  fixture.addEventListener('card-updated',event=>{
   const {card,events}=window.rowFixture;
   if(event.composedPath().includes(card)) events.push(Math.round(card.getBoundingClientRect().height));
  });
  window.addEventListener('resize',()=>window.rowFixture.resizes++);
  // Feedback applies to all cards just as hui-section forwards a new hass object.
  hass.callService=async()=>{
   states[entity]={...states[entity],state:states[entity].state==='on'?'off':'on'};
   const next=window.makeHass(states);next.callService=hass.callService;
   for(const mounted of cards) if('hass' in mounted) mounted.hass=next;
  };
 },{tag,config,attributes,columns});
 return page.locator(tag).first();
}

const nextTop=page=>page.locator('#next-section').evaluate(node=>node.getBoundingClientRect().top);

test('Alarm collapse releases the row after a neighbouring mini Light favourite toggles with HA feedback',async({page})=>{
 const light=await mountRow(page);
 const alarm=page.locator('nodalia-fav-card').last();
 const initial=await nextTop(page);
 for(let i=0;i<6;i++) {
  await alarm.locator('.fav-card__hero').click();
  await expect(alarm.locator('.fav-card__alarm-panel')).toBeVisible();
  expect(await nextTop(page)).toBeGreaterThan(initial+40);
  await light.locator('.fav-card__icon').click();
  await expect(light.locator('ha-card')).toHaveClass(new RegExp(i%2===0?'is-on':'is-off'));
  await alarm.locator('.fav-card__hero').click();
  await expect.poll(()=>nextTop(page)).toBeCloseTo(initial,1);
 }
 expect(await page.evaluate(()=>window.rowFixture.resizes)).toBe(0);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

for(const [tag,attributes]of [
 ['nodalia-light-card',{supported_color_modes:['brightness'],brightness:128}],
 ['nodalia-fan-card',{supported_features:1,percentage:50}],
 ['nodalia-humidifier-card',{supported_features:1,humidity:50,min_humidity:30,max_humidity:80}],
]) {
 test(`${tag} releases animated controls and reports the settled height after interleaved sibling changes`,async({page})=>{
  const card=await mountRow(page,{tag,columns:6,attributes,config:{animations:{enabled:true,power_duration:120,controls_duration:120}}});
  const alarm=page.locator('nodalia-fav-card');
  const height=()=>card.evaluate(node=>Math.round(node.getBoundingClientRect().height));
  const initialHeight=await height();const initialTop=await nextTop(page);
  await expect.poll(()=>page.evaluate(()=>window.rowFixture.events.length)).toBeGreaterThan(0);
  for(let i=0;i<3;i++) {
   await alarm.locator('.fav-card__hero').click();
   await page.evaluate(()=>window.rowFixture.hass.callService());
   await expect.poll(height).toBeGreaterThan(initialHeight+15);
   await expect.poll(()=>page.evaluate(()=>window.rowFixture.events.at(-1))).toBeGreaterThan(initialHeight+15);
   await alarm.locator('.fav-card__hero').click();
   await page.evaluate(()=>window.rowFixture.hass.callService());
   await expect.poll(height).toBe(initialHeight);
   await expect.poll(()=>nextTop(page)).toBeCloseTo(initialTop,1);
   await expect.poll(()=>page.evaluate(()=>window.rowFixture.events.at(-1))).toBe(initialHeight);
  }
  // A hidden/detached card cannot dispatch a delayed update into its old section.
  const count=await page.evaluate(()=>{const row=window.rowFixture;row.card.style.height='250px';row.card.remove();return row.events.length;});
  await page.waitForTimeout(160);
  expect(await page.evaluate(()=>window.rowFixture.events.length)).toBe(count);
  expect(await page.evaluate(()=>window.rowFixture.resizes)).toBe(0);
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
 });
}

test('Native wrappers restore their layout on detach and preserve explicit layouts, hidden state and embedded cards',async({page})=>{
 await openSectionsFixture(page);
 const result=await page.evaluate(()=>{
  const fixture=document.querySelector('#fixture');
  const make=(tag,display='')=>{
   const wrapper=document.createElement('hui-card');wrapper.style.display=display;
   const cell=document.createElement('div');
   const card=document.createElement(tag);wrapper.append(card);cell.append(wrapper);fixture.append(cell);return {wrapper,card};
  };
  // Cover cards with and without a width observer via the real lazy lifecycle.
  const results=[];
  for(const tag of ['nodalia-climate-card','nodalia-room-summary-card','nodalia-fav-card']) {
   const {wrapper,card}=make(tag);
   results.push(wrapper.style.display);card.remove();results.push(wrapper.style.display);
   wrapper.append(card);results.push(wrapper.style.display);
   wrapper.style.display='none';card.remove();results.push(wrapper.style.display);
  }
  for(const display of ['grid','flex','none','inline']) {
   const {wrapper,card}=make('nodalia-fav-card',display);results.push(wrapper.style.display);card.remove();results.push(wrapper.style.display);
  }
  const embed=document.createElement('div');const embedded=document.createElement('nodalia-light-card');embed.append(embedded);fixture.append(embed);results.push(embed.style.display);embedded.remove();results.push(embed.style.display);
  const {wrapper,card}=make('nodalia-fav-card-editor');results.push(wrapper.style.display);card.remove();results.push(wrapper.style.display);
  return results;
 });
 expect(result).toEqual([
  'block','','block','none','block','','block','none','block','','block','none',
  'grid','grid','flex','flex','none','none','inline','inline','','','','',
 ]);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
