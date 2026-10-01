import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { buildSync } from "esbuild";
function load(card) {
 const box={};box.window=box;vm.createContext(box);vm.runInContext(fs.readFileSync('nodalia-utils.js','utf8'),box);
 vm.runInContext(buildSync({entryPoints:[`src/cards/${card}/${card}-config.ts`],bundle:true,write:false,format:'iife',globalName:'api'}).outputFiles[0].text,box);return box.api;
}
const media=load('media-player'), nav=load('navigation');
const plain=v=>JSON.parse(JSON.stringify(v));

test('Media retains single-player, string layout and nested navigation aliases without mutating YAML',()=>{
 const source={entity:'media_player.one',name:'One',layout:'square',power_action_off:{action:'none'}, extension:{marker:1}};
 const config=media.normalizeConfig(source);assert.equal(config.layout.mode,'square');assert.equal(config.players[0].entity,'media_player.one');assert.equal(config.players[0].name,'One');assert.equal(config.players[0].power_action_off.action,'none');assert.deepEqual(plain(config.extension),{marker:1});assert.equal(source.layout,'square');
 const nested=media.normalizeConfig({media_player:{players:[{entity:'',label:'Draft'}],show:false,show_state:true,show_desktop:false,album_cover_background:false}});
 assert.equal(nested.players[0].entity,'');assert.equal(nested.show,false);assert.equal(nested.show_state,true);assert.equal(nested.layout.show_desktop,false);assert.equal(nested.album_cover_background,false);
});

test('Media artwork numbers use defaults for absent values, preserve zero and clamp finite inputs',()=>{
 for(const value of [null,'',false,{},Infinity]) {const config=media.normalizeConfig({artwork:{dim:value,opacity:value,blur:value},idle_artwork:{interval:value,max_items:value}});assert.equal(config.artwork.dim,.22);assert.equal(config.artwork.opacity,1);assert.equal(config.artwork.blur,0);assert.equal(config.idle_artwork.interval,15);assert.equal(config.idle_artwork.max_items,8);}
 const zero=media.normalizeConfig({artwork:{dim:0,blur:0,crossfade_duration:0}});assert.equal(zero.artwork.dim,0);assert.equal(zero.artwork.crossfade_duration,0);
 const bounded=media.normalizeConfig({artwork:{blur:100,dim:-2,saturation:'1.2'},idle_artwork:{max_items:5.8}});assert.equal(bounded.artwork.blur,48);assert.equal(bounded.artwork.dim,0);assert.equal(bounded.artwork.saturation,1.2);assert.equal(bounded.idle_artwork.max_items,6);
});

test('Media rejects malformed nested blocks and sanitizes known styles while retaining extensions and default action policies',()=>{
 const config=media.normalizeConfig({layout:null,styles:{player:{background:'red;}</style>',padding:'20px',extra:42},extra:'kept',browser:false},players:[null,[],{entity:'',power_action_on:null}],security:null});
 assert.equal(config.layout.mode,'auto');assert.equal(config.styles.player.background,media.DEFAULT_CONFIG.styles.player.background);assert.equal(config.styles.player.padding,'20px');assert.equal(config.styles.player.extra,42);assert.equal(config.styles.extra,'kept');assert.equal(config.styles.browser.border_radius,media.DEFAULT_CONFIG.styles.browser.border_radius);
 assert.equal(config.players.length,1);assert.equal(config.players[0].power_action_on.action,'default');assert.equal(config.security.strict_service_actions,false);
});

test('Navigation keeps routes/items alias precedence, clones route rows and retains media/security policies',()=>{
 const source={items:[{path:'/lovelace/home',label:'Home',popup:[{path:'/profile'}]}],media_player:{players:[{entity:'media_player.one'}],artwork:{mode:'blur'}},extension:{marker:1}};
 const config=nav.normalizeConfig(source);assert.equal(config.routes[0].path,'/lovelace/home');assert.equal(config.items,undefined);assert.equal(config.media_player.artwork.mode,'blur');assert.equal(config.security.strict_service_actions,true);assert.deepEqual(plain(config.extension),{marker:1});
 config.routes[0].popup[0].path='/changed';assert.equal(source.items[0].popup[0].path,'/profile');assert.equal(source.items.length,1);
 const both=nav.normalizeConfig({routes:[],items:[{path:'/ignored'}]});assert.equal(both.routes.length,0);assert.equal(both.items.length,1);
 for(const source of [null,undefined,{},[],{routes:false}]) assert.throws(()=>nav.normalizeConfig(source),/routes.*required/);
});

test('Navigation normalizes malformed media/route/style blocks without hiding valid editor placeholders',()=>{
 const config=nav.normalizeConfig({routes:[null,[],{path:'/home',popup:'bad'},{}],layout:false,media_player:{players:'bad',artwork:false},styles:{bar:{background:'red;}</style>',gap:'12px',extra:42},extra:'kept'}});
 assert.equal(config.routes.length,2);assert.deepEqual(plain(config.routes[0].popup),[]);assert.deepEqual(plain(config.media_player.players),[]);assert.equal(config.media_player.artwork.mode,'immersive');assert.equal(config.layout.position,'bottom');assert.equal(config.styles.bar.background,nav.DEFAULT_CONFIG.styles.bar.background);assert.equal(config.styles.bar.gap,'12px');assert.equal(config.styles.bar.extra,42);assert.equal(config.styles.extra,'kept');
 const empty=nav.normalizeConfig({routes:[],media_player:false,styles:false});assert.equal(empty.media_player.show_desktop,false);assert.equal(empty.styles.button.size,'54px');
});
