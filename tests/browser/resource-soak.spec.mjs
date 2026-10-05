import {expect,test} from '@playwright/test';

// Track active resources rather than heap noise. Detached DOM listeners are
// collectible with their nodes; global listeners are the retaining boundary.
async function installLedger(page) {
 await page.addInitScript(()=>{
  const timers=new Map(),frames=new Set(),observers=new Map(),listeners=new Map(),ids=new WeakMap();let id=0;
  const identity=value=>{if(!ids.has(value))ids.set(value,++id);return ids.get(value);};
  const owned=()=>new Error().stack?.includes('nodalia-');
  const sleep=window.setTimeout.bind(window);
  for(const [start,stop,repeat] of [['setTimeout','clearTimeout',false],['setInterval','clearInterval',true]]){
   const original=window[start].bind(window),clear=window[stop].bind(window);
   window[start]=function(callback,delay,...args){if(!owned()||typeof callback!=='function')return original(callback,delay,...args);let handle;handle=original((...values)=>{if(!repeat)timers.delete(handle);callback(...values);},delay,...args);timers.set(handle,start);return handle;};
   window[stop]=handle=>{timers.delete(handle);return clear(handle);};
  }
  const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
  window.requestAnimationFrame=callback=>{const track=owned();let handle;handle=raf(time=>{frames.delete(handle);callback(time);});if(track)frames.add(handle);return handle;};
  window.cancelAnimationFrame=handle=>{frames.delete(handle);return cancel(handle);};
  for(const name of ['ResizeObserver','MutationObserver','IntersectionObserver']){
   const Native=window[name];if(!Native)continue;
   window[name]=class extends Native {
    constructor(callback){super(callback);this.tracked=owned();this.targets=new Set();}
    observe(target,...args){super.observe(target,...args);if(this.tracked){this.targets.add(target);observers.set(this,this.targets);}}
    unobserve(target){super.unobserve(target);this.targets.delete(target);if(!this.targets.size)observers.delete(this);}
    disconnect(){super.disconnect();this.targets.clear();observers.delete(this);}
   };
  }
  const add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
  const key=(target,type,listener,options)=>`${identity(target)}:${type}:${identity(listener)}:${Boolean(typeof options==='boolean'?options:options?.capture)}`;
  const globalTarget=target=>target===window||target===document||target===window.visualViewport;
  EventTarget.prototype.addEventListener=function(type,listener,options){if(listener&&globalTarget(this)&&owned())listeners.set(key(this,type,listener,options),type);return add.call(this,type,listener,options);};
  EventTarget.prototype.removeEventListener=function(type,listener,options){if(listener&&globalTarget(this))listeners.delete(key(this,type,listener,options));return remove.call(this,type,listener,options);};
  const nodeCount=root=>[...root.querySelectorAll('*')].reduce((sum,node)=>sum+1+(node.shadowRoot?nodeCount(node.shadowRoot):0),0);
  window.resourceLedger={sleep:ms=>new Promise(resolve=>sleep(resolve,ms)),snapshot:()=>({timers:timers.size,frames:frames.size,observers:observers.size,listeners:listeners.size,dom:nodeCount(document)})};
 });
}
const cases=[
 ['nodalia-media-player',{entity:'media_player.one',layout:'compact'}],
 ['nodalia-navigation-bar',{routes:[],media_player:{players:[{entity:'media_player.one'}]}}],
 ['nodalia-camera-card',{entity:'camera.one',cameras:['camera.one']}],
 ['nodalia-climate-card',{entity:'climate.one'}],
 ['nodalia-advance-vacuum-card',{entity:'vacuum.one',map_source:{camera:'image.map'},room_tracking:{auto_detect:false}}],
 ['nodalia-vacuum-card',{entity:'vacuum.one'}],
 ['nodalia-notifications-card',{weather_entities:['weather.one'],calendar_entities:['calendar.one'],mobile_notifications:{enabled:false}}],
 ['nodalia-calendar-card',{calendars:['calendar.one'],weather_entity:'weather.one'}],
 ['nodalia-weather-card',{entity:'weather.one',show_forecast_details:true}],
 ['nodalia-graph-card',{entities:['sensor.one'],points:80}],
 ['nodalia-fav-card',{entity:'alarm_control_panel.one',alarm_show_code_input:false}],
 ['nodalia-room-summary-card',{name:'Room',lights:['light.one'],fans:['fan.one'],locks:['lock.one'],camera:'camera.one',media_player:'media_player.one',show_media:true,show_camera:true}],
];
const cycles=Number(process.env.NODALIA_SOAK_CYCLES||24);
if(!Number.isSafeInteger(cycles)||cycles<24||cycles>500)throw new Error('NODALIA_SOAK_CYCLES must be an integer from 24 to 500');
for(const [tag,config]of cases)test(`${tag} releases resources over ${cycles} mount/update/interact/reconnect/entity/remount cycles`,async({page},info)=>{
 test.setTimeout(Math.max(90_000,cycles*1000));await installLedger(page);
 await page.route('**/api/camera_proxy/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#2277bb"/></svg>'}));
 await page.route('**/soak-artwork*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#2277bb"/></svg>'}));
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(tag=>customElements.get(tag),tag);
 const results=await page.evaluate(async({tag,config,cycles})=>{
  const ledger=window.resourceLedger,root=document.querySelector('#fixture');let subscriptions=0,pending=0,updates=0;
  const base={
   'media_player.one':{state:'playing',attributes:{media_title:'Track',media_artist:'Artist',entity_picture:'/soak-artwork.svg',media_duration:240,media_position:0,volume_level:.5,supported_features:152461}},
   'camera.one':{state:'idle',attributes:{access_token:'soak',entity_picture:'/soak-artwork.svg'}},
   'climate.one':{state:'heat',attributes:{temperature:21,current_temperature:20,min_temp:5,max_temp:35,hvac_modes:['off','heat','auto'],supported_features:1}},
   'vacuum.one':{state:'docked',attributes:{battery_level:100,supported_features:8191,fan_speed:'balanced',fan_speed_list:['quiet','balanced','turbo']}},
   'weather.one':{state:'rainy',attributes:{temperature:0,temperature_unit:'°C',humidity:50,supported_features:3,forecast:[]}},
   'calendar.one':{state:'off',attributes:{supported_features:2}},'sensor.one':{state:'0',attributes:{unit_of_measurement:'W'}},
   'image.map':{state:'2026-10-05',attributes:{entity_picture:'/soak-artwork.svg'}},
   'alarm_control_panel.one':{state:'disarmed',attributes:{supported_features:63}},
   'light.one':{state:'off',attributes:{supported_color_modes:['brightness'],brightness:128}},
   'fan.one':{state:'off',attributes:{supported_features:1,percentage:50}},'lock.one':{state:'locked',attributes:{}},
  };
  for(const [entity,state]of Object.entries({...base}))base[entity.replace('.one','.two')]={...state,attributes:{...state.attributes}};
  const connection={subscribeMessage(_callback,_message){subscriptions++;let active=true;return Promise.resolve(()=>{if(active){active=false;subscriptions--;}});}};
  const hass=window.createHassFixture({entities:base,overrides:{connection,auth:{},user:{id:'soak',is_admin:true},callApi:async()=>[],callWS:async message=>{pending++;try{await Promise.resolve();return message.type==='nodalia/status'?{available:false}:{};}finally{pending--;}}}});
  const make=()=>{const card=document.createElement(tag);card.setConfig({...config,animations:{enabled:false}});card.hass=hass;root.append(card);return card;};
  const snapshots=[];
  for(let cycle=0;cycle<cycles;cycle++){
   let card=make();await ledger.sleep(70);
   if(tag==='nodalia-room-summary-card'){
    if(!card.shadowRoot.querySelector('nodalia-media-player'))throw new Error('Summary soak must exercise its embedded Media Player');
    card.shadowRoot.querySelector('[data-room-action="nav:lights"]')?.click();
    if(!card.shadowRoot.querySelector('nodalia-light-card'))throw new Error('Summary soak must exercise its embedded Light');
    card.shadowRoot.querySelector('[data-room-action="nav:home"]')?.click();
   }
   for(let n=0;n<40;n++){hass.states['sensor.one'].state=String(n%2?0:-n);hass.states['media_player.one'].attributes.media_position=n;card.hass={...hass};updates++;}
   // Use real event handlers with service calls contained by the HA fixture.
   const button=card.shadowRoot?.querySelector('button:not([disabled]):not([data-path])');button?.click();
   const slider=card.shadowRoot?.querySelector('input[type=range]');if(slider){slider.value='60';slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}));}
   window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1}));
   card.remove();root.append(card);await ledger.sleep(30);
   const next=JSON.parse(JSON.stringify(config).replaceAll('.one','.two'));card.setConfig({...next,animations:{enabled:false}});card.hass=hass;
   card.remove();card=null;await ledger.sleep(120);
   snapshots.push({...ledger.snapshot(),subscriptions,pending});
  }
  await ledger.sleep(800);
  return {tag,cycles,updates,snapshots,settled:{...ledger.snapshot(),subscriptions,pending},errors:window.bundleErrors};
 },{tag,config,cycles});
 const baseline=results.snapshots[0];
 // Once shared modules warm up, no retained resources may grow with remounts.
 for(const snapshot of results.snapshots.slice(1))expect(snapshot).toEqual(baseline);
 expect(results.settled).toEqual(baseline);expect(results.settled.subscriptions).toBe(0);expect(results.settled.pending).toBe(0);expect(results.settled.observers).toBe(0);expect(results.settled.frames).toBe(0);expect(results.errors).toEqual([]);
 await info.attach('resource-soak.json',{body:JSON.stringify(results,null,2),contentType:'application/json'});
});
