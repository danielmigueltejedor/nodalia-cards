import {expect,test} from '@playwright/test';

async function mountTv(page, source, {picture='', state='playing'}={}) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(()=>customElements.get('nodalia-media-player'));
  await page.evaluate(({source,picture,state})=>{
    const entity='media_player.tv';
    window.youtubeHass=window.makeHass({[entity]:{
      entity_id:entity,state,attributes:{
        friendly_name:'Apple TV Salón',device_class:'tv',app_name:source,source,
        media_title:'A YouTube programme',entity_picture:picture,supported_features:131074,
      },
    }});
    const card=document.createElement('nodalia-media-player');
    card.setConfig({players:[{entity,tv_mode:true,show:true}],layout:{mode:'compact'},animations:{enabled:false}});
    card.hass=window.youtubeHass;
    card.style.width='370px';
    card.style.setProperty('--primary-text-color','#ffffff');
    card.style.setProperty('--secondary-text-color','rgba(255,255,255,.4)');
    document.querySelector('#fixture').append(card);
    window.youtubeCard=card;
  },{source,picture,state});
  return page.locator('nodalia-media-player');
}

test('TV renders real YouTube artwork inside the icon while playing and removes it when idle',async({page})=>{
 await page.route('**/local/nodalia-youtube-cover.svg*', route=>route.fulfill({
  status:200,contentType:'image/svg+xml',
  body:'<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#06f"/></svg>',
 }));
 const card=await mountTv(page,'YouTube',{picture:'/local/nodalia-youtube-cover.svg'});
 const img=card.locator('.media-player-card--tv .media-player__artwork img');
 await expect(img).toBeVisible();
 await expect(img).toHaveAttribute('src',/nodalia-youtube-cover\.svg/);
 expect(await img.evaluate(node=>node.closest('.media-player__artwork')?.classList.contains('media-player__artwork'))).toBe(true);
 await page.evaluate(()=>{
  const entity=window.youtubeHass.states['media_player.tv'];
  entity.state='off';
  window.youtubeCard.hass={...window.youtubeHass};
 });
 await expect(card.locator('.media-player-card--tv .media-player__artwork img')).toHaveCount(0);
 await expect(card.locator('.media-player-card--tv .media-player__artwork')).toBeVisible();
 await expect(card.locator('.media-player-card--tv .media-player__artwork ha-icon')).toHaveAttribute('icon','mdi:apple');
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

test('YouTube source label stays legible against the dark theme',async({page})=>{
 const card=await mountTv(page,'YouTube');
 const subtitle=card.locator('.media-player-card--tv .media-player__subtitle--tv');
 await expect(subtitle).toHaveText('YouTube');
 const contrast=await subtitle.evaluate(node=>{
  const text=getComputedStyle(node).color;
  const themed=getComputedStyle(node.closest('nodalia-media-player')||node).getPropertyValue('--secondary-text-color');
  const nums=text.match(/[\d.]+/g)?.map(Number)??[];
  return {text,alpha:nums[3]??1,weight:Number(getComputedStyle(node).fontWeight),themed};
 });
 expect(contrast.alpha).toBeGreaterThanOrEqual(0.88);
 expect(contrast.weight).toBeGreaterThanOrEqual(600);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

test('YouTube image falls back to the TV glyph if Home Assistant provides no valid picture',async({page})=>{
 const card=await mountTv(page,'YouTube');
 await expect(card.locator('.media-player-card--tv .media-player__artwork img')).toHaveCount(0);
 await expect(card.locator('.media-player-card--tv .media-player__artwork')).toBeVisible();
 await expect(card.locator('.media-player-card--tv .media-player__artwork ha-icon')).toHaveAttribute('icon','mdi:apple');
 // The existing Plex picture pipeline remains compatible.
 await page.evaluate(()=>{
  const entity=window.youtubeHass.states['media_player.tv'];
  entity.attributes.source='Plex';
  entity.attributes.app_name='Plex';
  window.youtubeCard.hass={...window.youtubeHass};
 });
 await expect(card.locator('.media-player-card--tv .media-player__artwork')).toBeVisible();
 await expect(card.locator('.media-player-card--tv .media-player__artwork ha-icon')).toHaveAttribute('icon','mdi:apple');
});
