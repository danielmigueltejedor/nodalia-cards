/*!
 * Nodalia go2rtc player
 * Adapted from go2rtc VideoRTC v1.6.0. Copyright (c) 2022 Alexey Khit.
 * Upstream: https://github.com/AlexxIT/go2rtc/blob/master/www/video-rtc.js
 * License: MIT
 */

const GO2RTC_RECONNECT_DELAY = 5000;
const GO2RTC_MODE_TIMEOUT = 12000;

function toWebSocketUrl(rawValue) {
  try {
    const url = new URL(String(rawValue || ""), window.location.href);
    if (url.protocol === "http:") {
      url.protocol = "ws:";
    } else if (url.protocol === "https:") {
      url.protocol = "wss:";
    }
    return url.protocol === "ws:" || url.protocol === "wss:" ? url.toString() : "";
  } catch (_error) {
    return "";
  }
}

export class NodaliaGo2RTCPlayer extends HTMLElement {
  constructor() {
    super();
    this._source = "";
    this._mode = "auto";
    this._muted = true;
    this._controls = false;
    this._video = null;
    this._socket = null;
    this._peer = null;
    this._mediaSource = null;
    this._sourceBuffer = null;
    this._bufferQueue = [];
    this._messageHandlers = new Map();
    this._binaryHandler = null;
    this._reconnectTimer = 0;
    this._modeTimer = 0;
    this._modeQueue = [];
    this._activeMode = "";
    this._intentionalClose = false;
  }

  get video() {
    return this._video;
  }

  configure({ source, mode = "auto", muted = true, controls = false } = {}) {
    const nextSource = toWebSocketUrl(source);
    const changed = nextSource !== this._source || mode !== this._mode;
    this._source = nextSource;
    this._mode = String(mode || "auto").toLowerCase();
    this._muted = muted !== false;
    this._controls = controls === true;
    this._applyVideoOptions();
    if (changed && this.isConnected) {
      this.disconnect();
      this._connect();
    }
  }

  connectedCallback() {
    this._ensureVideo();
    this._connect();
  }

  disconnectedCallback() {
    this.disconnect();
  }

  disconnect() {
    window.clearTimeout(this._reconnectTimer);
    window.clearTimeout(this._modeTimer);
    this._reconnectTimer = 0;
    this._modeTimer = 0;
    this._intentionalClose = true;
    if (this._socket) {
      this._socket.close();
      this._socket = null;
    }
    if (this._peer) {
      this._peer.close();
      this._peer = null;
    }
    this._messageHandlers.clear();
    this._binaryHandler = null;
    this._sourceBuffer = null;
    this._bufferQueue = [];
    if (this._mediaSource?.readyState === "open") {
      try {
        this._mediaSource.endOfStream();
      } catch (_error) {
        // The browser may already be closing the media source.
      }
    }
    this._mediaSource = null;
    if (this._video) {
      const objectUrl = this._video.src;
      this._video.pause();
      this._video.removeAttribute("src");
      this._video.srcObject = null;
      this._video.load();
      if (objectUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }

  _ensureVideo() {
    if (this._video) {
      return;
    }
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "auto";
    video.style.display = "block";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "contain";
    video.addEventListener("loadeddata", () => this._markLoaded());
    video.addEventListener("error", () => this._fallback(new Error("go2rtc video decode failed")));
    this._video = video;
    this._applyVideoOptions();
    this.replaceChildren(video);
  }

  _applyVideoOptions() {
    if (!this._video) {
      return;
    }
    this._video.muted = this._muted;
    this._video.controls = this._controls;
  }

  _availableModes() {
    const requested = this._mode === "auto"
      ? ["webrtc", "mse", "hls", "mjpeg"]
      : [this._mode];
    return requested.filter(mode => {
      if (mode === "webrtc") {
        return "RTCPeerConnection" in window;
      }
      if (mode === "mse") {
        return "MediaSource" in window || "ManagedMediaSource" in window;
      }
      if (mode === "hls") {
        return Boolean(this._video?.canPlayType("application/vnd.apple.mpegurl"));
      }
      return mode === "mjpeg";
    });
  }

  _connect() {
    if (!this.isConnected || !this._source || this._socket || this._peer) {
      return;
    }
    this._ensureVideo();
    this._intentionalClose = false;
    this._modeQueue = this._availableModes();
    this._activeMode = "";
    if (!this._modeQueue.length) {
      this._reportError(new Error("No supported go2rtc playback mode"));
      return;
    }
    const socket = new WebSocket(this._source);
    socket.binaryType = "arraybuffer";
    socket.addEventListener("open", () => {
      if (socket !== this._socket) {
        return;
      }
      this._startNextMode();
    });
    socket.addEventListener("message", event => {
      if (socket !== this._socket) {
        return;
      }
      if (typeof event.data === "string") {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (_error) {
          return;
        }
        this._messageHandlers.forEach(handler => handler(message));
      } else {
        this._binaryHandler?.(event.data);
      }
    });
    socket.addEventListener("close", () => {
      if (socket === this._socket) {
        this._socket = null;
      }
      if (this._intentionalClose || !this.isConnected) {
        return;
      }
      if (this._peer?.connectionState === "connected") {
        return;
      }
      this._resetModeTransport();
      this._scheduleReconnect();
    });
    socket.addEventListener("error", () => this._reportError(new Error("go2rtc websocket failed")));
    this._socket = socket;
  }

  _scheduleReconnect() {
    if (this._reconnectTimer || !this.isConnected) {
      return;
    }
    this._reconnectTimer = window.setTimeout(() => {
      this._reconnectTimer = 0;
      this._connect();
    }, GO2RTC_RECONNECT_DELAY);
  }

  _send(message) {
    if (this._socket?.readyState === WebSocket.OPEN) {
      this._socket.send(JSON.stringify(message));
    }
  }

  _startNextMode() {
    const mode = this._modeQueue.shift();
    if (!mode) {
      this._reportError(new Error("go2rtc exhausted all playback modes"));
      return;
    }
    this._activeMode = mode;
    window.clearTimeout(this._modeTimer);
    this._modeTimer = window.setTimeout(() => {
      this._modeTimer = 0;
      this._fallback(new Error(`go2rtc ${mode} timed out`));
    }, GO2RTC_MODE_TIMEOUT);
    this._messageHandlers.clear();
    this._binaryHandler = null;
    if (mode === "webrtc") {
      this._startWebRtc();
    } else if (mode === "mse") {
      this._startMse();
    } else if (mode === "hls") {
      this._startHls();
    } else {
      this._startMjpeg();
    }
  }

  _fallback(error) {
    window.clearTimeout(this._modeTimer);
    this._modeTimer = 0;
    this._resetModeTransport();
    if (this._modeQueue.length && this._socket?.readyState === WebSocket.OPEN) {
      this._startNextMode();
      return;
    }
    this._reportError(error);
  }

  _reportError(error) {
    window.clearTimeout(this._modeTimer);
    this._modeTimer = 0;
    this.dispatchEvent(new CustomEvent("nodalia-go2rtc-error", {
      bubbles: true,
      composed: true,
      detail: { message: error?.message || String(error || "go2rtc error") },
    }));
  }

  _resetModeTransport() {
    if (this._peer) {
      this._peer.close();
      this._peer = null;
    }
    this._sourceBuffer = null;
    this._bufferQueue = [];
    if (this._mediaSource?.readyState === "open") {
      try {
        this._mediaSource.endOfStream();
      } catch (_error) {
        // The browser may already be closing the media source.
      }
    }
    this._mediaSource = null;
    if (this._video) {
      const objectUrl = this._video.src;
      this._video.pause();
      this._video.removeAttribute("src");
      this._video.srcObject = null;
      this._video.load();
      if (objectUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }

  async _play() {
    try {
      await this._video?.play();
    } catch (_error) {
      if (this._video && !this._video.muted) {
        this._video.muted = true;
        try {
          await this._video.play();
        } catch (_secondError) {
          // The native controls remain available for a user-initiated play.
        }
      }
    }
  }

  _markLoaded() {
    window.clearTimeout(this._modeTimer);
    this._modeTimer = 0;
    this.dispatchEvent(new CustomEvent("nodalia-go2rtc-loaded", { bubbles: true, composed: true }));
  }

  _startWebRtc() {
    const peer = new RTCPeerConnection({
      bundlePolicy: "max-bundle",
      iceServers: [
        { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
      ],
      sdpSemantics: "unified-plan",
    });
    const mediaStream = new MediaStream();
    peer.addEventListener("track", event => {
      if (!mediaStream.getTracks().some(track => track.id === event.track.id)) {
        mediaStream.addTrack(event.track);
      }
      if (this._video) {
        this._video.srcObject = mediaStream;
        this._play();
      }
    });
    peer.addEventListener("icecandidate", event => {
      const candidate = event.candidate?.toJSON?.().candidate || "";
      this._send({ type: "webrtc/candidate", value: candidate });
    });
    peer.addEventListener("connectionstatechange", () => {
      if (peer.connectionState === "connected") {
        this._markLoaded();
      } else if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
        this._fallback(new Error(`go2rtc WebRTC ${peer.connectionState}`));
      }
    });
    this._messageHandlers.set("webrtc", message => {
      if (message.type === "webrtc/candidate" && message.value) {
        peer.addIceCandidate({ candidate: message.value, sdpMid: "0" }).catch(() => {});
      } else if (message.type === "webrtc/answer") {
        peer.setRemoteDescription({ type: "answer", sdp: message.value }).catch(error => this._fallback(error));
      } else if (message.type === "error" && String(message.value || "").includes("webrtc/offer")) {
        this._fallback(new Error(String(message.value)));
      }
    });
    this._peer = peer;
    peer.addTransceiver("video", { direction: "recvonly" });
    peer.addTransceiver("audio", { direction: "recvonly" });
    peer.createOffer()
      .then(offer => peer.setLocalDescription(offer).then(() => offer))
      .then(offer => this._send({ type: "webrtc/offer", value: offer.sdp }))
      .catch(error => this._fallback(error));
  }

  _supportedCodecs(isSupported) {
    return [
      "avc1.640029",
      "avc1.64002A",
      "avc1.640033",
      "hvc1.1.6.L153.B0",
      "mp4a.40.2",
      "mp4a.40.5",
      "flac",
      "opus",
    ].filter(codec => isSupported(`video/mp4; codecs=\"${codec}\"`)).join();
  }

  _startMse() {
    const MediaSourceClass = window.ManagedMediaSource || window.MediaSource;
    const mediaSource = new MediaSourceClass();
    this._mediaSource = mediaSource;
    mediaSource.addEventListener("sourceopen", () => {
      this._send({ type: "mse", value: this._supportedCodecs(MediaSourceClass.isTypeSupported) });
    }, { once: true });
    if (window.ManagedMediaSource) {
      this._video.disableRemotePlayback = true;
      this._video.srcObject = mediaSource;
    } else {
      this._video.srcObject = null;
      this._video.src = URL.createObjectURL(mediaSource);
    }
    this._play();
    this._messageHandlers.set("mse", message => {
      if (message.type === "error" && String(message.value || "").startsWith("mse")) {
        this._fallback(new Error(String(message.value)));
        return;
      }
      if (message.type !== "mse") {
        return;
      }
      try {
        const sourceBuffer = mediaSource.addSourceBuffer(message.value);
        sourceBuffer.mode = "segments";
        sourceBuffer.addEventListener("updateend", () => this._flushMseQueue());
        this._sourceBuffer = sourceBuffer;
        this._binaryHandler = data => {
          this._bufferQueue.push(data);
          this._flushMseQueue();
        };
      } catch (error) {
        this._fallback(error);
      }
    });
  }

  _flushMseQueue() {
    const sourceBuffer = this._sourceBuffer;
    if (!sourceBuffer || sourceBuffer.updating) {
      return;
    }
    try {
      if (sourceBuffer.buffered.length) {
        const end = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
        const trimBefore = end - 10;
        if (this._video && this._video.currentTime < end - 5) {
          this._video.currentTime = end - 1;
        }
        if (trimBefore > sourceBuffer.buffered.start(0) && !this._bufferQueue.length) {
          sourceBuffer.remove(sourceBuffer.buffered.start(0), trimBefore);
          return;
        }
      }
      if (this._bufferQueue.length) {
        sourceBuffer.appendBuffer(this._bufferQueue.shift());
      }
    } catch (error) {
      this._fallback(error);
    }
  }

  _startHls() {
    this._messageHandlers.set("hls", message => {
      if (message.type === "error" && String(message.value || "").startsWith("hls")) {
        this._fallback(new Error(String(message.value)));
        return;
      }
      if (message.type !== "hls") {
        return;
      }
      const sourceUrl = new URL(this._source);
      sourceUrl.protocol = sourceUrl.protocol === "wss:" ? "https:" : "http:";
      sourceUrl.pathname = `${sourceUrl.pathname.replace(/\/ws$/, "")}/hls/`;
      sourceUrl.search = "";
      const playlist = String(message.value || "").replaceAll("hls/", sourceUrl.toString());
      this._video.srcObject = null;
      this._video.src = `data:application/vnd.apple.mpegurl;base64,${window.btoa(playlist)}`;
      this._play();
    });
    this._send({ type: "hls", value: this._supportedCodecs(type => this._video.canPlayType(type)) });
  }

  _startMjpeg() {
    let loaded = false;
    this._video.controls = false;
    this._binaryHandler = data => {
      const bytes = new Uint8Array(data);
      let binary = "";
      for (let index = 0; index < bytes.byteLength; index += 1) {
        binary += String.fromCharCode(bytes[index]);
      }
      this._video.poster = `data:image/jpeg;base64,${window.btoa(binary)}`;
      if (!loaded) {
        loaded = true;
        this._markLoaded();
      }
    };
    this._send({ type: "mjpeg" });
  }
}

const GO2RTC_PLAYER_TAG = "nodalia-go2rtc-player";

if (!customElements.get(GO2RTC_PLAYER_TAG)) {
  customElements.define(GO2RTC_PLAYER_TAG, NodaliaGo2RTCPlayer);
}
