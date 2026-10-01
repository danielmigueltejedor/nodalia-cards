import {expect,test} from '@playwright/test';

async function mount(page,config,pickers=false){
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(()=>customElements.get('nodalia-power-flow-card'));
  await page.evaluate(async({config,pickers})=>{
    if(pickers)for(const tag of ['ha-selector','ha-icon-picker'])if(!customElements.get(tag))customElements.define(tag,class extends HTMLElement{constructor(){super();this.value='';this.hass=null;}});
    const editor=await customElements.get('nodalia-power-flow-card').getConfigElement();
    editor.hass=window.makeHass({'sensor.grid':{state:'120',attributes:{friendly_name:'Grid'}},'sensor.device':{state:'20'},'number.level':{state:'0'},'light.one':{state:'on'}});
    editor.setConfig(config);document.querySelector('#fixture').append(editor);
    window.powerEditorFixture=editor;window.powerEditorChanges=[];
    editor.addEventListener('config-changed',event=>window.powerEditorChanges.push(event.detail.config));
  },{config,pickers});
  return page.locator('nodalia-power-flow-card-editor');
}

test('Power Flow editor retains draft individuals, paired metadata and all energy branches through HA feedback',async({page})=>{
  const editor=await mount(page,{entities:{grid:{entity:'sensor.missing',export_entity:'sensor.export',secondary_info:{entity:'sensor.secondary',decimals:0}},home:{entity:'sensor.grid'},individual:[{entity:'sensor.device',name:'First',icon:'mdi:oven',color:'#ffaa00',secondary_info:{entity:'sensor.energy',unit:'kWh'}}]},custom_extension:{flag:false,count:0}});
  await expect(editor.locator('select[data-field="entities.grid.entity"]')).toHaveValue('sensor.missing');
  await expect(editor.locator('select[data-field="entities.grid.entity"] option[value="light.one"]')).toHaveCount(0);
  await editor.locator('[data-action="add-individual"]').click();
  await editor.locator('input[data-field="entities.individual.1.name"]').fill('Draft device');
  await editor.locator('input[data-field="entities.individual.1.name"]').dispatchEvent('change');
  await page.evaluate(()=>window.powerEditorFixture.setConfig(window.powerEditorChanges.at(-1)));
  await expect(editor.locator('.power-flow-individual-card')).toHaveCount(2);
  await expect(editor.locator('input[data-field="entities.individual.1.name"]')).toHaveValue('Draft device');
  await editor.locator('select[data-field="entities.individual.1.entity"]').selectOption('number.level');
  await editor.locator('[data-action="move-individual-up"][data-index="1"]').click();
  let config=await page.evaluate(()=>window.powerEditorChanges.at(-1));
  expect(config.entities.individual[0]).toMatchObject({entity:'number.level',name:'Draft device'});
  expect(config.entities.individual[1]).toMatchObject({entity:'sensor.device',name:'First',icon:'mdi:oven',color:'#ffaa00',secondary_info:{entity:'sensor.energy',unit:'kWh'}});
  expect(config.entities.grid).toMatchObject({entity:'sensor.missing',export_entity:'sensor.export',secondary_info:{entity:'sensor.secondary',decimals:0}});
  expect(config.entities.home.entity).toBe('sensor.grid');expect(config.custom_extension).toEqual({flag:false,count:0});
  await editor.locator('[data-action="remove-individual"][data-index="0"]').click();
  config=await page.evaluate(()=>window.powerEditorChanges.at(-1));expect(config.entities.individual).toHaveLength(1);expect(config.entities.individual[0].name).toBe('First');
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

test('Power Flow editor bounds row mutations and retains native focused drafts across HA updates',async({page})=>{
  const editor=await mount(page,{entities:{individual:[{entity:'sensor.device',name:'Room'}]},haptics:null,animations:42,display_zero_lines:null});
  const original=await page.evaluate(()=>JSON.stringify(window.powerEditorFixture._config.entities));
  await page.evaluate(()=>{const e=window.powerEditorFixture;for(const path of ['entities.individual.999999.entity','entities.individual.-1.entity','entities.individual.0.unknown','entities.individual.0.__proto__.polluted'])e._setFieldValue(path,'Bad');for(const index of ['-1','0.5','','bad','999999']){const b=document.createElement('button');Object.assign(b.dataset,{action:'remove-individual',index});e.shadowRoot.append(b);b.click();b.remove();}});
  expect(await page.evaluate(()=>JSON.stringify(window.powerEditorFixture._config.entities))).toBe(original);
  const name=editor.locator('input[data-field="entities.individual.0.name"]');await name.fill('Updated room');
  await page.evaluate(()=>window.powerEditorFixture.hass=window.makeHass({'sensor.changed':{state:'10'}}));
  await expect(name).toBeFocused();await expect(name).toHaveValue('Updated room');await name.dispatchEvent('change');
  expect(await page.evaluate(()=>window.powerEditorChanges.at(-1).entities.individual[0].name)).toBe('Updated room');
  await editor.locator('[data-editor-toggle="animations"]').click();await expect(editor.locator('input[data-field="animations.content_duration"]')).toHaveValue('460');
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

test('Power Flow editor uses committed HA values, keeps real zero values and restores cleared numeric defaults',async({page})=>{
  const editor=await mount(page,{entities:{grid:{entity:'sensor.grid',secondary_info:{decimals:0}}},consumption_chips:{day_entity:'sensor.day',month_entity:'sensor.month'},min_flow_rate:0,styles:{card:{background:'rgba(10, 20, 30, 0.3)'}}},true);
  await page.evaluate(()=>{const e=window.powerEditorFixture;for(const [field,value] of [['entities.grid.export_entity','sensor.export'],['consumption_chips.day_entity','sensor.device']]){const p=e.shadowRoot.querySelector(`ha-selector[data-field="${field}"]`);p.dispatchEvent(new CustomEvent('value-changed',{detail:{value},bubbles:true,composed:true}));}const icon=e.shadowRoot.querySelector('ha-icon-picker[data-field="entities.grid.icon"]');icon.dispatchEvent(new CustomEvent('value-changed',{detail:{value:'mdi:flash'},bubbles:true,composed:true}));});
  await expect(editor.locator('input[data-field="min_flow_rate"]')).toHaveValue('0');
  const max=editor.locator('input[data-field="max_flow_rate"]');await max.fill('');await max.dispatchEvent('change');await expect(max).toHaveValue('5.8');
  const config=await page.evaluate(()=>window.powerEditorChanges.at(-1));expect(config.min_flow_rate).toBe(0);expect(config.max_flow_rate).toBeUndefined();expect(config.entities.grid).toMatchObject({entity:'sensor.grid',export_entity:'sensor.export',icon:'mdi:flash',secondary_info:{decimals:0}});expect(config.consumption_chips).toMatchObject({day_entity:'sensor.device',month_entity:'sensor.month'});expect(config.styles.card.background).toBe('rgba(10, 20, 30, 0.3)');
  await editor.locator('[data-editor-toggle="styles"]').click();await expect(editor.locator('input[data-field="styles.card.background"]')).toHaveValue('rgba(10, 20, 30, 0.3)');
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
