import {expect,test} from '@playwright/test';

async function mount(page,rows) {
 await page.route('**/tests/fixtures/browser.html',async route=>{
  const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('class extends HTMLElement {}',`class extends HTMLElement {constructor(){super();if(this.localName==='ha-card')this.attachShadow({mode:'open'}).innerHTML='<style>:host {display:block;box-sizing:border-box;position:relative}</style><slot></slot>';}}`)});
 });
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-graph-card'));
 await page.evaluate(rows=>{
  const fixture=document.querySelector('#fixture');fixture.style.cssText='display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:auto;gap:8px;max-width:none';
  window.graphHeightCards=[];window.graphHeightHistory=[];
  const states={'sensor.one':{state:'64.87',attributes:{unit_of_measurement:'%'}},'sensor.two':{state:'60',attributes:{unit_of_measurement:'%'}}};
  const hass=window.makeHass(states);hass.callWS=message=>message.type==='history/history_during_period'?new Promise(resolve=>window.graphHeightHistory.push({message,resolve})):Promise.resolve({});
  for(let i=0;i<2;i++){
   const cell=document.createElement('div');cell.className=`card ${rows==='auto'?'':'fit-rows'}`;cell.style.cssText=`grid-column:span 12;${rows==='auto'?'':`height:${rows*64-8}px;`}`;
   const wrapper=document.createElement('hui-card');const card=document.createElement('nodalia-graph-card');
   card.setConfig({name:i?'Temperatura':'Humedad',icon:i?'mdi:thermometer':'mdi:water-percent',entities:[{entity:'sensor.one',name:'Dormitorio de Rocío',color:i?'#ffaa00':'#94e3fe'},{entity:'sensor.two',name:'Pasillo',color:i?'#ffc677':'#42a5f5'}],points:i?'100':'480',...(i?{min:15,max:25,styles:{card:{padding:'18px',gap:'20px'},icon:{size:'20px'}}}:{max:75}),grid_options:{columns:12,rows},animations:{enabled:false}});card.hass=hass;wrapper.append(card);cell.append(wrapper);fixture.append(cell);window.graphHeightCards.push(card);
  }
 },rows);
}

async function assertContained(page,rows) {
 await expect.poll(()=>page.locator('nodalia-graph-card').evaluateAll((cards,rows)=>cards.every((host,index)=>{
  const card=host.shadowRoot.querySelector('ha-card').getBoundingClientRect();const cell=host.parentElement.parentElement.getBoundingClientRect();const chart=host.shadowRoot.querySelector('.graph-card__chart-wrap').getBoundingClientRect();
  const next=cards[index+1]?.shadowRoot.querySelector('ha-card').getBoundingClientRect();
  return card.height>150&&card.bottom<=cell.bottom+1&&chart.height>30&&chart.bottom<=card.bottom+1&&(!next||card.bottom+7<=next.top)&& (rows!=='auto'||chart.height>=136&&chart.height<=172);
 }),rows)).toBe(true);
}

for(const rows of ['auto',4,8])test(`Graph stays inside ${rows} Sections rows before and after history, resizing and reconnect`,async({page})=>{
 await mount(page,rows);
 for(const width of [980,390,720]){
  await page.setViewportSize({width,height:1500});await assertContained(page,rows);
  await page.evaluate(()=>{
   for(const request of window.graphHeightHistory.splice(0)){const entity=request.message.entity_ids[0];request.resolve({[entity]:[{state:'40',last_changed:request.message.start_time},{state:'60',last_changed:request.message.end_time}]});}
  });
  await expect.poll(()=>page.evaluate(()=>window.graphHeightCards.every(card=>!card._historyAbortController))).toBe(true);
  await assertContained(page,rows);
  await page.locator('nodalia-graph-card').first().locator('.graph-card__legend-item').first().click();await assertContained(page,rows);
 }
 await page.evaluate(()=>{for(const card of window.graphHeightCards){const wrapper=card.parentElement;card.remove();wrapper.append(card);}});await assertContained(page,rows);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

for(const initial of ['auto',4])test(`Graph follows live Sections row changes from ${initial} without remounting`,async({page})=>{
 await mount(page,initial);
 for(const rows of [4,'auto',8,'auto',4]) {
  await page.evaluate(rows=>{
   for(const card of window.graphHeightCards) {
    const cell=card.parentElement.parentElement;
    cell.classList.toggle('fit-rows',rows!=='auto');
    cell.style.height=rows==='auto'?'':`${rows*64-8}px`;
   }
  },rows);
  await expect.poll(()=>page.evaluate(()=>window.graphHeightCards.map(card=>card.parentElement.style.display))).toEqual(rows==='auto'?['block','block']:['','']);
  await assertContained(page,rows);
 }
 // The old cell cannot retain a live observer once the card is removed.
 await page.evaluate(()=>{window.graphHeightOldWrappers=window.graphHeightCards.map(card=>card.parentElement);for(const card of window.graphHeightCards)card.remove();});
 await page.evaluate(()=>{for(const wrapper of window.graphHeightOldWrappers)wrapper.parentElement.classList.remove('fit-rows');});
 await expect.poll(()=>page.evaluate(()=>window.graphHeightOldWrappers.map(wrapper=>wrapper.style.display))).toEqual(['','']);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
