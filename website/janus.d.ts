declare namespace JanusJS {
  interface Dependencies {
    adapter: any;
    WebSocket: (server: string, protocol: string) => WebSocket;
    isArray: (array: any) => array is Array<any>;
    extension: () => boolean;
    httpAPICall: (url: string, options: any) => void;
  }

  interface DependenciesResult {
    adapter: any;
    newWebSocket: (server: string, protocol: string) => WebSocket;
    isArray: (array: any) => array is Array<any>;
    extension: () => boolean;
    httpAPICall: (url: string, options: any) => void;
  }

  enum DebugLevel {
    Trace = 'trace',
    Debug = 'debug',
    Log = 'log',
    Warning = 'warn',
    Error = 'error'
  }

  interface JSEP {
    ee2e?: boolean;
    sdp?: string;
    type?: string;
    rid_order?: "hml" | "lmh";
    force_relay?: boolean;
  }

  interface InitOptions {
    debug?: boolean | 'all' | DebugLevel[];
    callback?: Function;
    dependencies?: DependenciesResult;
  }

  interface Room {
    room: number;
    description: string;
    pin_required: boolean;
    is_private: boolean;
    max_publishers: number;
    bitrate: number;
    fir_freq: number;
    require_pvtid: boolean;
    require_e2ee: boolean;
    dummy_publisher: boolean;
    notify_joining: boolean;
    audiocodec: string;
    videocodec: string;
    record: boolean;
    lock_record: boolean;
    num_participants: number;
    audiolevel_ext: boolean;
    audiolevel_event: boolean;
    videoorient_ext: boolean;
    playoutdelay_ext: boolean;
    transport_wide_cc_ext: boolean;
    bitrate_cap?: boolean;
    opus_fec?: boolean;
    opus_dtx?: boolean;
    video_svc?: boolean;
    rec_dir?: string;
    audio_active_packets?: number;
    audio_level_average?: number;
  }

  interface ConstructorOptions {
    server: string | string[];
    iceServers?: RTCIceServer[];
    ipv6?: boolean;
    withCredentials?: boolean;
    max_poll_events?: number;
    destroyOnUnload?: boolean;
    token?: string;
    apisecret?: string;
    success?: Function;
    error?: (error: any) => void;
    destroyed?: Function;
  }

  interface ReconnectOptions {
    success?: Function;
    error?: (error: string) => void;
  }

  interface DestroyOptions {
    cleanupHandles?: boolean;
    notifyDestroyed?: boolean;
    unload?: boolean;
    success?: () => void;
    error?: (error: string) => void;
  }

  interface GetInfoOptions {
    success?: (info: any) => void;
    error?: (error: string) => void;
  }

  enum MessageType {
    Recording = 'recording',
    Starting = 'starting',
    Started = 'started',
    Stopped = 'stopped',
    SlowLink = 'slow_link',
    Preparing = 'preparing',
    Refreshing = 'refreshing'
  }

  interface Message {
    result?: {
      status: MessageType;
      id?: string;
      uplink?: number;
    };
    error?: string;
    [key: string]: any;
  }

  interface PluginCallbacks {
    dataChannelOptions?: RTCDataChannelInit;
    success?: (handle: PluginHandle) => void;
    error?: (error: string) => void;
    consentDialog?: (on: boolean) => void;
    webrtcState?: (isConnected: boolean) => void;
    iceState?: (state: 'connected' | 'failed' | 'disconnected' | 'closed') => void;
    mediaState?: (medium: 'audio' | 'video', receiving: boolean, mid?: number) => void;
    slowLink?: (uplink: boolean, lost: number, mid: string) => void;
    onmessage?: (message: Message, jsep?: JSEP) => void;
    onlocaltrack?: (track: MediaStreamTrack, on: boolean) => void;
    onremotetrack?: (track: MediaStreamTrack, mid: number, on: boolean) => void;
    ondataopen?: Function;
    ondata?: Function;
    oncleanup?: Function;
    ondetached?: Function;
  }

  interface PluginOptions extends PluginCallbacks {
    plugin: string;
    opaqueId?: string;
  }

  interface Track {
    type: "audio" | "video" | "screen" | "data";
    mid?: string;
    capture?: boolean | MediaTrackConstraints;
  }

  interface OfferParams {
    tracks?: Track[],
    media?: {
      audioSend?: boolean;
      audioRecv?: boolean;
      videoSend?: boolean;
      videoRecv?: boolean;
      audio?: boolean | { deviceId: string };
      video?:
      | boolean
      | { deviceId: string; width?: number; height?: number; }
      | 'lowres'
      | 'lowres-16:9'
      | 'stdres'
      | 'stdres-16:9'
      | 'hires'
      | 'hires-16:9';
      data?: boolean;
      failIfNoAudio?: boolean;
      failIfNoVideo?: boolean;
      screenshareFrameRate?: number;
    };
    trickle?: boolean;
    stream?: MediaStream;
    success: Function;
    error: (error: any) => void;
    customizeSdp: (jsep: JSEP) => void;
  }

  interface PluginMessage {
    message: {
      request: string;
      [otherProps: string]: any;
    };
    jsep?: JSEP;
    success?: (data?: any) => void;
    error?: (error: string) => void;
  }

  interface WebRTCInfo {
    bitrate: {
      bsbefore: string | null;
      bsnow: string | null;
      timer: string | null;
      tsbefore: string | null;
      tsnow: string | null;
      value: string | null;
    };
    dataChannel: Array<RTCDataChannel>;
    dataChannelOptions: RTCDataChannelInit;

    dtmfSender: string | null;
    iceDone: boolean;
    mediaConstraints: any;
    mySdp: {
      sdp: string;
      type: string;
    };
    myStream: MediaStream;
    pc: RTCPeerConnection;
    receiverTransforms: {
      audio: TransformStream;
      video: TransformStream;
    };
    remoteSdp: string;
    remoteStream: MediaStream;
    senderTransforms: {
      audio: TransformStream;
      video: TransformStream;
    };
    started: boolean;
    streamExternal: boolean;
    trickle: boolean;
    volume: {
      value: number;
      timer: number;
    };
  }
  interface DetachOptions {
    success?: () => void;
    error?: (error: string) => void;
    noRequest?: boolean;
  }
  interface PluginHandle {
    plugin: string;
    id: string;
    token?: string;
    detached: boolean;
    webrtcStuff: WebRTCInfo;
    getId(): string;
    getPlugin(): string;
    send(message: PluginMessage): void;
    createOffer(params: OfferParams): void;
    createAnswer(params: any): void;
    handleRemoteJsep(params: { jsep: JSEP }): void;
    replaceTracks(paramy: { tracks: Track[]; success?: () => void; error?: (err: any) => void }): void;
    dtmf(params: any): void;
    data(params: any): void;
    isAudioMuted(mid?: string): boolean;
    muteAudio(mid?: string): void;
    unmuteAudio(mid?: string): void;
    isVideoMuted(mid?: string): boolean;
    muteVideo(mid?: string): void;
    unmuteVideo(mid?: string): void;
    getBitrate(): string;
    hangup(sendRequest?: boolean): void;
    detach(params?: DetachOptions): void;
  }

  class Janus {
    static webRTCAdapter: any;
    static safariVp8: boolean;
    static useDefaultDependencies(deps: Partial<Dependencies>): DependenciesResult;
    static useOldDependencies(deps: Partial<Dependencies>): DependenciesResult;
    static init(options: InitOptions): void;
    static isWebrtcSupported(): boolean;
    static debug(...args: any[]): void;
    static log(...args: any[]): void;
    static warn(...args: any[]): void;
    static error(...args: any[]): void;
    static randomString(length: number): string;
    static attachMediaStream(element: HTMLMediaElement, stream: MediaStream): void;
    static reattachMediaStream(to: HTMLMediaElement, from: HTMLMediaElement): void;

    static stopAllTracks(stream: MediaStream): void;

    constructor(options: ConstructorOptions);

    attach(options: PluginOptions): void;
    getServer(): string;
    isConnected(): boolean;
    reconnect(callbacks: ReconnectOptions): void;
    getSessionId(): number;
    getInfo(callbacks: GetInfoOptions): void;
    destroy(callbacks: DestroyOptions): void;
  }
}

export default JanusJS.Janus;
export { JanusJS };
