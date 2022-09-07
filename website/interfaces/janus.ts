export interface PublisherStream {
  type: "audio" | "video" | "data";
  mindex: number;
  mid: string;
  disabled?: boolean;
  codec?: string;
  description?: string;
  moderated?: boolean;
  simulcast?: boolean;
  svc?: boolean;
  talking?: boolean;

  // own types
  // id?: number;
  // display?: string;
}

export interface SubscriberStream {
  mindex: number;
  mid: string;
  type: "audio" | "video" | "data";
  feed_id: number;
  feed_mid: string;
  send: boolean;
  ready: boolean;
  feed_display?: string;
}

export interface Publisher {
  id: number;
  display: string;
  streams: PublisherStream[];
  dummy?: boolean;
}