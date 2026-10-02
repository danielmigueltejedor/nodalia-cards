/*!
 * Nodalia go2rtc player
 * Adapted from go2rtc VideoRTC v1.6.0. Copyright (c) 2022 Alexey Khit.
 * Upstream: https://github.com/AlexxIT/go2rtc/blob/master/www/video-rtc.js
 * License: MIT
 */

const GO2RTC_RECONNECT_DELAY = 2000;
const GO2RTC_STARTUP_ERROR_DELAY = 30000;
const GO2RTC_WEBRTC_PROGRESS_TIMEOUT = 10000;
const GO2RTC_SOCKET_OPEN_TIMEOUT = 6500;
const GO2RTC_MAX_MSE_QUEUE_BYTES = 8 * 1024 * 1024;
const GO2RTC_MODE_TIMEOUTS:Record<string,number> = {
  webrtc: 4500,
  mse: 6500,
  hls: 6500,
  mjpeg: 4500,
};

function toWebSocketUrl(rawValue:unknown) {
  try {
    const source=String(rawValue || "").trim();
    if(!source) return "";
    const url = new URL(source, window.location.href);
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

type Go2rtcMessage={type:string;value?:unknown};
type AudioTrackState={kind:string;muted?:boolean;readyState?:string};
const isGo2rtcRecord=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==="object"&&!Array.isArray(value);
const go2rtcRecord=(value:unknown)=>isGo2rtcRecord(value)?value:{};
const go2rtcErrorMessage=(error:unknown)=>String(go2rtcRecord(error).message??error??"");
export class NodaliaGo2RTCPlayer extends HTMLElement {
  declare private _video:HTMLVideoElement|null;
  declare private _socket:WebSocket|null;
  declare private _peer:RTCPeerConnection|null;
  declare private _mediaSource:MediaSource|null;
  declare private _sourceBuffer:SourceBuffer|null;
  declare private _bufferQueue:ArrayBuffer[];
  declare private _messageHandlers:Map<string,(message:Go2rtcMessage)=>void>;
  declare private _binaryHandler:((data:ArrayBuffer)=>void)|null;
  declare private _modeQueue:string[];
  declare private _playbackStream:MediaStream|null;
  declare private _audioContext:AudioContext|null;
  declare private _audioElementSource:MediaElementAudioSourceNode|null;
  declare private _audioOutputGain:GainNode|null;
  declare private _audioTrackSource:MediaStreamAudioSourceNode|null;
  declare private _audioTrackStream:MediaStream|null;
  declare private _audioPrimeOscillator:OscillatorNode|null;
  declare private _audioPrimeGain:GainNode|null;
  declare private _programmaticMuted:boolean|null;
  declare private _audioTrackListeners:(()=>void)[];
  declare private _onDisplayEnvironmentChange:EventListener;
  declare private _source:string;
  declare private _mode:string;
  declare private _muted:boolean;
  declare private _controls:boolean;
  declare private _bufferQueueBytes:number;
  declare private _reconnectTimer:number;
  declare private _modeTimer:number;
  declare private _socketOpenTimer:number;
  declare private _activeMode:string;
  declare private _intentionalClose:boolean;
  declare private _autoplayMuted:boolean;
  declare private _startupStartedAt:number;
  declare private _hasDecodedFrameOnce:boolean;
  declare private _lastAudioState:string;
  declare private _mseCodecs:string;
  declare private _posterObjectUrl:string;
  declare private _displayRecoveryTimer:number;
  declare private _displayHealthTimer:number;
  declare private _displayRecoveryFrame:number;
  declare private _displayFrameCallback:number;
  declare private _pendingDisplayRecoveryReason:string;

  declare private _transportGeneration:number;
  declare private _playRevision:number;
  declare private _displayRevision:number;
  declare private _audioTrackRevision:number;

  constructor() {
    super();
    this._transportGeneration=0;
    this._playRevision=0;
    this._displayRevision=0;
    this._audioTrackRevision=0;
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
    this._bufferQueueBytes = 0;
    this._messageHandlers = new Map();
    this._binaryHandler = null;
    this._reconnectTimer = 0;
    this._modeTimer = 0;
    this._socketOpenTimer = 0;
    this._modeQueue = [];
    this._activeMode = "";
    this._intentionalClose = false;
    this._autoplayMuted = false;
    this._startupStartedAt = 0;
    this._hasDecodedFrameOnce = false;
    this._playbackStream = null;
    this._audioContext = null;
    this._audioElementSource = null;
    this._audioOutputGain = null;
    this._audioTrackSource = null;
    this._audioTrackStream = null;
    this._audioPrimeOscillator = null;
    this._audioPrimeGain = null;
    this._programmaticMuted = null;
    this._audioTrackListeners = [];
    this._lastAudioState = "";
    this._mseCodecs = "";
    this._posterObjectUrl = "";
    this._displayRecoveryTimer = 0;
    this._displayHealthTimer = 0;
    this._displayRecoveryFrame = 0;
    this._displayFrameCallback = 0;
    this._pendingDisplayRecoveryReason = "";
    this._onDisplayEnvironmentChange = (event:Event) => {
      this._scheduleVideoDisplayRecovery(event?.type || "display-change");
    };
  }

  get video() {
    return this._video;
  }

  configure({ source, mode = "auto", muted = true, controls = false }:{source?:unknown;mode?:unknown;muted?:unknown;controls?:unknown} = {}) {
    const nextSource = toWebSocketUrl(source);
    const nextMode=String(mode || "auto").toLowerCase();
    const changed = nextSource !== this._source || nextMode !== this._mode;
    if(this._muted !== (muted !== false)) this._playRevision++;
    const hasTransport = Boolean(this._socket || this._peer || this._mediaSource);
    this._source = nextSource;
    this._mode = nextMode;
    this._muted = muted !== false;
    this._controls = controls === true;
    this._autoplayMuted = false;
    this._applyVideoOptions();
    if (changed && this.isConnected) {
      if (hasTransport || this._video) {
        this.disconnect();
      }
      this._connect();
    }
  }

  connectedCallback() {
    this._ensureVideo();
    window.addEventListener?.("orientationchange", this._onDisplayEnvironmentChange);
    window.visualViewport?.addEventListener?.("resize", this._onDisplayEnvironmentChange);
    if (typeof document !== "undefined") {
      document.addEventListener?.("fullscreenchange", this._onDisplayEnvironmentChange);
      document.addEventListener?.("webkitfullscreenchange", this._onDisplayEnvironmentChange);
    }
    this._connect();
  }

  disconnectedCallback() {
    window.removeEventListener?.("orientationchange", this._onDisplayEnvironmentChange);
    window.visualViewport?.removeEventListener?.("resize", this._onDisplayEnvironmentChange);
    if (typeof document !== "undefined") {
      document.removeEventListener?.("fullscreenchange", this._onDisplayEnvironmentChange);
      document.removeEventListener?.("webkitfullscreenchange", this._onDisplayEnvironmentChange);
    }
    this.disconnect();
  }

  disconnect() {
    this._transportGeneration++;
    this._playRevision++;
    this._displayRevision++;
    window.clearTimeout(this._reconnectTimer);
    window.clearTimeout(this._modeTimer);
    window.clearTimeout(this._socketOpenTimer);
    window.clearTimeout(this._displayRecoveryTimer);
    window.clearTimeout(this._displayHealthTimer);
    this._reconnectTimer = 0;
    this._modeTimer = 0;
    this._socketOpenTimer = 0;
    this._displayRecoveryTimer = 0;
    this._displayHealthTimer = 0;
    if (this._displayRecoveryFrame && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(this._displayRecoveryFrame);
    }
    this._displayRecoveryFrame = 0;
    if (this._displayFrameCallback && typeof this._video?.cancelVideoFrameCallback === "function") {
      this._video.cancelVideoFrameCallback(this._displayFrameCallback);
    }
    this._displayFrameCallback = 0;
    this._pendingDisplayRecoveryReason = "";
    this._intentionalClose = true;
    this._autoplayMuted = false;
    if (this._socket) {
      this._socket.close();
      this._socket = null;
    }
    if (this._peer) {
      this._peer.close();
      this._peer = null;
    }
    this._clearAudioTrackListeners();
    this._messageHandlers.clear();
    this._binaryHandler = null;
    this._sourceBuffer = null;
    this._bufferQueue = [];
    this._bufferQueueBytes = 0;
    if (this._mediaSource?.readyState === "open") {
      try {
        this._mediaSource.endOfStream();
      } catch (_error) {
        // The browser may already be closing the media source.
      }
    }
    this._mediaSource = null;
    const video = this._video;
    if (video) {
      const objectUrl = video.src;
      video.pause();
      video.removeAttribute("src");
      video.srcObject = null;
      video.load();
      if (objectUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    }
    this._releaseAudioOutput();
    this._revokePosterObjectUrl();
    video?.remove?.();
    if (this._video === video) {
      this._video = null;
    }
    this._playbackStream = null;
    this._startupStartedAt = 0;
    this._hasDecodedFrameOnce = false;
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
    video.addEventListener("loadeddata", () => {
      if(video !== this._video || !this.isConnected) return;
      const mediaStream = video.srcObject;
      if (
        this._activeMode === "webrtc"
        && mediaStream instanceof MediaStream
        && !mediaStream.getVideoTracks().length
      ) {
        return;
      }
      this._markLoaded();
    });
    video.addEventListener("error", () => {
      if (video === this._video && this.isConnected && !this._intentionalClose && (video.currentSrc || video.srcObject)) {
        this._fallback(new Error("go2rtc video decode failed"));
      }
    });
    video.addEventListener("volumechange", () => {if(video===this._video && this.isConnected) this._handleVideoVolumeChange();});
    video.addEventListener("webkitbeginfullscreen", this._onDisplayEnvironmentChange);
    video.addEventListener("webkitendfullscreen", this._onDisplayEnvironmentChange);
    this._video = video;
    this._applyVideoOptions();
    this.replaceChildren(video);
  }

  _applyVideoOptions() {
    if (!this._video) {
      return;
    }
    this._setVideoMuted(this._muted);
    this._video.controls = this._controls;
    this._syncAudioOutput();
  }

  _scheduleVideoDisplayRecovery(reason = "display-change") {
    if (!this.isConnected || !this._video) {
      return;
    }
    const pendingIsStructural = /orientationchange|fullscreen/i.test(this._pendingDisplayRecoveryReason);
    const nextIsStructural = /orientationchange|fullscreen/i.test(reason);
    if (!pendingIsStructural || nextIsStructural) {
      this._pendingDisplayRecoveryReason = reason;
    }
    window.clearTimeout(this._displayRecoveryTimer);
    this._displayRecoveryTimer = window.setTimeout(() => {
      this._displayRecoveryTimer = 0;
      const pendingReason = this._pendingDisplayRecoveryReason;
      this._pendingDisplayRecoveryReason = "";
      this._recoverVideoDisplay(pendingReason);
    }, 180);
  }

  _recoverVideoDisplay(reason = "display-change") {
    const video = this._video;
    if (!video || !this.isConnected) {
      return false;
    }
    const generation=this._transportGeneration;
    const revision=++this._displayRevision;
    const previousTransform = video.style?.transform || "";
    const previousWillChange = video.style?.willChange || "";
    if (video.style) {
      video.style.willChange = "transform";
      video.style.transform = previousTransform
        ? `${previousTransform} translateZ(0)`
        : "translateZ(0)";
    }
    video.getBoundingClientRect?.();

    const finishRecovery = () => {
      if (video !== this._video || !this.isConnected || generation!==this._transportGeneration || revision!==this._displayRevision) {
        return;
      }
      this._displayRecoveryFrame = 0;
      const shouldReattachWebRtc = this._activeMode === "webrtc"
        && /orientationchange|fullscreen/i.test(reason)
        && this._playbackStream
        && typeof this._playbackStream.getVideoTracks === "function"
        && this._playbackStream.getVideoTracks().some(track => track?.readyState !== "ended");
      if (shouldReattachWebRtc) {
        video.srcObject = null;
        video.srcObject = this._playbackStream;
      }
      if (video.style) {
        video.style.transform = previousTransform;
        video.style.willChange = previousWillChange;
      }
      try {
        Promise.resolve(video.play?.()).catch(() => {});
      } catch (_error) {
        // Native fullscreen may transiently reject play while WebKit changes surfaces.
      }
      this._verifyVideoDisplayRecovery(video);
    };

    if (typeof window.requestAnimationFrame === "function") {
      this._displayRecoveryFrame = window.requestAnimationFrame(finishRecovery);
    } else {
      finishRecovery();
    }
    return true;
  }

  _verifyVideoDisplayRecovery(video:HTMLVideoElement) {
    const generation=this._transportGeneration;
    const revision=++this._displayRevision;
    window.clearTimeout(this._displayHealthTimer);
    if (this._displayFrameCallback && typeof video.cancelVideoFrameCallback === "function") {
      video.cancelVideoFrameCallback(this._displayFrameCallback);
    }
    this._displayFrameCallback = 0;
    let receivedFrame = false;
    if (typeof video.requestVideoFrameCallback === "function") {
      this._displayFrameCallback = video.requestVideoFrameCallback(() => {
        if(video!==this._video || !this.isConnected || generation!==this._transportGeneration || revision!==this._displayRevision) return;
        this._displayFrameCallback = 0;
        receivedFrame = true;
        this._hasDecodedFrameOnce = true;
      });
    }
    this._displayHealthTimer = window.setTimeout(() => {
      if (video !== this._video || !this.isConnected || generation!==this._transportGeneration || revision!==this._displayRevision) {
        return;
      }
      this._displayHealthTimer = 0;
      const hasDecodedFrame = receivedFrame
        || (Number(video.readyState) >= 2 && Number(video.videoWidth) > 0 && Number(video.videoHeight) > 0);
      if (hasDecodedFrame) {
        this._hasDecodedFrameOnce = true;
      }
      if (this._hasDecodedFrameOnce && !hasDecodedFrame && (this._socket || this._peer || this._mediaSource)) {
        this._restartTransportForDisplayRecovery();
      }
    }, 1200);
  }

  _restartTransportForDisplayRecovery() {
    window.clearTimeout(this._reconnectTimer);
    window.clearTimeout(this._modeTimer);
    window.clearTimeout(this._socketOpenTimer);
    this._reconnectTimer = 0;
    this._modeTimer = 0;
    this._socketOpenTimer = 0;
    const socket = this._socket;
    this._socket = null;
    socket?.close?.();
    this._resetModeTransport();
    this._modeQueue = [];
    this._activeMode = "";
    this._intentionalClose = false;
    this._connect();
  }

  _handleVideoVolumeChange() {
    if (!this._video) {
      return;
    }
    const programmatic = this._programmaticMuted === this._video.muted;
    this._programmaticMuted = null;
    if (!programmatic) {
      this._muted = this._video.muted;
      this._autoplayMuted = false;
      if (!this._muted) {
        this._ensureAudioOutput();
        this._resumeAudioOutput();
        this._video.play().catch(() => {});
      }
    }
    this._syncAudioOutput();
  }

  _setVideoMuted(muted:boolean) {
    if (!this._video || this._video.muted === muted) {
      return;
    }
    this._programmaticMuted = muted;
    this._video.muted = muted;
  }

  primeAudioFromUserGesture() {
    if (this._muted) {
      return false;
    }
    this._ensureVideo();
    this._setVideoMuted(false);
    this._ensureAudioOutput();
    this._resumeAudioOutput();
    this._syncAudioOutput();
    const video=this._video;
    if(!video) return false;
    video.play().catch(() => {});
    return true;
  }

  _ensureAudioOutput() {
    if (this._audioContext && this._audioElementSource && this._audioOutputGain) {
      return true;
    }
    const video=this._video;
    if(!video) return false;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || typeof AudioContextClass !== "function") {
      return false;
    }
    try {
      const context = new AudioContextClass();
      this._audioContext=context;
      const source = context.createMediaElementSource(video);
      this._audioElementSource=source;
      const outputGain = context.createGain();
      this._audioOutputGain=outputGain;
      source.connect(outputGain);
      outputGain.connect(context.destination);
      const oscillator = context.createOscillator();
      this._audioPrimeOscillator=oscillator;
      const primeGain = context.createGain();
      this._audioPrimeGain=primeGain;
      primeGain.gain.value = 0;
      oscillator.connect(primeGain);
      primeGain.connect(context.destination);
      oscillator.start();
      this._audioContext = context;
      this._audioElementSource = source;
      this._audioOutputGain = outputGain;
      this._audioPrimeOscillator = oscillator;
      this._audioPrimeGain = primeGain;
      this._syncAudioOutput();
      return true;
    } catch (_error) {
      this._releaseAudioOutput();
      return false;
    }
  }

  _resumeAudioOutput() {
    if (!this._audioContext || this._audioContext.state === "running") {
      return;
    }
    this._audioContext.resume?.().catch?.(() => {});
  }

  _syncAudioOutput() {
    if (!this._audioOutputGain) {
      return;
    }
    const volume = this._video?.volume;
    const outputVolume = this._audioTrackSource && volume!==undefined && Number.isFinite(volume)
      ? volume
      : 1;
    this._audioOutputGain.gain.value = this._muted ? 0 : outputVolume;
  }

  _disconnectAudioTrackOutput() {
    this._audioTrackSource?.disconnect?.();
    this._audioTrackSource = null;
    this._audioTrackStream = null;
  }

  _connectElementAudioOutput() {
    this._disconnectAudioTrackOutput();
    if (!this._audioElementSource || !this._audioOutputGain) {
      return false;
    }
    try {
      this._audioElementSource.disconnect();
      this._audioElementSource.connect(this._audioOutputGain);
      this._syncAudioOutput();
      return true;
    } catch (_error) {
      return false;
    }
  }

  _routeWebRtcAudioTrack(track:MediaStreamTrack|undefined) {
    if (!track || !this._audioContext || !this._audioOutputGain) {
      return false;
    }
    try {
      this._disconnectAudioTrackOutput();
      this._audioElementSource?.disconnect?.();
      const stream = new MediaStream([track]);
      const source = this._audioContext.createMediaStreamSource(stream);
      source.connect(this._audioOutputGain);
      this._audioTrackStream = stream;
      this._audioTrackSource = source;
      this._resumeAudioOutput();
      this._syncAudioOutput();
      return true;
    } catch (_error) {
      this._connectElementAudioOutput();
      return false;
    }
  }

  _stopAudioPrime() {
    if (this._audioPrimeOscillator) {
      try {
        this._audioPrimeOscillator.stop();
      } catch (_error) {
        // The oscillator may already have stopped with the media element.
      }
      this._audioPrimeOscillator = null;
    }
    this._audioPrimeGain?.disconnect?.();
    this._audioPrimeGain = null;
  }

  _releaseAudioOutput() {
    this._stopAudioPrime();
    this._disconnectAudioTrackOutput();
    this._audioElementSource?.disconnect?.();
    this._audioElementSource = null;
    this._audioOutputGain?.disconnect?.();
    this._audioOutputGain = null;
    this._audioContext?.close?.().catch?.(() => {});
    this._audioContext = null;
  }

  _clearAudioTrackListeners() {
    this._audioTrackRevision++;
    this._audioTrackListeners.forEach(removeListener => removeListener());
    this._audioTrackListeners = [];
    this._lastAudioState = "";
  }

  _emitAudioState(tracks:AudioTrackState[] = [], mode = this._activeMode) {
    const audioTracks = tracks.filter(track => track?.kind === "audio" && track.readyState !== "ended");
    const state = !audioTracks.length
      ? "missing"
      : audioTracks.some(track => !track.muted)
        ? "available"
        : "waiting";
    const signature = `${mode}:${state}:${audioTracks.length}`;
    if (signature === this._lastAudioState) {
      return state;
    }
    this._lastAudioState = signature;
    this.dispatchEvent(new CustomEvent("nodalia-go2rtc-audio-state", {
      bubbles: true,
      composed: true,
      detail: { mode, state, tracks: audioTracks.length, codecs: this._mseCodecs },
    }));
    if (!this._muted && state === "missing") {
      console.warn(`[nodalia-go2rtc-player] ${mode} stream has no compatible audio track`);
    }
    return state;
  }

  _watchAudioTracks(tracks:MediaStreamTrack[]) {
    this._clearAudioTrackListeners();
    const revision=this._audioTrackRevision;
    const generation=this._transportGeneration;
    tracks.filter(track => track?.kind === "audio").forEach(track => {
      const update = () => {if(this.isConnected && revision===this._audioTrackRevision && generation===this._transportGeneration) this._emitAudioState(tracks, "webrtc");};
      track.addEventListener?.("mute", update);
      track.addEventListener?.("unmute", update);
      track.addEventListener?.("ended", update);
      this._audioTrackListeners.push(() => {
        track.removeEventListener?.("mute", update);
        track.removeEventListener?.("unmute", update);
        track.removeEventListener?.("ended", update);
      });
    });
    this._emitAudioState(tracks, "webrtc");
  }

  _revokePosterObjectUrl() {
    if (!this._posterObjectUrl) {
      return;
    }
    if (this._video?.getAttribute?.("poster") === this._posterObjectUrl) {
      this._video.removeAttribute("poster");
    }
    URL.revokeObjectURL(this._posterObjectUrl);
    this._posterObjectUrl = "";
  }

  _availableModes() {
    const requested = this._mode === "auto-mse"
      ? ["mse", "webrtc", "hls", "mjpeg"]
      : this._mode === "auto"
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
    if (!this._startupStartedAt) {
      this._startupStartedAt = Date.now();
    }
    this._emitState("connecting");
    this._modeQueue = this._availableModes();
    this._activeMode = "";
    if (!this._modeQueue.length) {
      this._reportError(new Error("No supported go2rtc playback mode"));
      return;
    }
    let socket:WebSocket;
    try {
      socket = new WebSocket(this._source);
    } catch (error) {
      this._retryOrReport(error);
      return;
    }
    socket.binaryType = "arraybuffer";
    socket.addEventListener("open", () => {
      if (socket !== this._socket) {
        return;
      }
      window.clearTimeout(this._socketOpenTimer);
      this._socketOpenTimer = 0;
      this._startNextMode();
    });
    socket.addEventListener("message", event => {
      if (socket !== this._socket) {
        return;
      }
      if (typeof event.data === "string") {
        let message:unknown;
        try {
          message = JSON.parse(event.data);
        } catch (_error) {
          return;
        }
        const record=go2rtcRecord(message);
        if(typeof record.type!=="string") return;
        const decoded:Go2rtcMessage={type:record.type,...(record.value===undefined?{}:{value:record.value})};
        this._messageHandlers.forEach(handler => handler(decoded));
      } else {
        if(event.data instanceof ArrayBuffer) this._binaryHandler?.(event.data);
      }
    });
    socket.addEventListener("close", () => {
      if (socket !== this._socket) {
        return;
      }
      window.clearTimeout(this._socketOpenTimer);
      this._socketOpenTimer = 0;
      this._socket = null;
      if (this._intentionalClose || !this.isConnected) {
        return;
      }
      if (this._peer?.connectionState === "connected") {
        return;
      }
      this._retryOrReport(new Error("go2rtc websocket closed"));
    });
    socket.addEventListener("error", () => {
      if (socket === this._socket) {
        this._emitState("retrying", "go2rtc websocket failed");
      }
    });
    this._socket = socket;
    this._socketOpenTimer = window.setTimeout(() => {
      this._socketOpenTimer = 0;
      if (socket !== this._socket || socket.readyState === WebSocket.OPEN) {
        return;
      }
      this._socket = null;
      socket.close();
      this._retryOrReport(new Error("go2rtc websocket open timed out"));
    }, GO2RTC_SOCKET_OPEN_TIMEOUT);
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

  _send(message:Go2rtcMessage) {
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
    this._armModeTimeout(mode);
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

  _armModeTimeout(mode = this._activeMode, delay = GO2RTC_MODE_TIMEOUTS[mode] || 6500) {
    window.clearTimeout(this._modeTimer);
    this._modeTimer = window.setTimeout(() => {
      this._modeTimer = 0;
      this._fallback(new Error(`go2rtc ${mode} timed out`));
    }, delay);
  }

  _fallback(error:unknown) {
    window.clearTimeout(this._modeTimer);
    window.clearTimeout(this._socketOpenTimer);
    this._modeTimer = 0;
    this._socketOpenTimer = 0;
    this._resetModeTransport();
    if (this._modeQueue.length && this._socket?.readyState === WebSocket.OPEN) {
      this._startNextMode();
      return;
    }
    const socket = this._socket;
    this._socket = null;
    socket?.close();
    this._retryOrReport(error);
  }

  _retryOrReport(error:unknown) {
    this._resetModeTransport();
    const elapsed = Date.now() - (this._startupStartedAt || Date.now());
    if (elapsed >= GO2RTC_STARTUP_ERROR_DELAY) {
      this._reportError(error);
      return;
    }
    this._emitState("retrying", go2rtcErrorMessage(error) || "go2rtc retrying");
    this._scheduleReconnect();
  }

  _emitState(state:string, message = "") {
    this.dispatchEvent(new CustomEvent("nodalia-go2rtc-state", {
      bubbles: true,
      composed: true,
      detail: { state, message },
    }));
  }

  _reportError(error:unknown) {
    window.clearTimeout(this._modeTimer);
    window.clearTimeout(this._socketOpenTimer);
    this._modeTimer = 0;
    this._socketOpenTimer = 0;
    this.dispatchEvent(new CustomEvent("nodalia-go2rtc-error", {
      bubbles: true,
      composed: true,
      detail: { message: go2rtcErrorMessage(error) || "go2rtc error" },
    }));
  }

  _resetModeTransport() {
    this._transportGeneration++;
    this._playRevision++;
    this._displayRevision++;
    if (this._peer) {
      this._peer.close();
      this._peer = null;
    }
    this._clearAudioTrackListeners();
    this._sourceBuffer = null;
    this._bufferQueue = [];
    this._bufferQueueBytes = 0;
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
    this._connectElementAudioOutput();
    this._stopAudioPrime();
    this._revokePosterObjectUrl();
    this._playbackStream = null;
  }

  async _play() {
    const video=this._video;
    if(!video || !this.isConnected) return false;
    const generation=this._transportGeneration;
    const revision=++this._playRevision;
    const current=()=>video===this._video && this.isConnected && generation===this._transportGeneration && revision===this._playRevision;
    this._setVideoMuted(this._muted);
    this._resumeAudioOutput();
    this._syncAudioOutput();
    try {
      await video.play();
      if(!current()) return false;
      this._autoplayMuted = false;
      return true;
    } catch (_error) {
      if(!current()) return false;
      if (!this._muted) {
        this._setVideoMuted(true);
        try {
          await video.play();
          if(!current()) return false;
          this._autoplayMuted = true;
          if (this._audioContext) {
            this._resumeAudioOutput();
            this._setVideoMuted(false);
            this._syncAudioOutput();
            try {
              await video.play();
              if(!current()) return false;
              this._autoplayMuted = video.muted;
            } catch (_audioError) {
              if(!current()) return false;
              this._setVideoMuted(true);
              this._autoplayMuted = true;
            }
          }
          return true;
        } catch (_secondError) {
          // The native controls remain available for a user-initiated play.
        }
      }
      return false;
    }
  }

  _markLoaded() {
    window.clearTimeout(this._modeTimer);
    this._modeTimer = 0;
    this._hasDecodedFrameOnce = true;
    this._startupStartedAt = 0;
    this._emitState("loaded");
    this.dispatchEvent(new CustomEvent("nodalia-go2rtc-loaded", { bubbles: true, composed: true }));
  }

  _activeWebRtcTracks(peer:RTCPeerConnection|null) {
    if (!peer?.getTransceivers) {
      return [];
    }
    return peer.getTransceivers()
      .filter(transceiver => ["recvonly", "sendrecv"].includes(transceiver.currentDirection??""))
      .map(transceiver => transceiver.receiver?.track)
      .filter(track => track && track.readyState !== "ended");
  }

  _attachConnectedWebRtcStream(peer:RTCPeerConnection|null) {
    if (peer !== this._peer || !this._video) {
      return false;
    }
    const tracks = this._activeWebRtcTracks(peer);
    if (!tracks.some(track => track.kind === "video")) {
      return false;
    }
    this._stopAudioPrime();
    const audioTrack = tracks.find(track => track.kind === "audio");
    const audioRouted = this._routeWebRtcAudioTrack(audioTrack);
    const mediaStream = new MediaStream(audioRouted
      ? tracks.filter(track => track.kind !== "audio")
      : tracks);
    this._playbackStream = mediaStream;
    this._video.srcObject = mediaStream;
    this._watchAudioTracks(tracks);
    void this._play();
    return true;
  }

  _startWebRtc() {
    const peer = new RTCPeerConnection({
      bundlePolicy: "max-bundle",
      iceServers: [
        { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
      ],
      ...{sdpSemantics: "unified-plan"},
    });
    peer.addEventListener("track", () => {
      if (peer === this._peer && peer.connectionState === "connected") {
        this._attachConnectedWebRtcStream(peer);
      }
    });
    peer.addEventListener("icecandidate", event => {
      if(peer!==this._peer || !this.isConnected) return;
      const candidate = event.candidate?.toJSON?.().candidate || "";
      this._send({ type: "webrtc/candidate", value: candidate });
    });
    peer.addEventListener("connectionstatechange", () => {
      if (peer !== this._peer) {
        return;
      }
      if (peer.connectionState === "connected") {
        this._attachConnectedWebRtcStream(peer);
        this._armModeTimeout("webrtc", GO2RTC_WEBRTC_PROGRESS_TIMEOUT);
      } else if (peer.connectionState === "connecting") {
        this._armModeTimeout("webrtc", GO2RTC_WEBRTC_PROGRESS_TIMEOUT);
      } else if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
        this._fallback(new Error(`go2rtc WebRTC ${peer.connectionState}`));
      }
    });
    this._messageHandlers.set("webrtc", message => {
      if(peer!==this._peer || !this.isConnected) return;
      if (message.type === "webrtc/candidate" && message.value) {
        peer.addIceCandidate({ candidate: String(message.value), sdpMid: "0" }).catch(() => {});
      } else if (message.type === "webrtc/answer") {
        this._armModeTimeout("webrtc", GO2RTC_WEBRTC_PROGRESS_TIMEOUT);
        peer.setRemoteDescription({ type: "answer", sdp: String(message.value??"") }).catch(error => {
          if (peer === this._peer) {
            this._fallback(error);
          }
        });
      } else if (message.type === "error" && String(message.value || "").includes("webrtc/offer")) {
        this._fallback(new Error(String(message.value)));
      }
    });
    this._peer = peer;
    peer.addTransceiver("video", { direction: "recvonly" });
    peer.addTransceiver("audio", { direction: "recvonly" });
    peer.createOffer()
      .then(offer => peer===this._peer && this.isConnected ? peer.setLocalDescription(offer).then(() => offer) : undefined)
      .then(offer => {
        if (offer && peer === this._peer && this.isConnected) {
          this._send({ type: "webrtc/offer", value: offer.sdp });
        }
      })
      .catch(error => {
        if (peer === this._peer) {
          this._fallback(error);
        }
      });
  }

  _supportedCodecs(isSupported:(type:string)=>boolean|string) {
    const codecs = [
      "avc1.640029",
      "avc1.64002A",
      "avc1.640033",
      "hvc1.1.6.L153.B0",
      "mp4a.40.2",
      "mp4a.40.5",
      "flac",
      "opus",
    ];
    const safari = String(window.navigator?.userAgent || "").match(/Version\/(\d+).+Safari/);
    if (safari) {
      const version = Number(safari[1]);
      const firstUnsupported = version < 13 ? "mp4a.40.2" : version < 14 ? "flac" : "opus";
      codecs.splice(codecs.indexOf(firstUnsupported));
    }
    return codecs.filter(codec => isSupported(`video/mp4; codecs="${codec}"`)).join();
  }

  _startMse() {
    const video=this._video;
    if(!video) return;
    const MediaSourceClass = window.ManagedMediaSource || window.MediaSource;
    const mediaSource = new MediaSourceClass();
    this._mediaSource = mediaSource;
    this._mseCodecs = "";
    this._connectElementAudioOutput();
    mediaSource.addEventListener("sourceopen", () => {
      if (mediaSource === this._mediaSource) {
        this._send({ type: "mse", value: this._supportedCodecs(MediaSourceClass.isTypeSupported) });
      }
    }, { once: true });
    if (window.ManagedMediaSource) {
      this._stopAudioPrime();
      this._playbackStream = null;
      video.disableRemotePlayback = true;
      video.srcObject = mediaSource;
    } else {
      this._stopAudioPrime();
      this._playbackStream = null;
      video.srcObject = null;
      video.src = URL.createObjectURL(mediaSource);
    }
    void this._play();
    this._messageHandlers.set("mse", message => {
      if (mediaSource !== this._mediaSource) {
        return;
      }
      if (message.type === "error" && String(message.value || "").startsWith("mse")) {
        this._fallback(new Error(String(message.value)));
        return;
      }
      if (message.type !== "mse") {
        return;
      }
      try {
        this._mseCodecs = String(message.value || "");
        const hasAudio = /(?:mp4a|opus|flac|pcma|pcmu)/i.test(this._mseCodecs);
        this._emitAudioState(hasAudio ? [{ kind: "audio", muted: false }] : [], "mse");
        const sourceBuffer = mediaSource.addSourceBuffer(String(message.value??""));
        sourceBuffer.mode = "segments";
        sourceBuffer.addEventListener("updateend", () => {if(sourceBuffer===this._sourceBuffer && mediaSource===this._mediaSource) this._flushMseQueue();});
        this._sourceBuffer = sourceBuffer;
        this._binaryHandler = data => {
          if (mediaSource !== this._mediaSource) {
            return;
          }
          const byteLength = Number(data?.byteLength) || 0;
          if (this._bufferQueueBytes + byteLength > GO2RTC_MAX_MSE_QUEUE_BYTES) {
            this._fallback(new Error("go2rtc MSE buffer queue exceeded its safety limit"));
            return;
          }
          this._bufferQueue.push(data);
          this._bufferQueueBytes += byteLength;
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
        const data = this._bufferQueue.shift();
        if(!data) return;
        this._bufferQueueBytes = Math.max(0, this._bufferQueueBytes - (Number(data?.byteLength) || 0));
        sourceBuffer.appendBuffer(data);
      }
    } catch (error) {
      this._fallback(error);
    }
  }

  _startHls() {
    const video=this._video;
    const generation=this._transportGeneration;
    if(!video) return;
    this._messageHandlers.set("hls", message => {
      if(video!==this._video || generation!==this._transportGeneration || !this.isConnected) return;
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
      this._stopAudioPrime();
      this._connectElementAudioOutput();
      this._playbackStream = null;
      video.srcObject = null;
      video.src = `data:application/vnd.apple.mpegurl;base64,${window.btoa(playlist)}`;
      void this._play();
    });
    this._send({ type: "hls", value: this._supportedCodecs(type => video.canPlayType(type)) });
  }

  _startMjpeg() {
    const video=this._video;
    const generation=this._transportGeneration;
    if(!video) return;
    let loaded = false;
    video.controls = false;
    this._binaryHandler = data => {
      if(video!==this._video || generation!==this._transportGeneration || !this.isConnected) return;
      this._revokePosterObjectUrl();
      this._posterObjectUrl = URL.createObjectURL(new Blob([data], { type: "image/jpeg" }));
      video.poster = this._posterObjectUrl;
      if (!loaded) {
        loaded = true;
        this._stopAudioPrime();
        this._playbackStream = null;
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
