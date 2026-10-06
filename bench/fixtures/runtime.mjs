import { createHassFixture } from '../../tests/fixtures/hass.mjs';

export function observeMutations(documentRoot, onRecords) {
  const roots = new WeakSet(), NativeObserver = window.MutationObserver;
  const observer = new NativeObserver(records => { onRecords(records); for (const record of records) for (const node of record.addedNodes) scan(node); });
  const observe = root => { if (!root || roots.has(root)) return; roots.add(root); observer.observe(root,{subtree:true,childList:true,attributes:true,characterData:true}); scan(root); };
  function scan(root) { if(root.shadowRoot) observe(root.shadowRoot); for(const node of root.querySelectorAll?.('*') || []) if(node.shadowRoot) observe(node.shadowRoot); }
  const original = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function(options) { const root = original.call(this,options); observe(root); return root; };
  observe(documentRoot);
  return { flush:()=>onRecords(observer.takeRecords()), disconnect:()=>{ observer.disconnect(); Element.prototype.attachShadow=original; } };
}

const emptyCounts = () => ({ mutations:0, childList:0, attributes:0, characterData:0, removedNodes:0, renderCalls:0, renderBoundaryMs:0, fullRenders:0, overlayBuilds:0, renderedFrames:0, preloadImages:0, artworkSamples:0, artworkSamplingMs:0, catalogScans:0, historyIngestionMs:0, numericProcessingMs:0, svgRenderingMs:null });
let counts = emptyCounts(), lastMutation = performance.now(), pending = 0, subscriptions = 0, measurement = false, errors = [];
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
const shortTimers = new Set(), activeFrames = new Set(), nativeTimeout=window.setTimeout.bind(window), nativeClearTimeout=window.clearTimeout.bind(window);
const runtimeOwned = () => new Error().stack?.includes('nodalia-cards.js');
window.setTimeout = (callback,delay,...args) => {
 if(typeof callback!=='function')return nativeTimeout(callback,delay,...args);
 const owned=Number(delay)<=250&&runtimeOwned();let handle;
 handle=nativeTimeout((...values)=>{shortTimers.delete(handle);callback(...values);},delay,...args);
 if(owned)shortTimers.add(handle);return handle;
};
window.clearTimeout=handle=>{shortTimers.delete(handle);return nativeClearTimeout(handle);};
const mutate = records => { if(!records.length)return; lastMutation=performance.now(); if(!measurement)return; for(const row of records){counts.mutations++;counts[row.type]++;if(row.type==='childList')counts.removedNodes+=row.removedNodes.length;} };
let observer = observeMutations(document,mutate);
addEventListener('error',event=>errors.push(event.message));
addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
for(const tag of ['ha-card','ha-icon']) if(!customElements.get(tag))customElements.define(tag,class extends HTMLElement {constructor(){super();if(this.localName==='ha-card')this.attachShadow({mode:'open'}).innerHTML='<style>:host{display:block;box-sizing:border-box;position:relative}</style><slot></slot>';}});
const nativeImage = window.Image;
window.Image = new Proxy(nativeImage,{construct(target,args){if(measurement)counts.preloadImages++;return Reflect.construct(target,args);}});
const nativeRaf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = callback => {let handle;handle=nativeRaf(time=>{activeFrames.delete(handle);if(measurement)counts.renderedFrames++;return callback(time);});activeFrames.add(handle);return handle;};
const nativeCancelFrame=window.cancelAnimationFrame.bind(window);
window.cancelAnimationFrame=handle=>{activeFrames.delete(handle);return nativeCancelFrame(handle);};
const nativeSample = CanvasRenderingContext2D.prototype.getImageData;
CanvasRenderingContext2D.prototype.getImageData = function(...args) {const start=performance.now();try{return nativeSample.apply(this,args);}finally{if(measurement){counts.artworkSamples++;counts.artworkSamplingMs+=performance.now()-start;}}};
const wrapped = new WeakSet();
function instrument(card) {
  const proto=Object.getPrototypeOf(card);if(wrapped.has(proto))return;wrapped.add(proto);
  for(const [method,metric] of [['_render','renderCalls'],['_renderView','fullRenders'],['_renderMapOverlays','overlayBuilds'],['_normalizeHistorySeries','historyIngestionMs'],['_buildChartSeries','numericProcessingMs']]) {
    const original=proto[method];if(typeof original!=='function')continue;
    proto[method]=function(...args){const start=performance.now();if(measurement&&!metric.endsWith('Ms'))counts[metric]++;try{return original.apply(this,args);}finally{if(measurement&&metric.endsWith('Ms'))counts[metric]+=performance.now()-start;if(measurement&&method==='_render')counts.renderBoundaryMs+=performance.now()-start;}};
  }
}
const base = {
 'light.one':{state:'on',attributes:{friendly_name:'Light',supported_color_modes:['brightness'],brightness:128}},
 'fan.one':{state:'on',attributes:{friendly_name:'Fan',supported_features:1,percentage:50}},
 'humidifier.one':{state:'on',attributes:{friendly_name:'Humidifier',humidity:50,current_humidity:45,min_humidity:20,max_humidity:80,available_modes:['auto','normal'],mode:'auto',supported_features:1}},
 'climate.one':{state:'heat',attributes:{friendly_name:'Climate',temperature:21,current_temperature:20,min_temp:5,max_temp:35,hvac_modes:['off','heat','auto'],supported_features:1}},
 'sensor.one':{state:'20',attributes:{friendly_name:'Metric',unit_of_measurement:'°C'}},
 'sensor.two':{state:'10',attributes:{friendly_name:'Other metric',unit_of_measurement:'W'}},
 'sensor.unrelated':{state:'1',attributes:{friendly_name:'Unrelated'}},
 'media_player.one':{state:'paused',attributes:{friendly_name:'Speaker',media_title:'Track',media_artist:'Artist',media_content_id:'track',entity_picture:'/bench/artwork/warm.svg',media_duration:240,media_position:0,volume_level:.5,supported_features:152461}},
 'vacuum.one':{state:'docked',attributes:{friendly_name:'Robot',battery_level:100,supported_features:8191,fan_speed:'balanced',fan_speed_list:['quiet','balanced','turbo']}},
 'weather.one':{state:'rainy',attributes:{friendly_name:'Weather',temperature:15,temperature_unit:'°C',humidity:50,supported_features:3,forecast:[]}},
 'calendar.one':{state:'off',attributes:{friendly_name:'Calendar',supported_features:2}},
 'alarm_control_panel.one':{state:'disarmed',attributes:{friendly_name:'Alarm',supported_features:63}},
 'lock.one':{state:'locked',attributes:{friendly_name:'Lock'}},
 'cover.one':{state:'open',attributes:{friendly_name:'Cover',current_position:50,supported_features:15}},
 'person.one':{state:'home',attributes:{friendly_name:'Person'}},
 'scene.one':{state:'2026-10-05',attributes:{friendly_name:'Scene'}},
 'camera.one':{state:'idle',attributes:{friendly_name:'Camera',entity_picture:'/bench/artwork/warm.svg',access_token:'fixture'}},
 'image.map':{state:'2026-10-05',attributes:{entity_picture:'/bench/artwork/map.svg'}},
 'sensor.battery':{state:'50',attributes:{unit_of_measurement:'%'}},
 'sensor.solar':{state:'1200',attributes:{unit_of_measurement:'W'}},
 'sensor.grid':{state:'200',attributes:{unit_of_measurement:'W'}},
 'sensor.home':{state:'1000',attributes:{unit_of_measurement:'W'}},
};
export const cases = [
 ['light','nodalia-light-card',{entity:'light.one'},'light.one'],
 ['fan','nodalia-fan-card',{entity:'fan.one'},'fan.one'],
 ['humidifier','nodalia-humidifier-card',{entity:'humidifier.one'},'humidifier.one'],
 ['climate','nodalia-climate-card',{entity:'climate.one'},'climate.one'],
 ['entity','nodalia-entity-card',{entity:'sensor.one'},'sensor.one'],
 ['fav','nodalia-fav-card',{entity:'light.one'},'light.one'],
 ['gauge','nodalia-circular-gauge-card',{entity:'sensor.one'},'sensor.one'],
 ['graph','nodalia-graph-card',{entities:['sensor.one'],points:100},'sensor.one'],
 ['media','nodalia-media-player',{players:[{entity:'media_player.one'}],layout:{mode:'standard',fixed:false,show_desktop:true}},'media_player.one'],
 ['vacuum','nodalia-vacuum-card',{entity:'vacuum.one'},'vacuum.one'],
 ['weather','nodalia-weather-card',{entity:'weather.one',show_forecast_details:true},'weather.one'],
 ['calendar','nodalia-calendar-card',{calendars:['calendar.one'],weather_entity:'weather.one'},'calendar.one'],
 ['power-flow','nodalia-power-flow-card',{solar_entity:'sensor.solar',grid_entity:'sensor.grid',home_entity:'sensor.home'},'sensor.solar'],
 ['cover','nodalia-cover-card',{entity:'cover.one'},'cover.one'],
 ['alarm','nodalia-alarm-panel-card',{entity:'alarm_control_panel.one',show_code_input:false},'alarm_control_panel.one'],
 ['lock','nodalia-lock-card',{entity:'lock.one'},'lock.one'],
 ['advance-vacuum','nodalia-advance-vacuum-card',{entity:'vacuum.one',map_source:{camera:'image.map'},room_tracking:{auto_detect:false},calibration_source:{calibration_points:[{map:{x:0,y:0},vacuum:{x:0,y:0}},{map:{x:1024,y:0},vacuum:{x:1024,y:0}},{map:{x:0,y:1024},vacuum:{x:0,y:1024}}]},room_segments:[{id:'1',label:'Kitchen',outline:[[20,20],[1000,20],[1000,1000],[20,1000]]}]},'vacuum.one'],
 ['insignia','nodalia-insignia-card',{entity:'sensor.one'},'sensor.one'],
 ['person','nodalia-person-card',{entity:'person.one'},'person.one'],
 ['scenes','nodalia-scenes-card',{scenes:[{entity:'scene.one'}]},'scene.one'],
 ['notifications','nodalia-notifications-card',{weather_entities:['weather.one'],calendar_entities:['calendar.one'],mobile_notifications:{enabled:false}},'weather.one'],
 ['news','nodalia-news-card',{feeds:[],items:[]},'sensor.one'],
 ['camera','nodalia-camera-card',{entity:'camera.one',cameras:['camera.one']},'camera.one'],
 ['summary','nodalia-room-summary-card',{name:'Room',lights:['light.one'],fans:['fan.one'],media_player:'media_player.one',show_media:true},'light.one'],
 ['navigation','nodalia-navigation-bar',{routes:[],media_player:{players:[{entity:'media_player.one'}]}},'media_player.one'],
];
let history=[], state=null;
function hassFixture() {
 const hass=createHassFixture({entities:structuredClone(base),overrides:{user:{id:'benchmark',is_admin:true},auth:{},connection:{subscribeMessage(callback,message){subscriptions++;let active=true;if(message.type==='weather/subscribe_forecast')queueMicrotask(()=>callback({forecast:[]}));return Promise.resolve(()=>{if(active){active=false;subscriptions--;}});}},
  callApi:async(_method,path)=>{pending++;try{return String(path).includes('history')?[history]:[];}finally{pending--;}},
  callWS:async message=>{pending++;try{return message.type==='nodalia/status'?{available:false}:message.type==='history/history_during_period'?{'sensor.one':history}:message.type==='recorder/statistics_during_period'?{}:message.type==='camera/sign_path'?{path:'/bench/artwork/warm.svg'}:message.type==='weather/get_forecasts'?{'weather.one':{forecast:[]}}:{children:[]};}finally{pending--;}}
 }});
 const states=hass.states;hass.states=new Proxy(states,{ownKeys(target){if(measurement)counts.catalogScans++;return Reflect.ownKeys(target);}});
 return hass;
}
function nodeCount(root=document) { return [...root.querySelectorAll('*')].reduce((sum,node)=>sum+1+(node.shadowRoot?nodeCount(node.shadowRoot):0),0); }
async function settle(config) {
 const start=performance.now();let stable=0;
 while(performance.now()-start < config.settleTimeoutMs){await sleep(5);observer.flush();const artworkPending=(state?.cards||[]).some(card=>card._pendingArtworkPreloads?.size || card._artworkWatches?.size);const ready=performance.now()-lastMutation>=config.quietMs && pending===0 && shortTimers.size===0 && activeFrames.size===0 && !artworkPending && [...document.images].every(image=>image.complete);stable=ready?stable+1:0;if(stable>=2)return;}
 throw new Error(`Settle timeout (${config.settleTimeoutMs}ms)`);
}
async function measure(config,operation) {
 observer.flush();counts=emptyCounts();measurement=true;lastMutation=performance.now();let workMs=0;const start=performance.now();
 const dispatch=fn=>{const begin=performance.now();try{return fn();}finally{workMs+=performance.now()-begin;}};
 try {const extra=await operation(dispatch)||{};await settle(config);observer.flush();const totalMs=performance.now()-start;return {workMs,settleMs:totalMs-workMs,totalMs,...counts,paletteWorkMs:null,...extra};}
 finally {measurement=false;}
}
function make(row,hass=state?.hass||hassFixture()) { const [,tag,config]=row;const card=document.createElement(tag);instrument(card);card.setConfig({...config,animations:{enabled:false}});card.hass=hass;document.querySelector('#fixture').append(card);return card; }
async function reset() {if(state?.cards)for(const card of state.cards)card.remove();const fixture=document.querySelector('#fixture');fixture.replaceChildren();fixture.style.width='';state=null;history=[];await sleep(80);localStorage.clear();sessionStorage.clear();observer.disconnect();observer=observeMutations(document,mutate);}
function change(hass,entity,index,relevant=false) {
 const current=hass.states[entity];if(!current)return;
 const attributes={...current.attributes};let value=String(index);
 if(relevant&&entity.startsWith('media_player.')) {value='paused';attributes.media_title=`Track ${index}`;attributes.media_content_id=`track-${index}`;attributes.media_position=index%240;}
 else if(relevant&&entity.startsWith('weather.')) {value='rainy';attributes.temperature=15+index%5;}
 else if(relevant&&!entity.startsWith('sensor.')) {value=current.state;attributes.brightness=100+index%150;attributes.percentage=20+index%80;attributes.current_temperature=20+index%5;attributes.battery_level=50+index%40;attributes.friendly_name=`Fixture ${index}`;}
 hass.states[entity]={...current,state:value,attributes};
}
async function updates(dispatch,card,entity,count,relevant) { for(let i=0;i<count;i++){change(state.hass,entity,i,relevant);dispatch(()=>{card.hass={...state.hass};});await Promise.resolve();} }
export function touchEvent(type,target,points) {
 const legacy=typeof document.createTouch==='function' && typeof document.createTouchList==='function';
 const touches=points.map((p,i)=>legacy
  ? document.createTouch(window,target,i+1,p.clientX+scrollX,p.clientY+scrollY,p.clientX,p.clientY)
  : new Touch({identifier:i+1,target,...p}));
 const list=legacy?document.createTouchList(...touches):touches;
 return new TouchEvent(type,{bubbles:true,composed:true,cancelable:true,touches:list,targetTouches:list,changedTouches:list});
}

window.bench = {
 cases,
 async load(version) { const start=performance.now();const pendingImport=import(`../releases/${version}/nodalia-cards.js`);const workMs=performance.now()-start;await pendingImport;const totalMs=performance.now()-start;return {workMs,settleMs:totalMs-workMs,totalMs}; },
 async supported() {return cases.filter(row=>customElements.get(row[1])).map(row=>row[0]);},
 async prepare(scenario,config) {
  await reset();errors=[];const parts=scenario.split('/'),id=parts[1];let row=cases.find(row=>row[0]===id);
  state={hass:hassFixture(),cards:[],row};
  if(parts[0]==='helpers'){
   for(let i=0;i<1700;i++)state.hass.states[`sensor.catalog_${i}`]={state:'0',attributes:{friendly_name:`Unrelated catalog ${i}`}};
   state.hass.states['sensor.one_current_room']={state:'1',attributes:{friendly_name:'Robot current room'}};
   state.hass.states['sensor.one_activity']={state:'cleaning',attributes:{friendly_name:'Robot cleaning status'}};
   state.hass.states['vacuum.two']=structuredClone(state.hass.states['vacuum.one']);
   row=[...row];row[2]={...row[2],room_tracking:parts[2]==='explicit'?{auto_detect:false,entity:'sensor.one_current_room',activity_entity:'sensor.one_activity'}:{auto_detect:true}};state.row=row;
   state.catalogEntities=Object.keys(state.hass.states).length;
  }
  if(parts[0]==='dashboard'&&parts[1]!=='mount'){state.cards=cases.filter(row=>config.commonCards.includes(row[0])).map(row=>make(row,state.hass));}
  else if(row && parts[0]!=='mount' && parts[0]!=='lifecycle')state.cards=[make(row,state.hass)];
  if(parts[0]==='sections'){
   const cell=document.createElement('div'),wrapper=document.createElement('hui-card');cell.className=parts[2]==='auto'?'card fit-rows':'card';cell.style.height=parts[2]==='auto'?'248px':'';
   wrapper.append(state.cards[0]);cell.append(wrapper);document.querySelector('#fixture').append(cell);state.sectionsCell=cell;
  }
  await settle(config);
  if(parts[0]==='artwork'&&parts[2]==='cached'){
   const current=state.hass.states['media_player.one'];state.hass.states['media_player.one']={...current,attributes:{...current.attributes,entity_picture:'/bench/artwork/cached-other.svg',media_content_id:'cached-other'}};
   state.cards[0].hass={...state.hass};await settle(config);
  }
  if(parts[0]==='graph'){
   const n=Number(parts[2]),start=performance.now(),now=Date.now();
   history=Array.from({length:n},(_,i)=>({entity_id:'sensor.one',state:String(20+Math.sin(i/30)),last_changed:new Date(now-86400000+i*86400000/n).toISOString(),last_updated:new Date(now-86400000+i*86400000/n).toISOString(),attributes:{unit_of_measurement:'°C'}}));
   state.historyGenerationMs=performance.now()-start;
  }
  if(parts[0]==='gesture'||parts[0]==='map-updates'){
   if(parts[2]==='touch')try{touchEvent('touchstart',document.body,[{clientX:1,clientY:1}]);state.nativeTouchAvailable=true;}catch(error){state.nativeTouchFailure=String(error.message);}
   const card=state.cards[0];card.shadowRoot.querySelector('[data-mode-id="rooms"]')?.click();await settle(config);
   const image=card.shadowRoot.querySelector('[data-map-image]');if(!image?.naturalWidth)throw new Error('Map fixture has not loaded');
  }
 },
 async run(scenario,config) {
  const [kind,id,arg,detail]=scenario.split('/'),card=state.cards[0],row=state.row;
  let skipped=[];if(kind==='gesture' && arg==='touch' && !state.nativeTouchAvailable)return {metrics:{},skipped:[`Native touch construction unavailable: ${state.nativeTouchFailure}`],errors:[]};
  const metrics=await measure(config,async dispatch=>{
   if(kind==='mount'){state.cards=[dispatch(()=>make(row,state.hass))];}
   else if(kind==='warm-remount'){dispatch(()=>{card.remove();document.querySelector('#fixture').append(card);});}
   else if(kind==='unrelated'||kind==='relevant')await updates(dispatch,card,kind==='unrelated'?'sensor.unrelated':row[3],config.assignments,kind==='relevant');
   else if(kind==='dashboard'&&id==='mount')state.cards=cases.filter(row=>config.commonCards.includes(row[0])).map(row=>dispatch(()=>make(row,state.hass)));
   else if(kind==='dashboard')for(let i=0;i<config.assignments;i++){change(state.hass,id==='unrelated'?'sensor.unrelated':'sensor.one',i,true);for(const current of state.cards)dispatch(()=>{current.hass={...state.hass};});await Promise.resolve();}
   else if(kind==='helpers'){
    if(arg==='robot-switch')dispatch(()=>{card.setConfig({...row[2],entity:'vacuum.two',animations:{enabled:false}});card.hass={...state.hass};});
    else await updates(dispatch,card,'sensor.unrelated',config.assignments,false);
    return {catalogEntities:state.catalogEntities,helpersExplicit:arg==='explicit'?1:0};
   }
   else if(kind==='engine-session'){
    const bridge=window.NodaliaBackend;if(typeof bridge?.setVacuumSession!=='function'){skipped.push('API v3 vacuum session bridge unavailable');return {};}
    const commands=[],hass={...state.hass,connection:{},callWS:async message=>{commands.push(message);return message.type==='nodalia/status'?{available:true,api_version:3,api_min_version:1,api_max_version:3,capabilities:['vacuum_sessions']}:{ok:true,revision:1,session:{repeats:1}};}};
    await dispatch(()=>bridge.status(hass));await dispatch(()=>bridge.getVacuumSession(hass,'vacuum.one'));await dispatch(()=>bridge.setVacuumSession(hass,'vacuum.one',{repeats:1},0));
    return {engineCommands:commands.length,engineV3Commands:commands.filter(command=>command.api_version===3).length};
   }
   else if(kind==='tracks')await updates(dispatch,card,'media_player.one',Number(arg),true);
   else if(kind==='artwork'){
    const current=state.hass.states['media_player.one'];const url=arg==='failed'?'/bench/artwork/failed.svg':arg==='cached'?'/bench/artwork/warm.svg':`/bench/artwork/cold-${crypto.randomUUID()}.svg`;
    state.hass.states['media_player.one']={...current,attributes:{...current.attributes,entity_picture:url,media_content_id:url}};dispatch(()=>{card.hass={...state.hass};});
    return {artworkUrl:url,artworkFailureExpected:arg==='failed'};
   }
   else if(kind==='graph'){
    const n=Number(arg);
    dispatch(()=>{card.setConfig({...row[2],points:Math.min(n,10000),animations:{enabled:false}});card.hass={...state.hass};});return {historyGenerationMs:state.historyGenerationMs,historyInputPoints:n};
   }
   else if(kind==='graph-toggle'){const button=card.shadowRoot.querySelector('[data-graph-series]');if(!button)throw new Error('Graph legend toggle missing');for(let i=0;i<20;i++)dispatch(()=>button.click());}
   else if(kind==='resize'){const fixture=document.querySelector('#fixture'),width=fixture.clientWidth;dispatch(()=>{fixture.style.width=`${Math.floor(width*.65)}px`;window.dispatchEvent(new Event('resize'));});}
   else if(kind==='sections'){dispatch(()=>{state.sectionsCell.classList.toggle('fit-rows',arg==='fixed');state.sectionsCell.style.height=arg==='fixed'?'248px':'';card.setConfig({...row[2],grid_options:{columns:12,rows:arg==='fixed'?4:'auto'},animations:{enabled:false}});card.hass={...state.hass};});}
   else if(kind==='gesture'){
    const surface=card.shadowRoot.querySelector('[data-map-surface]'),marker=card.shadowRoot.querySelector('button[data-room-id="1"]'),image=card.shadowRoot.querySelector('[data-map-image]'),rect=surface.getBoundingClientRect(),x=rect.x+rect.width/2,y=rect.y+rect.height/2,mapScaleBefore=card._mapScale;
    const points=distance=>[{clientX:x-distance/2,clientY:y},{clientX:x+distance/2,clientY:y}];
    const event=(type,p)=>arg==='touch'?touchEvent(type,surface,p):new PointerEvent(type,{bubbles:true,composed:true,cancelable:true,pointerId:p[0],pointerType:'touch',clientX:p[1],clientY:y});
    if(arg==='touch')dispatch(()=>surface.dispatchEvent(event('touchstart',points(80))));else for(const [pid,sign]of[[1,-1],[2,1]])dispatch(()=>surface.dispatchEvent(event('pointerdown',[pid,x+sign*40])));
    let feedbackUpdates=0,mapFeedbackUpdates=0;
    for(let i=0;i<Number(detail);i++){
     if(arg==='touch')dispatch(()=>surface.dispatchEvent(event('touchmove',points(80+i/Number(detail)*80))));else for(const [pid,sign]of[[1,-1],[2,1]])dispatch(()=>surface.dispatchEvent(event('pointermove',[pid,x+sign*(40+i/Number(detail)*40)])));
     // Change consumed robot state and map frames, rather than sending identical
     // HA snapshots which would only exercise unrelated-update guards.
     if(i%4===0){
      const robot=state.hass.states['vacuum.one'],map=state.hass.states['image.map'];
      state.hass.states['vacuum.one']={...robot,state:'cleaning',attributes:{...robot.attributes,battery_level:50+i%50}};
      state.hass.states['image.map']={...map,state:`frame-${i}`,attributes:{...map.attributes,entity_picture:`/bench/artwork/map.svg?frame=${i}`}};
      feedbackUpdates++;mapFeedbackUpdates++;
      dispatch(()=>{card.hass={...state.hass};});await new Promise(resolve=>nativeRaf(resolve));
     }
    }
    const gestureFullRenders=typeof card._renderView==='function'?counts.fullRenders:null,gestureOverlayBuilds=typeof card._renderMapOverlays==='function'?counts.overlayBuilds:null,mapScaleAfter=card._mapScale;
    const markerStable=marker===card.shadowRoot.querySelector('button[data-room-id="1"]'),imageStable=image===card.shadowRoot.querySelector('[data-map-image]');
    if(arg==='touch')dispatch(()=>surface.dispatchEvent(event('touchend',[])));else for(const pid of [1,2])dispatch(()=>surface.dispatchEvent(event('pointerup',[pid,x])));
    if(mapScaleBefore===mapScaleAfter)skipped.push(`${arg} gesture did not change the map scale in this release; no performance delta is valid`);
    return {gestureFullRenders,gestureOverlayBuilds,mapScaleBefore,mapScaleAfter,feedbackUpdates,mapFeedbackUpdates,markerIdentity:markerStable?1:0,mapImageIdentity:imageStable?1:0};
   }
   else if(kind==='states'){
    for(let i=0;i<Number(arg);i++){const current=state.hass.states['lock.one'];state.hass.states['lock.one']={...current,state:['unlocking','unlocked','locking','locked'][i%4]};dispatch(()=>{card.hass={...state.hass};});await new Promise(nativeRaf);}
    return {stateUpdates:Number(arg)};
   }
   else if(kind==='map-updates'){
    const selectors=['[data-map-image]','.advance-vacuum-card__map-surface','.advance-vacuum-card__map-svg','button[data-room-id="1"]'];
    const layers=selectors.map(s=>card.shadowRoot.querySelector(s));
    let mapMutations=0,mapRemovedNodes=0;
    const belongsToMap=node=>node instanceof Element && !!node.closest('.advance-vacuum-card__map');
    const record=records=>{for(const r of records){if(belongsToMap(r.target)||[...r.addedNodes,...r.removedNodes].some(belongsToMap)){mapMutations++;mapRemovedNodes+=r.removedNodes.length;}}};
    const mapObserver=new MutationObserver(record);mapObserver.observe(card.shadowRoot,{subtree:true,attributes:true,childList:true,characterData:true});
    const count=Number(detail);
    try {
     for(let i=0;i<count;i++){
      if(arg==='selection')dispatch(()=>card.shadowRoot.querySelector('button[data-room-id="1"]').click());
      else {
       const entity=arg==='robot'?'vacuum.one':'image.map',current=state.hass.states[entity];
       state.hass.states[entity]={...current,last_updated:`map-update-${i}`,attributes:{...current.attributes,...(arg==='robot'?{robot_position:[i,i]}:{entity_picture:`/bench/artwork/map.svg?frame=${i}`})}};
       dispatch(()=>{card.hass={...state.hass};});
       if(arg==='frame'){
        const deadline=performance.now()+config.settleTimeoutMs;
        while(true){const image=card.shadowRoot.querySelector('[data-map-image]');if(image?.getAttribute('src')?.includes(`frame=${i}&`) && image.complete && image.naturalWidth && !card._pendingMapImage)break;if(performance.now()>deadline)throw new Error(`Map frame ${i} failed to settle`);await sleep(5);}
       }
      }
      if(arg!=='robot')await new Promise(nativeRaf);
     }
     record(mapObserver.takeRecords());
     return {mapUpdates:count,mapMutations,mapRemovedNodes,mapLayerIdentity:layers.filter((node,i)=>node===card.shadowRoot.querySelector(selectors[i])).length/layers.length};
    }finally{mapObserver.disconnect();}
   }
   else if(kind==='lifecycle'){
    const count=Number(arg);for(let i=0;i<count;i++){const current=dispatch(()=>make(row,state.hass));dispatch(()=>{current.hass={...state.hass};current.remove();});if(i%20===0)await sleep(5);}state.cards=[];
    return {lifecycleCycles:count};
   }
   else throw new Error(`Unknown scenario ${scenario}`);
  });
  if(kind==='graph'){
   metrics.historySamplesObserved=card._historySeries?.reduce((sum,row)=>sum+(row.samples?.length||0),0)??null;
   if(metrics.historySamplesObserved!==null && metrics.historySamplesObserved<2)throw new Error('Graph benchmark did not ingest the fixture history');
   if(typeof card._normalizeHistorySeries!=='function')metrics.historyIngestionMs=null;
   if(typeof card._buildChartSeries!=='function')metrics.numericProcessingMs=null;
  }
  if(kind==='sections'){
   const bounds=card.shadowRoot.querySelector('ha-card').getBoundingClientRect(),cell=state.sectionsCell.getBoundingClientRect();metrics.sectionsOverflowPx=Math.max(0,bounds.bottom-cell.bottom);metrics.sectionsCardHeight=bounds.height;metrics.sectionsCellHeight=cell.height;
  }
  // Non-numeric descriptive fields stay outside metrics.
  const details={};for(const [key,value]of Object.entries(metrics))if(value!==null&&!Number.isFinite(value)){details[key]=value;delete metrics[key];}
  const result={metrics,details,skipped,errors:[...errors],nodes:nodeCount(),subscriptions,pending};return result;
 },
 async memoryReset(){
  for(const card of state?.cards||[])card.remove();if(state)state.cards=[];
  document.querySelector('#fixture').replaceChildren();
  await sleep(250);observer.disconnect();observer=observeMutations(document,mutate);
  return {nodes:nodeCount(),subscriptions,pending};
 },
 async cleanup(){await reset();},
};
