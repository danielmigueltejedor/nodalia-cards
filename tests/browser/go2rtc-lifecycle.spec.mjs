import { expect, test } from '@playwright/test';

async function mount(page) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-go2rtc-player'));
  await page.evaluate(() => {
    const player = document.createElement('nodalia-go2rtc-player');
    player.configure({ muted: false });
    document.querySelector('#fixture').append(player);
    window.player = player;
    window.plays = [];
    player.video.play = () => new Promise((resolve, reject) => window.plays.push({ resolve, reject }));
  });
}

test('Go2rtc retired autoplay failure cannot mute or play the replacement native video', async ({ page }) => {
  await mount(page);
  const result = await page.evaluate(async () => {
    const player = window.player;
    const oldVideo = player.video;
    const pending = player._play();
    player.disconnect();
    player.connectedCallback();
    let replacementPlays = 0;
    player.video.play = () => { replacementPlays++; return Promise.resolve(); };
    player.configure({ muted: false });
    window.plays[0].reject(new Error('Retired autoplay failure'));
    const completed = await pending;
    return { completed, replacementPlays, muted: player.video.muted, replaced: player.video !== oldVideo, autoplayMuted: player._autoplayMuted };
  });
  expect(result).toEqual({ completed: false, replacementPlays: 0, muted: false, replaced: true, autoplayMuted: false });
});

test('Go2rtc mode retirement cancels pending autoplay on the same native video', async ({ page }) => {
  await mount(page);
  const result = await page.evaluate(async () => {
    const player = window.player;
    const video = player.video;
    const pending = player._play();
    player._resetModeTransport();
    window.plays[0].reject(new Error('Retired mode'));
    return { completed: await pending, calls: window.plays.length, muted: video.muted, same: player.video === video };
  });
  expect(result).toEqual({ completed: false, calls: 1, muted: false, same: true });
});

test('Go2rtc older play completion cannot reset the current autoplay result', async ({ page }) => {
  await mount(page);
  const result = await page.evaluate(async () => {
    const player = window.player;
    const first = player._play();
    const second = player._play();
    window.plays[1].reject(new Error('Needs muted autoplay'));
    await Promise.resolve();
    window.plays[2].resolve();
    const secondResult = await second;
    window.plays[0].resolve();
    return { first: await first, second: secondResult, autoplayMuted: player._autoplayMuted, muted: player.video.muted, calls: window.plays.length };
  });
  expect(result).toEqual({ first: false, second: true, autoplayMuted: true, muted: true, calls: 3 });
});

test('Go2rtc late video frame callback cannot mark a replacement mode loaded', async ({ page }) => {
  await mount(page);
  const result = await page.evaluate(() => {
    const player = window.player;
    const callbacks = [];
    player.video.requestVideoFrameCallback = callback => { callbacks.push(callback); return callbacks.length; };
    player.video.cancelVideoFrameCallback = () => {};
    player._verifyVideoDisplayRecovery(player.video);
    player._resetModeTransport();
    player._verifyVideoDisplayRecovery(player.video);
    const currentCallback = player._displayFrameCallback;
    callbacks[0](0, {});
    const retired = { loaded: player._hasDecodedFrameOnce, callback: player._displayFrameCallback };
    callbacks[1](0, {});
    const currentLoaded=player._hasDecodedFrameOnce;
    player.disconnect();
    return { currentCallback, retired, currentLoaded };
  });
  expect(result.currentCallback).toBe(2);
  expect(result.retired).toEqual({ loaded: false, callback: 2 });
  expect(result.currentLoaded).toBe(true);
});

test('Go2rtc retired native peer offer cannot set its local description or send on a replacement socket', async ({ page }) => {
  await mount(page);
  const result = await page.evaluate(async () => {
    const NativePeer = window.RTCPeerConnection;
    let resolveOffer;
    let localDescriptions = 0;
    window.RTCPeerConnection = class extends NativePeer {
      createOffer() { return new Promise(resolve => { resolveOffer = resolve; }); }
      setLocalDescription() { localDescriptions++; return Promise.resolve(); }
    };
    const player = window.player;
    const sent = [];
    player._send = message => sent.push(message);
    player._startWebRtc();
    const oldPeer = player._peer;
    player._resetModeTransport();
    resolveOffer({ type: 'offer', sdp: 'obsolete' });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    window.RTCPeerConnection = NativePeer;
    player.disconnect();
    return { localDescriptions, sent, state: oldPeer.connectionState };
  });
  expect(result).toEqual({ localDescriptions: 0, sent: [], state: 'closed' });
});

test('Go2rtc retired native ICE events cannot send candidates on a replacement transport', async ({ page }) => {
  await mount(page);
  const result = await page.evaluate(() => {
    const player = window.player;
    const sent = [];
    player._send = message => sent.push(message);
    player._startWebRtc();
    const peer = player._peer;
    player._resetModeTransport();
    peer.dispatchEvent(new RTCPeerConnectionIceEvent('icecandidate', { candidate: new RTCIceCandidate({ candidate: 'candidate:1 1 UDP 1 127.0.0.1 9999 typ host', sdpMid: '0' }) }));
    player.disconnect();
    return sent;
  });
  expect(result).toEqual([]);
});

test('Go2rtc bounds sockets, poster URLs and media nodes across 60 source changes and reconnects',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-go2rtc-player'));
 const result=await page.evaluate(()=>{
  const sockets=new Set(),urls=new Set(),frames=new Map();let frame=0;
  window.WebSocket=class extends EventTarget {
   static OPEN=1;static CONNECTING=0;static CLOSED=3;
   constructor(){super();this.readyState=0;sockets.add(this);}
   send(){}close(){this.readyState=3;sockets.delete(this);}
  };
  const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=blob=>{const url=create(blob);urls.add(url);return url;};URL.revokeObjectURL=url=>{urls.delete(url);revoke(url);};
  HTMLMediaElement.prototype.play=()=>Promise.resolve();
  HTMLVideoElement.prototype.requestVideoFrameCallback=callback=>{frames.set(++frame,callback);return frame;};HTMLVideoElement.prototype.cancelVideoFrameCallback=id=>frames.delete(id);
  const results=[];let socketPeak=0,urlPeak=0,framePeak=0;
  for(let n=0;n<60;n++){
   const player=document.createElement('nodalia-go2rtc-player');player.configure({source:`ws://127.0.0.1/stream/${n}`,mode:'mjpeg'});document.querySelector('#fixture').append(player);
   const retired=player._socket;retired.readyState=1;retired.dispatchEvent(new Event('open'));
   player._binaryHandler?.(new Uint8Array([1,2,3]).buffer);player._verifyVideoDisplayRecovery(player.video);
   socketPeak=Math.max(socketPeak,sockets.size);urlPeak=Math.max(urlPeak,urls.size);framePeak=Math.max(framePeak,frames.size);
   player.configure({source:`ws://127.0.0.1/replacement/${n}`,mode:'mjpeg'});
   retired.dispatchEvent(new MessageEvent('message',{data:JSON.stringify({type:'error',value:'Retired socket'})}));
   player.remove();document.querySelector('#fixture').append(player);player.remove();
   results.push({sockets:sockets.size,urls:urls.size,frames:frames.size,media:document.querySelectorAll('video,audio,nodalia-go2rtc-player').length,queue:player._bufferQueue.length,handlers:player._messageHandlers.size,peer:player._peer});
  }
  return {results,socketPeak,urlPeak,framePeak,errors:window.bundleErrors};
 });
 expect(result.socketPeak).toBeGreaterThan(0);expect(result.urlPeak).toBeGreaterThan(0);expect(result.framePeak).toBeGreaterThan(0);
 expect(result.results).toEqual(Array.from({length:60},()=>({sockets:0,urls:0,frames:0,media:0,queue:0,handlers:0,peer:null})));expect(result.errors).toEqual([]);
});
