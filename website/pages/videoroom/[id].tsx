import { useRouter } from "next/router";
import React, { useEffect, useCallback, useRef, useState, useMemo, useReducer, Reducer, ReducerWithoutAction } from "react";

// @ts-ignore
import { Janus } from 'janus-gateway';
import { JanusJS } from "../../janus";
import io, { Socket } from "socket.io-client";

import Layout from "../../components/Layout";
import { Publisher, PublisherStream, SubscriberStream } from "../../interfaces/janus";
import { useSocket } from "../../contexts/SocketProvider";

// let socket: Socket;

interface IReducerState {
  // feedStreams: { [id: number]: Omit<Publisher, "streams"> & { streams: PublisherStream[] & { id: number, display: string }[] } };
  feedStreams: { [id: number]: Publisher & { streams: { id: number; display: string; }[] } };
  subStreams: { [mid: number]: SubscriberStream; };
  localTracks: MediaStreamTrack[];
  localStreams: { [id: string]: MediaStream };
  remoteTracks: { [mid: number]: MediaStreamTrack };
  remoteStreams: { [id: string]: MediaStream };
}

interface IReducerAction {
  type: "add feed stream" | "remove feed stream" | "add sub stream" | "remove sub stream" | "add local track" | "remove local track" | "add local stream" | "remove local stream" | "add remote track" | "remove remote track" | "add remote stream" | "remove remote stream";
  id?: number;
  display?: string;
  streams?: PublisherStream[];
  mid?: number;
  stream?: SubscriberStream;
  track?: MediaStreamTrack;
  feedId?: number;
}

const reducer = (state: IReducerState, action: IReducerAction): IReducerState => {
  switch (action.type) {
    case "add feed stream":
      if (action.id == null || action.display == null || action.streams == null) {
        throw new Error("id, display or streams is missing");
      }

      const id = action.id;
      const display = action.display;
      const streams = action.streams;

      const newFeedStream = {
        id: id,
        display: display,
        streams: streams.map(stream => {
          return {
            ...stream,
            id: id,
            display: display,
          };
        }),
      };

      return {
        ...state,
        feedStreams: {
          ...state.feedStreams,
          [id]: newFeedStream,
        }
      };
    case "remove feed stream":
      if (action.id == null) {
        throw new Error("id is missing");
      }

      const { [action.id]: feedStreamToRemove, ...restFeedStreams } = state.feedStreams;

      return {
        ...state,
        feedStreams: restFeedStreams,
      };
    case "add sub stream":
      if (action.mid == null || action.stream == null) {
        throw new Error("mid and stream is missing");
      }

      return {
        ...state,
        subStreams: {
          ...state.subStreams,
          [action.mid]: action.stream,
        },
      };
    case "remove sub stream":
      // TODO ?
      return {
        ...state,
      };
    case "add local track":
      if (action.track == null) {
        throw new Error("track is missing");
      }

      return {
        ...state,
        localTracks: [
          ...state.localTracks,
          action.track,
        ],
      };
    case "remove local track":
      if (action.track == null) {
        throw new Error("track is missing");
      }

      return {
        ...state,
        localTracks: state.localTracks.filter(track => {
          if (track.id !== action.track!.id) {
            return true;
          } else {
            track.stop();
            return false;
          }
        }),
      };
    case "add local stream":
      if (action.track == null) {
        throw new Error("track is missing");
      }

      return {
        ...state,
        localStreams: {
          ...state.localStreams,
          [action.track.id]: new MediaStream([action.track.clone()]),
        },
      };
    case "remove local stream":
      if (action.track == null) {
        throw new Error("track is missing");
      }

      const { [action.track.id]: localStreamToRemove, ...restLocalStreams } = state.localStreams;

      return {
        ...state,
        localStreams: restLocalStreams,
      };
    case "add remote track":
      if (action.mid == null || action.track == null) {
        throw new Error("mid and track is missing");
      }

      return {
        ...state,
        remoteTracks: {
          ...state.remoteTracks,
          [action.mid]: action.track,
        }
      };
    case "remove remote track":
      if (action.mid == null) {
        throw new Error("mid is missing");
      }

      const { [action.mid]: trackToRemove, ...restRemoteTracks } = state.remoteTracks;

      trackToRemove.stop();

      return {
        ...state,
        remoteTracks: restRemoteTracks,
      };
    case "add remote stream":
      if (action.mid == null) {
        throw new Error("mid is missing");
      }

      // TODO only store relevant stream if feedId is from host -> via socket.io?
      const feedId = state.subStreams[action.mid].feed_id;
      const remoteTrack = state.remoteTracks[action.mid];

      return {
        ...state,
        remoteStreams: {
          ...state.remoteStreams,
          [feedId]: {
            ...state.remoteStreams[feedId],
            [remoteTrack.kind]: new MediaStream([remoteTrack.clone()]),
          },
        },
      };
    case "remove remote stream":
      if (action.feedId == null) {
        throw new Error("feedId is missing");
      }

      const { [action.feedId]: remoteStreamToRemove, ...restRemoteStreams } = state.remoteStreams;

      return {
        ...state,
        remoteStreams: restRemoteStreams,
      };
    default:
      throw new Error("unknown type of dispatch operation");
  }
}

const Room = () => {
  const [newPublishers, setNewPublishers] = useState<Publisher[]>([]);
  const [hasSubscriberJoined, setHasSubscriberJoined] = useState(false);
  const [userName, setUserName] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [waitingSDPs, setWaitingSDPs] = useState<{
    id: string,
    offer: JanusJS.JSEP,
    answer: JanusJS.JSEP | null,
  }[]>([]);
  // const [socket, setSocket] = useState();

  // [
  //   {
  //     offer: jsep,
  //     answer: jsep,
  //   },
  //   {
  //     offer: jsep,
  //     answer: jsep,
  //   }
  // ]

  // Example offer 1
  //
  // v=0
  // o=- 6603908741767771803 2 IN IP4 127.0.0.1           <-- Could be used as an id
  // s=-
  // t=0 0
  // a=group:BUNDLE 0 1                                   <-- Could be used as an id
  // a=extmap-allow-mixed

  // Example offer 2
  //
  // v=0
  // o=- 6603908741767771803 3 IN IP4 127.0.0.1           <-- Could be used as an id
  // s=-
  // t=0 0
  // a=group:BUNDLE 0 1 2 3                               <-- Could be used as an id
  // a=extmap-allow-mixed

  const [state, dispatch] = useReducer(reducer, {
    feedStreams: {},
    subStreams: {},
    localTracks: [],
    localStreams: {},
    remoteTracks: {},
    remoteStreams: {},
  });

  // feedStreams: {
  //   [id: number]: Publisher & {
  //     streams: { id: number, display: string }
  //   };
  // };
  // subStreams: {
  //   [mid: number]: SubscriberStream;
  // };
  // localTracks: MediaStreamTrack[];
  // localStreams: { [id: string]: MediaStream };
  // remoteTracks: { [mid: number]: MediaStreamTrack };
  // remoteStreams: { [id: string]: MediaStream };

  const id = useRef<number>();
  const privateId = useRef<number>();
  const publisherHandle = useRef<JanusJS.PluginHandle>();
  const subscriberHandle = useRef<JanusJS.PluginHandle>();
  const isSubscriberJoining = useRef(false);

  const router = useRouter();
  const socket = useSocket();

  useEffect(() => {
    if (socket == null) {
      return;
    }

    socket.on("connect", () => {
      console.log("connected to socket")
    })

    socket.on("disconnect", reason => {
      if (reason === "io server disconnect") {
        // TODO Not tested yet!
        socket.connect();
      }

      // TODO Necessary to leave here? Or should only leave on page reload / janus disconnect
      socket.emit("leave", id.current);
    })

    socket.on("update-input", msg => {
      console.log(msg)
    })

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("leave");
      socket.off("update-input");
    }
  }, [socket]);

  // useEffect(() => {
  //   const socketInitializer = async () => {
  //     // TODO
  //     // await fetch("/api/socket");
  //     // socket = io(process.env.NODE_ENV === "development" ? "ws://localhost:3000" : "ws://app.fabianbehrendt.de/socket");
  //     // socket = io(process.env.NODE_ENV === "development" ? "ws://localhost:3000" : "wss://app.fabianbehrendt.de", {
  //     //   path: "/socket/socket.io",
  //     // });

  //     socket = io("ws://localhost:3000", {
  //       path: "/socket/socket.io",
  //     });

  //     socket.on("connect", () => {
  //       console.log("connected to socket")
  //     })

  //     socket.on("disconnect", reason => {
  //       if (reason === "io server disconnect") {
  //         // TODO Not tested yet!
  //         socket.connect();
  //       }

  //       // TODO Necessary to leave here? Or should only leave on page reload / janus disconnect
  //       socket.emit("leave", id.current);
  //     })

  //     socket.on("update-input", msg => {
  //       console.log(msg)
  //     })
  //   };

  //   socketInitializer();
  // }, []);

  const handleJsep = useCallback((jsep: JanusJS.JSEP) => {
    const { type, sdp } = jsep;

    if (type == null || sdp == null) {
      return;
    }

    const id = sdp.split("\r")[1].split(" ")[2];

    setWaitingSDPs(prev => {
      if (type === "offer") {
        return [
          ...prev,
          {
            id: id,
            offer: jsep,
            answer: null,
          }
        ];
      }

      for (let i = 0; i < prev.length; i++) {
        if (prev[i].id === id && i === 0) {
          const [firstWaitingSDP, ...restWaitingSDPs] = prev;
          publisherHandle.current?.handleRemoteJsep({ jsep: jsep })

          // ? Handle in useEffect
          // if (restWaitingSDPs.length > 0 && restWaitingSDPs[0].answer != null) {
          //   handleJsep(restWaitingSDPs[0].answer)
          // }
          return restWaitingSDPs;
        } else if (prev[i].id === id) {
          const newWaitingSDPs = [...prev];
          newWaitingSDPs[i].answer = jsep;

          return newWaitingSDPs;
        }
      }

      return prev;
    })
  }, []);

  useEffect(() => {
    if (waitingSDPs.length > 0 && waitingSDPs[0].answer != null) {
      handleJsep(waitingSDPs[0].answer);
    }
  }, [handleJsep, waitingSDPs]);

  const parseIntStrict = useCallback((value: string) => {
    if (/^(\-|\+)?([0-9]+|Infinity)$/.test(value))
      return Number(value);
    return NaN;
  }, []);

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

  const roomId = useMemo(() => {
    if (!router.isReady || typeof router.query.id !== "string")
      return;

    const id = parseIntStrict(router.query.id);

    if (isNaN(id)) {
      // TODO Handle room id not parseable
      console.error("Room ID could not be parsed")
    } else {
      return id;
    }
  }, [router.isReady, router.query, parseIntStrict]);


  useEffect(() => {
    if (roomId && privateId.current && newPublishers.length > 0) {
      if (hasSubscriberJoined) {
        subscriberHandle.current?.send({
          message: {
            request: "subscribe",
            streams: newPublishers.map(publisher => ({ feed: publisher.id, mid: "0" }))
              .concat(newPublishers.map(publisher => ({ feed: publisher.id, mid: "1" }))),
          }
        })

        setNewPublishers([]);
      } else if (!isSubscriberJoining.current) {
        isSubscriberJoining.current = true;
        subscriberHandle.current?.send({
          message: {
            request: "join",
            ptype: "subscriber",
            room: roomId,
            private_id: privateId.current,
            streams: newPublishers.map(publisher => ({ feed: publisher.id, mid: "0" }))
              .concat(newPublishers.map(publisher => ({ feed: publisher.id, mid: "1" }))),
          }
        })

        setNewPublishers([]);
      }
    }
  }, [roomId, newPublishers, hasSubscriberJoined]);

  const availableDevices = useRef<MediaDeviceInfo[]>();

  useEffect(() => {
    window.onbeforeunload = () => {
      if (socket?.connected) {
        socket.emit("leave", id.current);
      }
    }

    return () => {
      window.onbeforeunload = () => { };
    }
  }, [socket])

  const initJanus = useCallback((displayName: string, isUserHost: boolean) => {
    Janus.init({
      debug: false,
      callback: () => {
        Janus.listDevices((devices: MediaDeviceInfo[]) => {
          // console.log("available devices:", devices.filter(device => device.kind === "videoinput"));
          // console.log("video id", devices.filter(device => device.kind === "videoinput")[0].deviceId)

          availableDevices.current = devices;

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
                      request: "join",
                      ptype: "publisher",
                      room: roomId,
                      display: displayName,
                    },
                  })
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

                    if (socket?.connected) {
                      socket.emit("join", id.current, isUserHost);
                    }

                    publisherHandle.current?.createOffer({
                      media: {
                        video: {
                          deviceId: devices.filter(device => device.kind === "videoinput")[0].deviceId,
                          width: 192,
                          height: 144,
                        },
                        audio: true,
                      },
                      success: (jsep: JanusJS.JSEP) => {
                        // console.log("### JSEP ###", jsep.type, jsep.sdp)

                        handleJsep(jsep);
                        publisherHandle.current?.send({
                          message: {
                            request: "publish",
                          },
                          jsep: jsep,
                        })
                      },
                      error: error => {
                        // TODO Handle error
                      },
                      customizeSdp: jsep => {
                        // TODO Modify original sdp if needed
                      }
                    })

                    // publisherHandle.current.createOffer({
                    //   media: {
                    //     video: {
                    //       deviceId: devices.filter(device => device.kind === "videoinput")[0].deviceId,
                    //       width: 192,
                    //       height: 144,
                    //     },
                    //     audio: true,
                    //   },
                    //   success: jsep => {
                    //     // console.log("### JSEP ###", jsep.type, jsep.sdp)
                    //     console.log(jsep.sdp.split("\r")[1].split(" ")[2])
                    //     handleJsep(jsep);
                    //     publisherHandle.current.send({
                    //       message: {
                    //         request: "publish",
                    //       },
                    //       jsep: jsep,
                    //     })
                    //   },
                    //   error: error => {
                    //     // TODO Handle error
                    //   },
                    //   customizeSdp: jsep => {
                    //     // TODO Modify original sdp if needed
                    //   }
                    // })

                    // publisherHandle.current.createOffer({
                    //   media: {
                    //     video: {
                    //       deviceId: devices.filter(device => device.kind === "videoinput")[0].deviceId,
                    //       width: 192,
                    //       height: 144,
                    //     },
                    //     audio: true,
                    //   },
                    //   success: jsep => {
                    //     // console.log("### JSEP ###", jsep.type, jsep.sdp)
                    //     console.log(jsep.sdp.split("\r")[1].split(" ")[2])
                    //     handleJsep(jsep);
                    //     publisherHandle.current.send({
                    //       message: {
                    //         request: "publish",
                    //       },
                    //       jsep: jsep,
                    //     })
                    //   },
                    //   error: error => {
                    //     // TODO Handle error
                    //   },
                    //   customizeSdp: jsep => {
                    //     // TODO Modify original sdp if needed
                    //   }
                    // })

                    if (isUserHost) {
                      publisherHandle.current?.createOffer({
                        media: {
                          video: {
                            deviceId: devices.filter(device => device.kind === "videoinput")[1].deviceId,
                            width: 192,
                            height: 144,
                          },
                          audio: true,
                        },
                        success: (jsep: JanusJS.JSEP) => {
                          // console.log("### JSEP ###", jsep.type, jsep.sdp)

                          handleJsep(jsep)
                          publisherHandle.current?.send({
                            message: {
                              request: "publish",
                            },
                            jsep: jsep,
                          })
                        },
                        error: error => {
                          // TODO Handle error
                        },
                        customizeSdp: (jsep: JanusJS.JSEP) => {
                          // TODO Modify original sdp if needed
                        }
                      })
                    }

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
                      }
                    }
                  } else if (event === "event") {
                    if (msg.streams) {
                      dispatch({ type: "add feed stream", id: id.current, display: displayName, streams: msg.streams });
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
                      }
                    } else if (msg.leaving) {
                      unsubscribeFrom(msg.leaving);
                    } else if (msg.unpublished) {
                      if (msg.unpublished === "ok") {
                        // That's us
                        if (socket?.connected) {
                          socket.emit("leave", id.current);
                        }

                        publisherHandle.current?.hangup();
                        return;
                      }
                      unsubscribeFrom(msg.unpublished);
                    }
                  }

                  // TODO message / event received
                  // TODO if jsep not null, WebRTC negotiation
                  if (jsep) {
                    // console.log("### handle remote JSEP ###", jsep.type, jsep.sdp)
                    handleJsep(jsep)
                    // publisherHandle.current.handleRemoteJsep({ jsep: jsep })
                  }
                },
                onlocaltrack: (track, added) => {
                  // TODO local track has been added or removed
                  // setLocalTracks(prev => [...prev, track]);
                  if (added) {
                    // console.log("local track added", track)
                    dispatch({ type: "add local track", track: track });
                    dispatch({ type: "add local stream", track: track });
                  } else {
                    // console.log("local track removed", track)
                    dispatch({ type: "remove local track", track: track });
                    dispatch({ type: "remove local stream", track: track });
                  }
                },
                onremotetrack: (track, mid, added) => {
                  // nothing to expect here
                },
                oncleanup: () => {
                  // TODO clean UI
                },
                detached: () => {
                  // TODO connection closed
                },
              } as JanusJS.PluginOptions)

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
                      success: (ourjsep: JanusJS.JSEP) => {
                        subscriberHandle.current?.send({
                          message: {
                            request: "start"
                          },
                          jsep: ourjsep
                        });
                      },
                      error: function (error: any) {
                        // An error occurred...
                      }
                    });
                  }
                },
                onlocaltrack: (track, added) => {
                  // TODO local track has been added or removed
                },
                onremotetrack: (track, mid, added) => {
                  // TODO on description change, maybe update existing mid instead of creating a new one ???

                  console.log("remote track", track, mid, added)
                  // TODO remote track with specific mid has been added or removed
                  if (added) {
                    // console.log("remote track received:", track, mid)

                    dispatch({ type: "add remote track", mid: mid, track: track });
                    dispatch({ type: "add remote stream", mid: mid });
                  } else {
                    dispatch({ type: "remove remote track", mid: mid });
                  }
                },
              } as JanusJS.PluginOptions)
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
  }, [handleJsep, roomId, unsubscribeFrom, socket]);

  const localVideos = useMemo(() => {
    let videos: JSX.Element[] = [];

    for (const [id, stream] of Object.entries(state.localStreams)) {
      const kind = stream.getTracks()[0].kind;

      if (kind === "video") {
        videos = [...videos, (
          <div
            key={stream.id}
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}
          >
            <video
              autoPlay
              playsInline
              muted
              style={{ border: "1px solid black" }}
              width={192}
              height={144}
              ref={ref => {
                if (ref)
                  ref.srcObject = stream;
              }}
            />
            {isHost && (
              <select>
                {Object.values(state.feedStreams).map(feedStream => {
                  return (
                    <option key={feedStream.id}>
                      {feedStream.display}
                    </option>
                  )
                })}
              </select>
            )}
          </div>
        )]
      }
    }

    return videos;
  }, [isHost, state.feedStreams, state.localStreams]);

  const remoteElements = useMemo(() => {
    let videoElements: JSX.Element[] = [];
    let audioElements: JSX.Element[] = [];

    // console.log("remote streams:", state.remoteStreams)

    for (const [feedId, streams] of Object.entries(state.remoteStreams)) {
      for (const [type, stream] of Object.entries(streams)) {
        if (type === "audio") {
          audioElements = [
            ...audioElements,
            <audio
              key={stream.id}
              autoPlay
              hidden
              playsInline
              ref={ref => {
                if (ref) {
                  ref.srcObject = stream;
                }
              }}
            />
          ];
        } else if (type === "video") {
          videoElements = [
            ...videoElements,
            <video
              key={stream.id}
              autoPlay
              playsInline
              style={{ border: "1px solid black" }}
              width={320}
              height={240}
              ref={ref => {
                if (ref) {
                  ref.srcObject = stream;
                }
              }}
            />
          ]
        }
      }
    }

    return (
      <div style={{ display: "flex" }}>
        {videoElements}
        {audioElements}
      </div>
    );
  }, [state.remoteStreams])

  const [currentMid, setCurrentMid] = useState(0);

  return (
    <Layout>
      <h1 style={{ textAlign: "center" }}>Room {roomId}</h1>
      {/* <button
        onClick={() => {
          console.log(availableDevices.current.filter(device => device.kind === "videoinput")[1])
          // TODO ???

          publisherHandle.current.createOffer({
            media: {
              video: {
                deviceId: availableDevices.current.filter(device => device.kind === "videoinput")[1].deviceId,
                width: 192,
                height: 144,
              }
            },
            success: jsep => {
              console.log("### added ###")
              publisherHandle.current.send({
                message: {
                  request: "publish",
                },
                jsep: jsep,
              })
            },
            error: error => {
              // TODO Handle error
            },
            customizeSdp: jsep => {
              // TODO Modify original sdp if needed
            }
          })
        }}
      >Connect 2nd Stream</button> */}
      <button
        onClick={() => {
          if (id.current == null) {
            return;
          }

          const { [id.current]: bla, ...rest } = state.feedStreams;
          console.log(Object.keys(rest)[0])

          subscriberHandle.current?.send({
            message: {
              request: "switch",
              streams: [
                {
                  feed: parseInt(Object.keys(rest)[0]),
                  mid: ((currentMid * 2 + 2) % 4).toString(), // "2"
                  sub_mid: "0"
                },
                /*
                  0 -> 2, 3
                  1 -> 0, 1
                */
                {
                  feed: parseInt(Object.keys(rest)[0]),
                  mid: ((currentMid * 2 + 3) % 4).toString(), // "3"
                  sub_mid: "1"
                }
              ]
            }
          })

          setCurrentMid(prev => (prev + 1) % 2)
        }}
      >
        Switch
      </button>
      <button
        onClick={() => {
          if (socket?.connected) {
            socket.emit("input-change")
          }
        }}
      >
        Test Socket
      </button>
      {/* <form
        onSubmit={(event) => {
          event.preventDefault();

          publisherHandle.current?.send({
            message: {
              request: "configure",
              // mid: event.target.mid.value.toString(),
              // streams: [
              //   {
              //     mid: event.target.mid.value.toString(),
              //     keyframe: false,
              //   },
              // ],
              descriptions: [
                {
                  mid: event.target.mid.value.toString(),
                  description: event.target.desc.value.toString(),
                },
                // {
                //   mid: (parseInt(event.target.mid.value) * 2 + 1).toString(),
                //   description: event.target.desc.value.toString(),
                // },
              ],
            }
          });
        }}
      >
        <label>
          Mid:
          <input id="mid" />
        </label>
        <label>
          Description:
          <input id="desc" />
        </label>
        <button>Submit</button>
      </form> */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
        <form
          onSubmit={async event => {
            event.preventDefault();

            const isHostValue = event.currentTarget.host.checked;
            setIsHost(isHostValue);

            const usernameValue = event.currentTarget.username.value;
            setUserName(usernameValue);

            initJanus(usernameValue, isHostValue);
          }}
        >
          <input
            id="username"
            type="text"
            disabled={userName.length > 0}
          />
          <button
            type="submit"
            disabled={userName.length > 0}
          >
            Submit
          </button>
          <label>
            <input
              id="host"
              type="checkbox"
              disabled={userName.length > 0}
            />
            Host
          </label>
        </form>
        {userName && (
          <>
            <div style={{ display: "flex" }}>
              {localVideos}
            </div>
            {remoteElements}
          </>
        )}
      </div>
    </Layout>
  );
}

export default Room;