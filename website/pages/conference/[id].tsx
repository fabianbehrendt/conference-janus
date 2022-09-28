import { useRouter } from "next/router";
import React, { useEffect, useCallback, useRef, useState, useMemo, useReducer } from "react";

import styles from "../../styles/ConferenceRoom.module.css";

// @ts-ignore
import { Janus } from 'janus-gateway';
import { JanusJS } from "../../janus";

import randomColor from "randomcolor";

import Icon from "@mdi/react";
import {
  mdiMicrophone,
  mdiMicrophoneOff,
  mdiVideo,
  mdiVideoOff,
  mdiCog,
  mdiAccount,
  mdiPhoneHangup,
  mdiMessage,
  mdiVideoSwitch,
  mdiSend,
  mdiClose,
  mdiMessageBadge,
} from "@mdi/js";

import Layout from "../../components/Layout";
import { Publisher, PublisherStream, SubscriberStream } from "../../interfaces/janus";
import { useSocket } from "../../contexts/SocketProvider";
import reducer from "../../reducers/janus";
import VideoFrame from "../../components/VideoFrame";
import VideoGrid from "../../components/VideoGrid";
import { parseIntStrict } from "../../utils/parseIntStrict";
import { useAppHeight } from "../../contexts/AppHeightProvider";
import VideoElement from "../../components/VideoElement";
import Avatar from "../../components/Avatar";

const Room = () => {
  const [newPublishers, setNewPublishers] = useState<Publisher[]>([]);
  const [hasPublisherJoined, setHasPublisherJoined] = useState<boolean>(false);
  const [hasSubscriberJoined, setHasSubscriberJoined] = useState<boolean>(false);
  const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
  const [userName, setUserName] = useState("");
  const [hostSecret, setHostSecret] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>();
  const [room, setRoom] = useState<JanusJS.Room>();
  const [offerJsep, setOfferJsep] = useState<JanusJS.JSEP | null>(null);
  const [isLocalAudioMuted, setIsLocalAudioMuted] = useState<boolean>(false);
  const [isLocalVideoMuted, setIsLocalVideoMuted] = useState<boolean>(false);
  const [localStreamToShow, setLocalStreamToShow] = useState<"primary" | "alternative">("primary");
  const [isSettingsVisible, setIsSettingsVisible] = useState<boolean>(false);
  const [isChatVisible, setIsChatVisible] = useState<boolean>(false);
  const [isStreamSwitchSettingsVisible, setIsStreamSwitchSettingsVisible] = useState<boolean>(false);
  const [audioInputDeviceId, setAudioInputDeviceId] = useState<{ primary: string | undefined, alternative: string | undefined }>({ primary: undefined, alternative: undefined });
  const [videoInputDeviceId, setVideoInputDeviceId] = useState<{ primary: string | undefined, alternative: string | undefined }>({ primary: undefined, alternative: undefined });
  const [audioOutputDeviceId, setAudioOutputDeviceId] = useState<string>();
  const [showLocalVideoPreview, setShowLocalVideoPreview] = useState<boolean>(true);
  const [showRoomControls, setShowRoomControls] = useState<boolean>(true);
  const [streamToShowToParticipant, setStreamToShowToParticipant] = useState<{ [id: number]: "primary" | "alternative" }>({});
  const [isChatNotificationShown, setIsChatNotificationShown] = useState<boolean>(false);

  const [state, dispatch] = useReducer(reducer, {
    feedStreams: {},
    subStreams: {},
    localTracks: {},
    remoteTracks: {},
    remoteStreams: {},
    messages: [],
  });

  const id = useRef<number>();
  const privateId = useRef<number>();
  const displayName = useRef<string>();
  const publisherHandle = useRef<JanusJS.PluginHandle>();
  const subscriberHandle = useRef<JanusJS.PluginHandle>();
  const isSubscriberJoining = useRef(false);
  const timeoutVideoPreview = useRef<NodeJS.Timeout | null>(null)
  const timeoutRoomControls = useRef<NodeJS.Timeout | null>(null);
  const isChatWindowOpen = useRef<boolean>(false);

  const router = useRouter();
  const socket = useSocket();
  const appHeight = useAppHeight();

  const gridColumns: number = useMemo(() => {
    let numOfRemoteStreams = Object.keys(state.remoteStreams).length;

    if (numOfRemoteStreams < 3) {
      return numOfRemoteStreams;
    } else {
      return Math.ceil(Math.sqrt(numOfRemoteStreams));
    }
  }, [state.remoteStreams]);

  const gridRows: number = useMemo(() => {
    let numOfRemoteStreams = Object.keys(state.remoteStreams).length;

    if (numOfRemoteStreams === 0) {
      return 0;
    } else if (numOfRemoteStreams < 3) {
      return 1;
    } else {
      return Math.ceil(Math.sqrt(numOfRemoteStreams));
    }
  }, [state.remoteStreams]);

  const localVideoStreams = useMemo(() => {
    const localVideoTracks = Object.values(state.localTracks).filter(track => track.kind === "video");

    if (localVideoTracks.length === 0) {
      return;
    }

    return {
      primary: new MediaStream([localVideoTracks[0]]),
      alternative: new MediaStream([localVideoTracks.length === 1 ? localVideoTracks[0] : localVideoTracks[1]]),
    };
  }, [state.localTracks]);

  const localVideoStreamsSettings = useMemo(() => {
    const localVideoTracks = Object.values(state.localTracks).filter(track => track.kind === "video");

    if (localVideoTracks.length === 0) {
      return;
    }

    return {
      primary: new MediaStream([localVideoTracks[0].clone()]),
      alternative: new MediaStream([localVideoTracks.length === 1 ? localVideoTracks[0].clone() : localVideoTracks[1].clone()]),
    };
  }, [state.localTracks]);

  const handleLocalAudioToggle = useCallback(() => {
    const localAudioTracks = Object.entries(state.localTracks)
      .filter(([mid, track]) => track.kind === "audio");

    localAudioTracks
      .forEach(([mid, track]) => {
        isLocalAudioMuted ? (
          publisherHandle.current?.unmuteAudio(mid)
        ) : (
          publisherHandle.current?.muteAudio(mid)
        )
      })

    setIsLocalAudioMuted(
      localAudioTracks
        .every(([mid, track]) => publisherHandle.current?.isAudioMuted(mid))
    )
  }, [isLocalAudioMuted, state.localTracks]);

  const handleLocalVideoToggle = useCallback(() => {
    const localVideoTracks = Object.entries(state.localTracks)
      .filter(([mid, track]) => track.kind === "video");

    localVideoTracks
      .forEach(([mid, track]) => {
        isLocalVideoMuted ? (
          publisherHandle.current?.unmuteVideo(mid)
        ) : (
          publisherHandle.current?.muteVideo(mid)
        )
      })

    setIsLocalVideoMuted(
      localVideoTracks
        .every(([mid, track]) => publisherHandle.current?.isVideoMuted(mid))
    )
  }, [isLocalVideoMuted, state.localTracks]);

  const handleSettingsToggle = useCallback(() => {
    setIsSettingsVisible(prev => !prev);
  }, []);

  const handleChatToggle = useCallback(() => {
    setIsChatVisible(prev => !prev);
    setIsChatNotificationShown(false);
  }, []);

  useEffect(() => {
    if (socket?.connected != null) {
      setIsSocketConnected(socket.connected);
    }
  }, [socket?.connected])

  useEffect(() => {
    if (socket == null) {
      return;
    }

    socket.on("connect", () => {
      console.log("connected to socket")
      setIsSocketConnected(true);
    })

    socket.on("disconnect", reason => {
      if (reason === "io server disconnect") {
        // TODO Not tested yet!
        socket.connect();
      }

      setIsSocketConnected(false);

      // TODO Necessary to leave here? Or should only leave on page reload / janus disconnect
      if (room == null) {
        return;
      }

      socket.emit("leave", room.room, id.current);
    })

    socket.on("switch-stream", (hostId: number, showAlt: boolean) => {
      if (hostId == null) {
        return;
      }

      const hostVideoMid = state.feedStreams[hostId].streams
        .find(stream => stream.type === "video" && (
          showAlt ? stream.description !== "primary" : stream.description === "primary")
        )
        ?.mid;

      const hostAudioMid = state.feedStreams[hostId].streams
        .find(stream => stream.type === "audio" && (
          showAlt ? stream.description !== "primary" : stream.description === "primary")
        )
        ?.mid;

      if (hostVideoMid == null || hostAudioMid == null) {
        return;
      }

      subscriberHandle.current?.send({
        message: {
          request: "switch",
          streams: [
            {
              feed: hostId,
              mid: hostAudioMid,
              sub_mid: Object.values(state.subStreams).find(substream => substream.feed_id === hostId && substream.type === "audio")?.mid,
            },
            {
              feed: hostId,
              mid: hostVideoMid,
              sub_mid: Object.values(state.subStreams).find(substream => substream.feed_id === hostId && substream.type === "video")?.mid,
            }
          ]
        }
      })
    })

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("leave");
      socket.off("switch-stream");
    }
  }, [room, socket, state.feedStreams, state.subStreams]);

  const unsubscribeFrom = useCallback((id: number) => {
    dispatch({ type: "remove feed stream", id: id });
    dispatch({ type: "remove remote stream", feedId: id });

    subscriberHandle.current?.send({
      message: {
        request: "unsubsribe",
        streams: [{ feed: id }],
      },
    });
  }, []);

  useEffect(() => {
    // TODO currently produces duplicate streams e.g. when updating streams (as they will be added to newPublishers and be ready for subscription, again)

    if (room == null || pin == null || privateId.current == null || newPublishers.length === 0) {
      return;
    }
    let streams: { feed: number; mid: string; }[] = [];

    for (const newPublisher of newPublishers) {
      streams = [
        ...streams,
        ...newPublisher.streams
          .filter(stream => stream.description === "primary" || stream.type === "data")
          .map(stream => ({ feed: newPublisher.id, mid: stream.mid }))
      ]
    }

    if (hasSubscriberJoined) {
      subscriberHandle.current?.send({
        message: {
          request: "subscribe",
          streams: streams,
        }
      })

      setNewPublishers([]);
    } else if (!isSubscriberJoining.current) {
      isSubscriberJoining.current = true;
      subscriberHandle.current?.send({
        message: {
          request: "join",
          ptype: "subscriber",
          room: room.room,
          private_id: privateId.current,
          streams: streams,
          pin: pin,
        }
      })

      setNewPublishers([]);
    }
  }, [newPublishers, hasSubscriberJoined, room, pin]);

  useEffect(() => {
    window.onbeforeunload = () => {
      if (socket != null && isSocketConnected && room != null) {
        socket.emit("leave", room.room, id.current);
      }
    }

    return () => {
      window.onbeforeunload = () => { };
    }
  }, [isSocketConnected, room, socket])

  useEffect(() => {
    if (!hasPublisherJoined || room == null || socket == null || !isSocketConnected || offerJsep == null) {
      return;
    }

    socket.emit("join", room.room, id.current, hostSecret != null);

    publisherHandle.current?.send({
      message: {
        request: "publish",
        descriptions: [
          {
            mid: "0",
            description: "primary",
          },
          {
            mid: "1",
            description: "primary",
          },
        ],
      },
      jsep: offerJsep,
    })
  }, [hasPublisherJoined, hostSecret, isSocketConnected, offerJsep, room, socket]);

  useEffect(() => {
    if (!isSocketConnected || unsubscribeFrom == null || !router.isReady || typeof router.query.id !== "string")
      return;

    // Parse url into id of conference room
    const roomId = parseIntStrict(router.query.id);

    if (isNaN(roomId)) {
      // TODO Handle room id not parseable
      throw new Error("Room ID could not be parsed")
    }

    // Get secret from URL query string
    const secret = router.query.secret;

    if (secret != null && typeof secret === "string") {
      setHostSecret(secret);
    }

    // Get PIN from URL query string
    const userPin = router.query.pin;

    if (userPin != null && typeof userPin === "string") {
      setPin(userPin);
    }

    Janus.init({
      debug: false,
      callback: () => {
        Janus.listDevices((devices: MediaDeviceInfo[]) => {
          setAvailableDevices(devices);

          const audioInputDevices = devices.filter(device => device.kind === "audioinput");
          const videoInputDevices = devices.filter(device => device.kind === "videoinput");
          const audioOutputDevices = devices.filter(device => device.kind === "audiooutput");

          if (audioInputDevices.length > 0) {
            setAudioInputDeviceId({
              primary: audioInputDevices[0].deviceId,
              alternative: audioInputDevices[0].deviceId
            });
          }

          if (videoInputDevices.length > 0) {
            setVideoInputDeviceId({
              primary: videoInputDevices[0].deviceId,
              alternative: "screen"
            });
          }

          if (audioOutputDevices.length > 0) {
            setAudioOutputDeviceId(audioOutputDevices[0].deviceId);
          }

          const opaqueId = `videoroom-${Janus.randomString(12)}`;

          const janus = new Janus({
            server: "wss://janus.fabianbehrendt.de",
            success: () => {
              janus.attach({
                plugin: "janus.plugin.videoroom",
                opaqueId: opaqueId,
                success: (pluginHandle: JanusJS.PluginHandle) => {
                  // TODO successfully attached
                  // console.log("attached to plugin echotest")

                  publisherHandle.current = pluginHandle;

                  publisherHandle.current.send({
                    message: {
                      request: "list",
                    },
                    success: (msg: { list: JanusJS.Room[], videoroom: "success" | "event", error_code?: number, error?: string }) => {
                      const event = msg.videoroom;

                      if (event === "success") {
                        const currentRoom = msg.list.find(room => room.room === roomId);

                        if (currentRoom == null) {
                          return;
                        }

                        setRoom(currentRoom);
                      }
                    }
                  });

                  const primaryTracks: JanusJS.Track[] = [
                    { type: "audio", capture: true },
                    { type: "video", capture: true },
                    { type: "data" },
                  ];

                  const alternativeTracks: JanusJS.Track[] = [
                    { type: "audio", capture: true },
                    { type: "screen", capture: true },
                  ];

                  publisherHandle.current?.createOffer({
                    tracks: secret == null ? (
                      primaryTracks
                    ) : (
                      [...primaryTracks, ...alternativeTracks]
                    ),
                    success: (jsep: JanusJS.JSEP) => {
                      setOfferJsep(jsep);
                    },
                    error: error => {
                      // TODO handle error
                    },
                    customizeSdp: jsep => {
                      // TODO customize sdp
                    }
                  });
                },
                error: cause => {
                  // TODO error
                },
                consentDialog: on => {
                  // TODO e.g. darken the screen if on === true (getUserMedia incoming)
                  // console.log("consent | on:", on)
                },
                onmessage: (msg, jsep) => {
                  console.log("publisher msg, jsep:", msg, jsep ? jsep : "no jsep")

                  const event = msg.videoroom;

                  if (event === "joined") {
                    id.current = msg.id;
                    privateId.current = msg.private_id;

                    setHasPublisherJoined(true);

                    if (msg.publishers) {
                      setNewPublishers(prev => [...prev, ...msg.publishers]);

                      let newFeedStreams = {};

                      for (const publisher of msg.publishers as Publisher[]) {
                        const id = publisher.id;
                        const display = publisher.display;
                        const streams = publisher.streams;

                        newFeedStreams = {
                          ...newFeedStreams,
                          [id]: {
                            id: id,
                            display: display,
                            streams: streams.map(stream => {
                              return {
                                ...stream,
                                id: id,
                                display: display,
                              }
                            }),
                          },
                        };

                        dispatch({ type: "add feed stream", id: publisher.id, display: publisher.display, streams: publisher.streams });
                        setStreamToShowToParticipant(prev => {
                          return {
                            ...prev,
                            [publisher.id]: "primary"
                          };
                        });
                      }
                    }
                  } else if (event === "event") {
                    if (msg.streams) {
                      dispatch({ type: "add feed stream", id: id.current, display: displayName.current, streams: msg.streams });
                    } else if (msg.publishers) {
                      setNewPublishers(prev => [...prev, ...msg.publishers]);

                      let newFeedStreams = {};

                      for (const publisher of msg.publishers as Publisher[]) {
                        const id = publisher.id;
                        const display = publisher.display;
                        const streams = publisher.streams;

                        newFeedStreams = {
                          ...newFeedStreams,
                          [id]: {
                            id: id,
                            display: display,
                            streams: streams.map(stream => {
                              return {
                                ...stream,
                                id: id,
                                display: display,
                              }
                            }),
                          },
                        };

                        dispatch({ type: "add feed stream", id: publisher.id, display: publisher.display, streams: publisher.streams });
                        setStreamToShowToParticipant(prev => {
                          return {
                            ...prev,
                            [publisher.id]: "primary"
                          };
                        });
                      }
                    } else if (msg.leaving) {
                      unsubscribeFrom(msg.leaving);
                    } else if (msg.unpublished) {
                      if (msg.unpublished === "ok") {
                        // That's us
                        if (socket != null && roomId != null) {
                          socket.emit("leave", roomId, id.current);
                        }

                        window.location.reload();

                        //! Currently throws error (probably fixed in future janus.js updates)
                        // publisherHandle.current?.hangup();
                        // subscriberHandle.current?.detach({
                        //   success: () => {
                        //     publisherHandle.current?.detach({
                        //       success: () => {
                        //         router.push("/create-conference");
                        //       }
                        //     });
                        //   }
                        // });

                        return;
                      }

                      unsubscribeFrom(msg.unpublished);
                    }
                  }

                  if (jsep) {
                    // console.log("### handle remote JSEP ###", jsep.type, jsep.sdp)
                    publisherHandle.current?.handleRemoteJsep({ jsep: jsep })
                  }
                },
                onlocaltrack: (track, added) => {
                  // TODO local track has been added or removed
                  // setLocalTracks(prev => [...prev, track]);
                  if (added) {
                    // console.log("local track added", track)
                    dispatch({ type: "add local track", track: track });
                  } else {
                    // console.log("local track removed", track)
                    dispatch({ type: "remove local track", track: track });
                  }
                },
                onremotetrack: (track, mid, added) => {
                  // nothing to expect here
                },
                ondataopen: (data: any) => {
                  // console.log("on publisher data open", data);
                },
                ondata: (data: any) => {
                  // console.log("on publisher data", data);
                },
                oncleanup: () => {
                  // TODO clean UI
                },
                detached: () => {
                  // TODO connection closed
                },
              } as JanusJS.PluginOptions);

              janus.attach({
                plugin: "janus.plugin.videoroom",
                opaqueId: opaqueId,
                success: (pluginHandle: JanusJS.PluginHandle) => {
                  subscriberHandle.current = pluginHandle
                },
                error: cause => {
                  // TODO error
                },
                onmessage: (msg, jsep) => {
                  console.log("subscriber msg, jsep:", msg, jsep ? jsep : "no jsep")

                  const event = msg.videoroom;

                  if (msg.error) {
                    // TODO handle error
                  } else if (event === "attached") {
                    isSubscriberJoining.current = false;
                    setHasSubscriberJoined(true);
                  } else if (event === "event") {
                    // TODO simulcast related stuff
                  }

                  if (msg.streams) {
                    // console.log("msg.streams:", msg)
                    let newSubStreams = {};

                    for (const stream of msg.streams) {
                      const mid = stream.mid;

                      newSubStreams = {
                        ...newSubStreams,
                        [mid]: stream,
                      };

                      dispatch({ type: "add sub stream", mid: mid, stream: stream });
                    }
                  }

                  if (jsep) {
                    subscriberHandle.current?.createAnswer({
                      // We attach the remote OFFER
                      jsep: jsep,
                      tracks: [
                        { type: "data" }
                      ],
                      success: (ourjsep: JanusJS.JSEP) => {
                        subscriberHandle.current?.send({
                          message: {
                            request: "start"
                          },
                          jsep: ourjsep
                        });
                      },
                      error: (error: any) => {
                        // An error occurred...
                        alert(error);
                      }
                    });
                  }
                },
                onlocaltrack: (track, added) => {
                  // TODO local track has been added or removed
                },
                onremotetrack: (track, mid, added) => {
                  // TODO on description change, maybe update existing mid instead of creating a new one ??? -> look at newPublishers

                  // console.log("remote track", track, mid, added)
                  // TODO remote track with specific mid has been added or removed
                  if (added) {
                    // console.log("remote track received:", track, mid)

                    dispatch({ type: "add remote track", mid: mid, track: track });
                    dispatch({ type: "add remote stream", mid: mid });
                  } else {
                    dispatch({ type: "remove remote track", mid: mid });
                  }
                },
                ondataopen: (data: any) => {
                  // console.log("on subscriber data open", data);
                },
                ondata: (data: string, from: string) => {
                  // console.log(`Received data from ${from}:\n${data}`)
                  dispatch({ type: "add message", id: parseIntStrict(from), data: data, showNotification: () => setIsChatNotificationShown(!isChatWindowOpen.current) })
                },
              } as JanusJS.PluginOptions);
            },
            error: cause => {
              // TODO Janus server object couldn't be initialized
              // console.log(cause)
            },
            destroyed: () => {
              // TODO Janus server object has been destroyed
              // console.log("destroyed")
            }
          } as JanusJS.ConstructorOptions);
        });
      }
    })
  }, [isSocketConnected, router, router.isReady, router.query, socket, unsubscribeFrom]);

  useEffect(() => {
    isChatWindowOpen.current = isChatVisible;
  }, [isChatVisible]);

  const remoteElements = useMemo(() => {
    const elements = Object.entries(state.remoteStreams)
      .map(([feedId, streams]) => {
        return (
          <div
            key={feedId}
            style={{ display: "flex", position: "relative" }}
          >
            <audio
              autoPlay
              hidden
              ref={ref => {
                if (ref) {
                  ref.srcObject = streams.audio;

                  // @ts-ignore
                  if (ref.setSinkId) {
                    // @ts-ignore
                    ref.setSinkId(audioOutputDeviceId);
                  }
                }
              }}
            />
            <VideoFrame
              stream={streams.video}
              muted
            />
            <p style={{ position: "absolute", left: 0, bottom: 0, margin: 0, padding: "4px 4px", background: "black", color: "white", opacity: "75%", borderRadius: "4px" }}>
              {Object.values(state.feedStreams).find(feedStream => feedStream.id.toString() === feedId)?.display}
            </p>
          </div>
        );
      })

    return elements;
  }, [audioOutputDeviceId, state.feedStreams, state.remoteStreams])

  const startPage = useMemo(() => {
    return (
      <div
        style={{
          boxSizing: "border-box",
          height: appHeight,
          display: "flex",
        }}
      >
        <div
          className={styles.userNameContainer}
        >
          <h1>Konferenz beitreten</h1>
          <h2>{room?.description}</h2>
          <form
            className={styles.enterUserNameStartUp}
            onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
              event.preventDefault();

              const displayNameValue = event.currentTarget.username.value;
              displayName.current = displayNameValue;

              publisherHandle.current?.send({
                message: {
                  request: "join",
                  ptype: "publisher",
                  room: room?.room,
                  display: displayNameValue,
                  pin: pin,
                },
              })
            }}
          >
            <input
              type="text"
              name="username"
              placeholder="Benutzernamen eingeben"
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                const displayNameValue = event.target.value;
                setUserName(displayNameValue);
              }}
            />
            <button>Beitreten</button>
          </form>
          <div className={styles.toolbarStartUp}>
            <div
              className="clickable"
              onClick={handleLocalAudioToggle}
            >
              <Icon
                path={isLocalAudioMuted ? mdiMicrophoneOff : mdiMicrophone}
                className="icon"
                size={1}
              />
            </div>
            <div
              className="clickable"
              onClick={handleLocalVideoToggle}
            >
              <Icon
                path={isLocalVideoMuted ? mdiVideoOff : mdiVideo}
                className="icon"
                size={1}
              />
            </div>
            <div
              className="clickable"
              onClick={handleSettingsToggle}
            >
              <Icon
                path={mdiCog}
                className="icon"
                size={1}
              />
            </div>
          </div>
          {hostSecret != null && (
            <div className={styles.hostButtonsSwitchStream}>
              <button
                className={`${localStreamToShow === "primary" && styles.hostButtonSelected}`}
                onClick={() => {
                  setLocalStreamToShow("primary");
                }}
              >
                Standard
              </button>
              <button
                className={`${localStreamToShow === "alternative" && styles.hostButtonSelected}`}
                onClick={() => {
                  setLocalStreamToShow("alternative");
                }}
              >
                Alternative
              </button>
            </div>
          )}
        </div>
        <div
          style={{
            flex: 1,
            background: "var(--black)",
          }}
        >
          {isLocalVideoMuted ? (
            <Avatar height={30} userName={userName} />
          ) : (
            <VideoElement
              stream={localVideoStreams && localVideoStreams[localStreamToShow]}
            />
          )}
        </div>
      </div>
    );
  }, [appHeight, handleLocalAudioToggle, handleLocalVideoToggle, handleSettingsToggle, hostSecret, isLocalAudioMuted, isLocalVideoMuted, localStreamToShow, localVideoStreams, pin, room?.description, room?.room, userName]);

  useEffect(() => {
    if (isLocalVideoMuted) {
      const localVideoTracks = Object.entries(state.localTracks)
        .filter(([mid, track]) => track.kind === "video");

      localVideoTracks
        .forEach(([mid, track]) => {
          publisherHandle.current?.muteVideo(mid);
        })
    }

    if (isLocalAudioMuted) {
      const localAudioTracks = Object.entries(state.localTracks)
        .filter(([mid, track]) => track.kind === "audio");

      localAudioTracks
        .forEach(([mid, track]) => {
          publisherHandle.current?.muteAudio(mid);
        })
    }
  }, [isLocalAudioMuted, isLocalVideoMuted, state.localTracks])

  useEffect(() => {
    if (hasPublisherJoined) {
      timeoutVideoPreview.current = setTimeout(() => setShowLocalVideoPreview(false), 2000);
      timeoutRoomControls.current = setTimeout(() => setShowRoomControls(false), 2000);
    }
  }, [hasPublisherJoined])

  const roomLocalVideoPreview = useMemo(() => {
    const localVideoTracks = Object.values(state.localTracks).filter(track => track.kind === "video");

    if (localVideoTracks.length === 0) {
      return <></>;
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          position: "absolute",
          top: 8,
          left: "50%",
          translate: "-50%",
          transition: "opacity 0.5s ease",
          opacity: showLocalVideoPreview ? 1 : 0,
        }}
        onPointerEnter={() => {
          if (timeoutVideoPreview.current) {
            clearTimeout(timeoutVideoPreview.current);
            timeoutVideoPreview.current = null;
          }

          setShowLocalVideoPreview(true);
        }}
        onPointerLeave={() => {
          timeoutVideoPreview.current = setTimeout(() => setShowLocalVideoPreview(false), 2000);
        }}
      >
        {room != null && <h2 style={{ alignSelf: "center", background: "var(--black)", color: "var(--secondary)", padding: "4px 8px", borderRadius: 8, }}>{room.description}</h2>}
        <div
          style={{ display: "flex", gap: 4, padding: 4, background: "var(--black)", aspectRatio: hostSecret != null ? "8/3" : "4/3", height: "20vh", border: isLocalVideoMuted ? "1px solid white" : "none" }}
        >
          {isLocalVideoMuted ? (
            <Avatar height={10} userName={userName} />
          ) : (
            <VideoElement
              stream={localVideoStreams?.primary}
              userName={hostSecret == null ? userName : "Standard"}
            />
          )}
          {hostSecret != null && (
            isLocalVideoMuted ? (
              <Avatar height={10} userName={userName} />
            ) : (
              <VideoElement
                stream={localVideoStreams?.alternative}
                userName={"Alternative"}
              />
            )
          )}
        </div>
      </div>
    );
  }, [hostSecret, isLocalVideoMuted, localVideoStreams?.alternative, localVideoStreams?.primary, room, showLocalVideoPreview, state.localTracks, userName])

  const roomControls = useMemo(() => {
    return (
      <div
        className={styles.roomControlsContainer}
        onPointerEnter={() => {
          if (timeoutRoomControls.current) {
            clearTimeout(timeoutRoomControls.current);
            timeoutRoomControls.current = null;
          }

          setShowRoomControls(true);
        }}
        onPointerLeave={() => {
          timeoutRoomControls.current = setTimeout(() => setShowRoomControls(false), 2000);
        }}
      >
        <div
          className={styles.roomControls}
          style={{
            translate: `0 ${showRoomControls ? 0 : "115%"}`
          }}
        >
          <div
            className="clickable"
            onClick={handleLocalAudioToggle}
          >
            <Icon
              className="icon"
              path={isLocalAudioMuted ? mdiMicrophoneOff : mdiMicrophone}
              size="32px"
              color="white"
            />
          </div>
          <div
            className="clickable"
            onClick={handleLocalVideoToggle}
          >
            <Icon
              className="icon"
              path={isLocalVideoMuted ? mdiVideoOff : mdiVideo}
              size="32px"
              color="white"
            />
          </div>
          <div
            className="clickable"
            onClick={handleChatToggle}
          >
            <Icon
              className="icon"
              path={isChatNotificationShown ? mdiMessageBadge : mdiMessage}
              size="32px"
              color="white"
            />
          </div>
          {hostSecret != null && (
            <div
              className="clickable"
              onClick={() => setIsStreamSwitchSettingsVisible(true)}
            >
              <Icon
                className="icon"
                path={mdiVideoSwitch}
                size="32px"
                color="white"
              />
            </div>
          )}
          <div
            className="clickable"
            onClick={handleSettingsToggle}
          >
            <Icon
              className="icon"
              path={mdiCog}
              size="32px"
              color="white"
            />
          </div>
          <div
            className="clickable icon-hangup"
            style={{
              background: "var(--red)",
              aspectRatio: "1/1",
              width: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
            }}
            onClick={() => {
              publisherHandle.current?.send({
                message: {
                  request: "unpublish"
                }
              })
            }}
          >
            <Icon
              path={mdiPhoneHangup}
              size="32px"
              color="white"
            />
          </div>
        </div>
      </div >
    );
  }, [handleChatToggle, handleLocalAudioToggle, handleLocalVideoToggle, handleSettingsToggle, hostSecret, isChatNotificationShown, isLocalAudioMuted, isLocalVideoMuted, showRoomControls]);

  const switchStreamGroup = useCallback((feedId: number, feedDisplay: string) => {
    return (
      <div
        key={feedId}
        style={{
          background: "rgb(48, 48, 48)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "center",
          borderRadius: 8,
          padding: 12,
          minWidth: 190,
          maxWidth: 250,
          boxSizing: "border-box",
        }}
      >
        <h3 style={{ color: "white", textAlign: "center", }}>{feedDisplay}</h3>
        <div
          className={styles.hostButtonsSwitchStream}
        >
          <button
            className={`${streamToShowToParticipant[feedId] === "primary" && styles.hostButtonSelected}`}
            onClick={() => {
              if (socket != null && room != null) {
                socket.emit("change-source", room.room, feedId, false)
              }

              setStreamToShowToParticipant(prev => {
                return {
                  ...prev,
                  [feedId]: "primary"
                };
              });
            }}
          >
            Standard
          </button>
          <button
            className={`${streamToShowToParticipant[feedId] === "alternative" && styles.hostButtonSelected}`}
            onClick={() => {
              if (socket != null && room != null) {
                socket.emit("change-source", room.room, feedId, true)
              }

              setStreamToShowToParticipant(prev => {
                return {
                  ...prev,
                  [feedId]: "alternative"
                };
              });
            }}
          >
            Alternative
          </button>
        </div>
      </div>
    );
  }, [room, socket, streamToShowToParticipant]);

  const streamSwitchSettings = useMemo(() => {
    return (
      <div
        style={{ height: appHeight, }}
        className="backdrop"
        onClick={() => {
          setIsStreamSwitchSettingsVisible(prev => !prev);
        }}
      >
        <div
          className={styles.settingsContainer}
          onClick={event => {
            event.stopPropagation();
          }}
        >
          <div style={{ overflow: "auto", width: "60vw", height: "50vh" }} className={styles.settingsStream}>
            <div style={{ display: "flex", gap: "16px 16px", flexWrap: "wrap", justifyContent: "space-evenly", alignContent: "flex-start" }}>
              {Object.values(state.feedStreams)
                .filter(feedStream => feedStream.id.toString() !== id.current?.toString())
                .map(feedStream => switchStreamGroup(feedStream.id, feedStream.display))}
            </div>
          </div>
          <div className={styles.settingsButtons}>
            <button className={styles.settingsButtonSubmit} onClick={() => setIsStreamSwitchSettingsVisible(false)}>OK</button>
          </div>
        </div>
      </div>
    );
  }, [appHeight, state.feedStreams, switchStreamGroup]);

  const chatMessage = useCallback((timestamp: string, fromId: number, fromDisplay: string, data: string) => {
    const isFromMe = fromId === id.current;

    return (
      <div
        key={timestamp + fromDisplay + data}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          maxWidth: "80%",
          alignSelf: isFromMe ? "flex-end" : "flex-start"
        }}
      >
        <div
          style={{
            background: isFromMe ? "rgb(96, 96, 96)" : "rgb(48, 48, 48)",
            borderRadius: isFromMe ? "8px 0px 8px 8px" : "0px 8px 8px 8px",

            display: "flex",
            flexDirection: "column",
            gap: 8,

            padding: 8,
            boxSizing: "border-box",
          }}
        >
          <p style={{ color: "white", fontWeight: 500 }}>{fromDisplay}</p>
          <p style={{ color: "white", fontWeight: 300 }}>{data}</p>
        </div>
        <p style={{ color: "white", fontWeight: 100, fontSize: 12, letterSpacing: "1px", textAlign: isFromMe ? "right" : "left" }}>{Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(timestamp))}</p>
      </div>
    );
  }, []);

  const chatWindow = useMemo(() => {
    return (
      <div
        style={{
          height: "100%",
          width: "25vw",
          background: "var(--black)",
          border: "4px solid rgb(48, 48, 48)",
          borderRadius: 8,
          boxSizing: "border-box",

          display: "flex",
          flexDirection: "column",
          gap: 12,

          padding: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <h1 style={{ color: "white" }}>Chat</h1>
          <div
            className="clickable"
            onClick={() => {
              handleChatToggle();
            }}
          >
            <Icon
              path={mdiClose}
              size={"24px"}
              color="white"
            />
          </div>
        </div>
        <div
          style={{
            overflow: "auto"
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {state.messages.map(message => chatMessage(message.timestamp, message.id, message.display, message.data))}
          </div>
        </div>
        <form
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: "auto"
          }}
          onSubmit={(event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();

            const data = event.currentTarget.datainput.value

            publisherHandle.current?.data({
              text: event.currentTarget.datainput.value,
              error: (reason: any) => {
                alert(reason);
              },
              success: () => {
                dispatch({ type: "add message", id: id.current, data: data })
                event.currentTarget.datainput.value = "";
              },
            });
          }}
        >
          <input
            type="text"
            name="datainput"
            placeholder="Schreibe eine Nachricht..."
            style={{
              flex: 1,
            }}
          />
          <div
            className="clickable"
            style={{
              display: "flex"
            }}
          >
            <Icon
              path={mdiSend}
              size={"32px"}
              color="var(--primary)"
            />
          </div>
        </form>
      </div>
    );
  }, [chatMessage, handleChatToggle, state.messages]);

  const settingsWindow = useMemo(() => {
    return (
      <div
        style={{ height: appHeight, }}
        className="backdrop"
        onClick={() => {
          setIsSettingsVisible(prev => !prev);
        }}
      >
        <div
          className={styles.settingsContainer}
          onClick={event => {
            event.stopPropagation();
          }}
        >
          <div className={styles.settingsStream}>
            <div className={styles.settingsVideoFrame}>
              <VideoElement
                stream={localVideoStreamsSettings && localVideoStreamsSettings[localStreamToShow]}
              />
            </div>
            <div className={styles.settingsOptionsContainer}>
              {hostSecret != null && (
                <div className={styles.hostButtonsSwitchStream}>
                  <button
                    className={`${localStreamToShow === "primary" && styles.hostButtonSelected}`}
                    onClick={() => {
                      setLocalStreamToShow("primary");
                    }}
                  >
                    Standard
                  </button>
                  <button
                    className={`${localStreamToShow === "alternative" && styles.hostButtonSelected}`}
                    onClick={() => {
                      setLocalStreamToShow("alternative");
                    }}
                  >
                    Alternative
                  </button>
                </div>
              )}
              <label className={styles.settingsOptionsGroup}>
                Mikrofon
                <select
                  value={audioInputDeviceId[localStreamToShow]}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                    const value = event.target.value;
                    setAudioInputDeviceId(prev => {
                      return {
                        ...prev,
                        [localStreamToShow]: value,
                      };
                    });

                    const currentAudio = Object.entries(state.localTracks)
                      .filter(([mid, track]) => track.kind === "audio")[localStreamToShow === "primary" ? 0 : 1]

                    if (currentAudio == null) {
                      return;
                    }

                    const currentAudioMid = currentAudio[0];

                    dispatch({ type: "remove local track", track: state.localTracks[parseIntStrict(currentAudioMid)] })

                    const audioTrack: JanusJS.Track = {
                      type: "audio",
                      mid: currentAudioMid,
                      capture: { audio: { deviceId: { exact: value, }, }, },
                    };

                    publisherHandle.current?.replaceTracks({
                      tracks: [
                        audioTrack
                      ],
                      error: err => {
                        console.log("error", err)
                      }
                    })
                  }}
                >
                  {availableDevices != null && (
                    availableDevices
                      .filter(device => device.kind === "audioinput")
                      .map(device => (
                        <option
                          key={device.deviceId}
                          value={device.deviceId}
                        >
                          {device.label}
                        </option>
                      ))
                  )}
                </select>
              </label>
              <label className={styles.settingsOptionsGroup}>
                Kamera
                <select
                  value={videoInputDeviceId[localStreamToShow]}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                    const value = event.target.value;
                    setVideoInputDeviceId(prev => {
                      return {
                        ...prev,
                        [localStreamToShow]: value,
                      };
                    });

                    const currentVideo = Object.entries(state.localTracks)
                      .filter(([mid, track]) => track.kind === "video")[localStreamToShow === "primary" ? 0 : 1]

                    if (currentVideo == null) {
                      return;
                    }

                    const currentVideoMid = currentVideo[0];

                    dispatch({ type: "remove local track", track: state.localTracks[parseIntStrict(currentVideoMid)] })

                    const videoTrack: JanusJS.Track = {
                      type: value === "screen" ? "screen" : "video",
                      mid: currentVideoMid,
                      capture: value === "screen" ? true : { video: { deviceId: { exact: value, }, }, },
                    };

                    publisherHandle.current?.replaceTracks({
                      tracks: [
                        videoTrack
                      ],
                      error: err => {
                        console.log("error", err)
                      }
                    })
                  }}
                >
                  {availableDevices != null && (
                    availableDevices
                      .filter(device => device.kind === "videoinput")
                      .map(device => (
                        <option
                          key={device.deviceId}
                          value={device.deviceId}
                        >
                          {device.label}
                        </option>
                      ))
                  )}
                  <option value="screen">Screenshare</option>
                </select>
              </label>
              <label className={styles.settingsOptionsGroup}>
                Lautsprecher
                <select
                  value={audioOutputDeviceId}
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
                    const value = event.target.value;
                    setAudioOutputDeviceId(value);
                  }}
                >
                  {availableDevices != null && (
                    availableDevices
                      .filter(device => device.kind === "audiooutput")
                      .map(device => (
                        <option
                          key={device.deviceId}
                          value={device.deviceId}
                        >
                          {device.label}
                        </option>
                      ))
                  )}
                </select>
              </label>
            </div>
          </div>
          <div className={styles.settingsButtons}>
            <button className={styles.settingsButtonSubmit} onClick={() => setIsSettingsVisible(false)}>OK</button>
          </div>
        </div>
      </div>
    );
  }, [appHeight, audioInputDeviceId, audioOutputDeviceId, availableDevices, hostSecret, localStreamToShow, localVideoStreamsSettings, state.localTracks, videoInputDeviceId]);

  const remoteParticipants = useMemo(() => {
    return (
      <div
        style={{
          boxSizing: "border-box",
          height: appHeight,
          background: "var(--black)",
          display: "flex",
        }}
      >
        {isChatVisible && chatWindow}
        <div
          style={{
            width: "100%",
            height: "100%",
          }}
        >
          <VideoGrid
            columns={gridColumns}
            rows={gridRows}
          >
            {Object.keys(state.remoteStreams).length === 0 ? (
              isLocalVideoMuted ? (
                <Avatar height={30} userName={userName} />
              ) : (
                <VideoElement
                  stream={localVideoStreams && localVideoStreams[localStreamToShow]}
                  userName={userName}
                />
              )
            ) : (
              remoteElements
            )}
          </VideoGrid>
        </div>

        {roomLocalVideoPreview}

        {roomControls}
      </div>
    );
  }, [appHeight, chatWindow, gridColumns, gridRows, isChatVisible, isLocalVideoMuted, localStreamToShow, localVideoStreams, remoteElements, roomControls, roomLocalVideoPreview, state.remoteStreams, userName]);

  return (
    <Layout>
      {!hasPublisherJoined ? (
        startPage
      ) : (
        remoteParticipants
      )}

      {isStreamSwitchSettingsVisible && streamSwitchSettings}

      {isSettingsVisible && settingsWindow}
    </Layout >
  );
}

export default Room;