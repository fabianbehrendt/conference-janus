import { useRouter } from "next/router";
import { useEffect, useCallback, useRef, useState, useMemo } from "react";

import { Janus } from 'janus-gateway'

import Layout from "../../components/Layout";

const Room = () => {
  const [isJanusInitialized, setIsJanusInitialized] = useState(false);
  const [newPublishers, setNewPublishers] = useState([]);
  const [hasSubscriberJoined, setHasSubscriberJoined] = useState(false);
  const [remoteVideoStreams, setRemoteVideoStreams] = useState({});
  const [remoteAudioStreams, setRemoteAudioStreams] = useState({});
  const [localTracks, setLocalTracks] = useState([]);
  const [localStream, setLocalStream] = useState(null);

  // ! NEW STUFF, USE THIS
  const [feedStreams, setFeedStreams] = useState({});
  const [subStreams, setSubStreams] = useState({});
  const [userName, setUserName] = useState("");
  const [streamsToStop, setStreamsToStop] = useState([]);
  const [remoteTracks, setRemoteTracks] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});

  const id = useRef(null);
  const privateId = useRef(null);
  const publisherHandle = useRef(null);
  const subscriberHandle = useRef(null);

  const router = useRouter();

  useEffect(() => {
    console.log("feed streams:", feedStreams);
  }, [feedStreams]);

  useEffect(() => {
    console.log("sub streams:", subStreams);
  }, [subStreams]);

  // useEffect(() => {
  //   console.log("streams:", remoteStreams);
  // }, [remoteStreams]);

  // useEffect(() => {
  //   console.log("tracks:", remoteTracks);
  // }, [remoteTracks]);

  useEffect(() => {
    for (const mid of Object.keys(remoteTracks)) {
      // ! Continue here
      // Set remoteStreams here
      const feedId = subStreams[mid].feed_id;
      const track = remoteTracks[mid];

      if (feedId) {
        // TODO set state outside of loop
        setRemoteStreams(prev => {
          const stream = prev[feedId];

          if (!stream) {
            stream = {}
          }

          // stream.video = track.kind === "video" ? track : stream.video;
          // stream.audio = track.kind === "audio" ? track : stream.audio;

          stream[track.kind] = new MediaStream([track]);

          return {
            ...prev,
            [feedId]: stream,
          };
        });
      } else {
        setRemoteTracks(prev => {
          const { [mid]: _, ...rest } = prev;
          return rest;
        })
      }
    }
  }, [remoteTracks, subStreams]);

  useEffect(() => {
    if (streamsToStop.length > 0) {
      for (const stream of streamsToStop) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }

      setStreamsToStop([]);
    }
  }, [streamsToStop]);

  const parseIntStrict = useCallback(value => {
    if (/^(\-|\+)?([0-9]+|Infinity)$/.test(value))
      return Number(value);
    return NaN;
  }, []);

  const unsubscribeFrom = useCallback(id => {
    setFeedStreams(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });

    setRemoteStreams(prev => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });

    subscriberHandle.current.send({
      message: {
        request: "unsubsribe",
        streams: [{ feed: id }],
      },
    });
  }, []);

  const roomId = useMemo(() => {
    if (!router.isReady)
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
    if (localTracks.length == 2) {
      setLocalStream(new MediaStream(localTracks));
    }
  }, [localTracks]);

  useEffect(() => {
    if (roomId && privateId.current && newPublishers.length > 0) {
      // TODO Find a way to resend stream if race condition in "hasSubscriberJoined"

      if (hasSubscriberJoined) {
        subscriberHandle.current.send({
          message: {
            request: "subscribe",
            streams: newPublishers.map(publisher => ({ feed: publisher.id })),
          }
        })
      } else {
        subscriberHandle.current.send({
          message: {
            request: "join",
            ptype: "subscriber",
            room: roomId,
            private_id: privateId.current,
            streams: newPublishers.map(publisher => ({ feed: publisher.id })),
          }
        })
      }

      setNewPublishers([]);
    }
  }, [roomId, newPublishers, hasSubscriberJoined]);

  const initJanus = useCallback(displayName => {
    Janus.init({
      debug: true,
      callback: () => {
        const opaqueId = `videoroom-${Janus.randomString(12)}`;

        const janus = new Janus({
          server: "wss://fabianbehrendt.me/server",
          success: () => {
            janus.attach({
              plugin: "janus.plugin.videoroom",
              opaqueId: opaqueId,
              success: pluginHandle => {
                // TODO successfully attached
                // console.log("attached to plugin echotest")
                publisherHandle.current = pluginHandle;
                publisherHandle.current.send({
                  message: {
                    request: "join",
                    ptype: "publisher",
                    room: roomId,
                    display: displayName,
                  }
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
                // console.log("msg, jsep:", msg, jsep)

                const event = msg.videoroom;

                if (event === "joined") {
                  id.current = msg.id;
                  privateId.current = msg.private_id;

                  publisherHandle.current.createOffer({
                    success: jsep => {
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

                  if (msg.publishers) {
                    setNewPublishers(prev => [...prev, ...msg.publishers]);

                    let newFeedStreams = {};

                    for (const publisher of msg.publishers) {
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
                    }

                    setFeedStreams(prev => ({ ...prev, ...newFeedStreams }));
                  }
                } else if (event === "event") {
                  if (msg.streams) {
                    setFeedStreams(prev => {
                      const streams = msg.streams;

                      return {
                        ...prev,
                        [id.current]: {
                          id: id.current,
                          display: displayName,
                          streams: {
                            ...streams,
                            id: id.current,
                            display: displayName,
                          },
                        },
                      };
                    });
                  } else if (msg.publishers) {
                    // console.log("### subscribe msg ###", msg, jsep)
                    setNewPublishers(prev => [...prev, ...msg.publishers]);

                    let newFeedStreams = {};

                    for (const publisher of msg.publishers) {
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
                    }

                    setFeedStreams(prev => ({ ...prev, ...newFeedStreams, }));
                  } else if (msg.leaving) {
                    unsubscribeFrom(msg.leaving);
                  } else if (msg.unpublished) {
                    if (msg.unpublished === "ok") {
                      // That's us
                      publisherHandle.current.hangup();
                      return;
                    }
                    unsubscribeFrom(msg.unpublished);
                  }
                }

                // TODO message / event received
                // TODO if jsep not null, WebRTC negotiation
                if (jsep) {
                  publisherHandle.current.handleRemoteJsep({ jsep: jsep })
                }
              },
              onlocaltrack: (track, added) => {
                // TODO local track has been added or removed
                // console.log("local:", track, added)
                setLocalTracks(prev => [...prev, track])
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
            })

            janus.attach({
              plugin: "janus.plugin.videoroom",
              opaqueId: opaqueId,
              success: pluginHandle => {
                subscriberHandle.current = pluginHandle
              },
              error: cause => {
                // TODO error
              },
              onmessage: (msg, jsep) => {
                // console.log("subscriber msg, jsep:", msg, jsep)

                const event = msg.videoroom;

                if (msg.error) {
                  // TODO handle error
                } else if (event === "attached") {
                  setHasSubscriberJoined(true);
                } else if (event === "event") {
                  // TODO simulcast related stuff
                }

                if (msg.streams) {
                  let newSubStreams = {};

                  for (const stream of msg.streams) {
                    const mid = stream.mid;

                    newSubStreams = {
                      ...newSubStreams,
                      [mid]: stream,
                    };
                  }

                  setSubStreams(prev => ({ ...prev, ...newSubStreams, }));
                }

                if (jsep) {
                  subscriberHandle.current.createAnswer({
                    // We attach the remote OFFER
                    jsep: jsep,
                    success: ourjsep => {
                      subscriberHandle.current.send({
                        message: {
                          request: "start"
                        },
                        jsep: ourjsep
                      });
                    },
                    error: function (error) {
                      // An error occurred...
                    }
                  });
                }
              },
              onlocaltrack: (track, added) => {
                // TODO local track has been added or removed
              },
              onremotetrack: (track, mid, added) => {
                // TODO remote track with specific mid has been added or removed
                if (added) {
                  // console.log("remote track received:", track, mid, added)
                  if (track.kind === "audio") {
                    setRemoteAudioStreams(prev => {
                      return {
                        ...prev,
                        [mid]: new MediaStream([track.clone()]),
                      }
                    });
                  } else {
                    setRemoteVideoStreams(prev => {
                      return {
                        ...prev,
                        [mid]: new MediaStream([track.clone()]),
                      }
                    });
                  }

                  const remoteTrack = track.clone();

                  setRemoteTracks(prev => {
                    return {
                      ...prev,
                      [mid]: remoteTrack,
                    };
                  });
                } else {
                  // console.log("remote track removed:", track, mid, added)
                  // TODO remove video element
                  if (track.kind === "audio") {
                    setRemoteAudioStreams(prev => {
                      const { [mid]: streamToStop, ...rest } = prev;
                      setStreamsToStop(prev => prev.includes(streamToStop) ? prev : [...prev, streamToStop]);
                      return rest;
                    });
                  } else {
                    setRemoteVideoStreams(prev => {
                      const { [mid]: streamToStop, ...rest } = prev;
                      setStreamsToStop(prev => prev.includes(streamToStop) ? prev : [...prev, streamToStop]);
                      return rest;
                    });
                  }
                }
              },
            })
          },
          error: cause => {
            // TODO Janus server object couldn't be initialized
            // console.log(cause)
          },
          destroyed: () => {
            // TODO Janus server object has been destroyed
            // console.log("destroyed")
          }
        })
      }
    })
  }, [roomId, unsubscribeFrom]);

  // useEffect(() => {
  //   Janus.init({
  //     debug: true,
  //     callback: () => {
  //       setIsJanusInitialized(true);
  //     }
  //   })
  // }, []);

  // useEffect(() => {
  //   if (!isJanusInitialized || !roomId || !userName)
  //     return

  //   // Janus.listDevices(devices => {
  //   //   console.log("available devices:", devices)
  //   // })

  //   const opaqueId = `videoroom-${Janus.randomString(12)}`;

  //   const janus = new Janus({
  //     server: "wss://fabianbehrendt.me/server",
  //     success: () => {
  //       janus.attach({
  //         plugin: "janus.plugin.videoroom",
  //         opaqueId: opaqueId,
  //         success: pluginHandle => {
  //           // TODO successfully attached
  //           // console.log("attached to plugin echotest")
  //           publisherHandle.current = pluginHandle;
  //           publisherHandle.current.send({
  //             message: {
  //               request: "join",
  //               ptype: "publisher",
  //               room: roomId,
  //               display: userName,
  //             }
  //           })
  //         },
  //         error: cause => {
  //           // TODO error
  //         },
  //         consentDialog: on => {
  //           // TODO e.g. darken the screen if on === true (getUserMedia incoming)
  //           // console.log("consent | on:", on)
  //         },
  //         onmessage: (msg, jsep) => {
  //           // console.log("msg, jsep:", msg, jsep)

  //           const event = msg.videoroom;

  //           if (event === "joined") {
  //             id.current = msg.id;
  //             privateId.current = msg.private_id;

  //             publisherHandle.current.createOffer({
  //               success: jsep => {
  //                 publisherHandle.current.send({
  //                   message: {
  //                     request: "publish",
  //                   },
  //                   jsep: jsep,
  //                 })
  //               },
  //               error: error => {
  //                 // TODO Handle error
  //               },
  //               customizeSdp: jsep => {
  //                 // TODO Modify original sdp if needed
  //               }
  //             })

  //             if (msg.publishers) {
  //               setNewPublishers(prev => [...prev, ...msg.publishers]);

  //               let newFeedStreams = {};

  //               for (const publisher of msg.publishers) {
  //                 const id = publisher.id;
  //                 const display = publisher.display;
  //                 const streams = publisher.streams;

  //                 newFeedStreams = {
  //                   ...newFeedStreams,
  //                   [id]: {
  //                     id: id,
  //                     display: display,
  //                     streams: streams.map(stream => {
  //                       return {
  //                         ...stream,
  //                         id: id,
  //                         display: display,
  //                       }
  //                     }),
  //                   },
  //                 };
  //               }

  //               setFeedStreams(prev => ({ ...prev, ...newFeedStreams }));
  //             }
  //           } else if (event === "event") {
  //             if (msg.streams) {
  //               setFeedStreams(prev => {
  //                 const streams = msg.streams;

  //                 return {
  //                   ...prev,
  //                   [id.current]: {
  //                     id: id.current,
  //                     display: userName,
  //                     streams: {
  //                       ...streams,
  //                       id: id.current,
  //                       display: userName,
  //                     },
  //                   },
  //                 };
  //               });
  //             } else if (msg.publishers) {
  //               // console.log("### subscribe msg ###", msg, jsep)
  //               setNewPublishers(prev => [...prev, ...msg.publishers]);

  //               let newFeedStreams = {};

  //               for (const publisher of msg.publishers) {
  //                 const id = publisher.id;
  //                 const display = publisher.display;
  //                 const streams = publisher.streams;

  //                 newFeedStreams = {
  //                   ...newFeedStreams,
  //                   [id]: {
  //                     id: id,
  //                     display: display,
  //                     streams: streams.map(stream => {
  //                       return {
  //                         ...stream,
  //                         id: id,
  //                         display: display,
  //                       }
  //                     }),
  //                   },
  //                 };
  //               }

  //               setFeedStreams(prev => ({ ...prev, ...newFeedStreams, }));
  //             } else if (msg.leaving) {
  //               unsubscribeFrom(msg.leaving);
  //             } else if (msg.unpublished) {
  //               if (msg.unpublished === "ok") {
  //                 // That's us
  //                 publisherHandle.current.hangup();
  //                 return;
  //               }
  //               unsubscribeFrom(msg.unpublished);
  //             }
  //           }

  //           // TODO message / event received
  //           // TODO if jsep not null, WebRTC negotiation
  //           if (jsep) {
  //             publisherHandle.current.handleRemoteJsep({ jsep: jsep })
  //           }
  //         },
  //         onlocaltrack: (track, added) => {
  //           // TODO local track has been added or removed
  //           // console.log("local:", track, added)
  //           setLocalTracks(prev => [...prev, track])
  //         },
  //         onremotetrack: (track, mid, added) => {
  //           // nothing to expect here
  //         },
  //         oncleanup: () => {
  //           // TODO clean UI
  //         },
  //         detached: () => {
  //           // TODO connection closed
  //         },
  //       })

  //       janus.attach({
  //         plugin: "janus.plugin.videoroom",
  //         opaqueId: opaqueId,
  //         success: pluginHandle => {
  //           subscriberHandle.current = pluginHandle
  //         },
  //         error: cause => {
  //           // TODO error
  //         },
  //         onmessage: (msg, jsep) => {
  //           // console.log("subscriber msg, jsep:", msg, jsep)

  //           const event = msg.videoroom;

  //           if (msg.error) {
  //             // TODO handle error
  //           } else if (event === "attached") {
  //             setHasSubscriberJoined(true);
  //           } else if (event === "event") {
  //             // TODO simulcast related stuff
  //           }

  //           if (msg.streams) {
  //             let newSubStreams = {};

  //             for (const stream of msg.streams) {
  //               const mid = stream.mid;

  //               newSubStreams = {
  //                 ...newSubStreams,
  //                 [mid]: stream,
  //               };
  //             }

  //             setSubStreams(prev => ({ ...prev, ...newSubStreams, }));
  //           }

  //           if (jsep) {
  //             subscriberHandle.current.createAnswer({
  //               // We attach the remote OFFER
  //               jsep: jsep,
  //               success: ourjsep => {
  //                 subscriberHandle.current.send({
  //                   message: {
  //                     request: "start"
  //                   },
  //                   jsep: ourjsep
  //                 });
  //               },
  //               error: function (error) {
  //                 // An error occurred...
  //               }
  //             });
  //           }
  //         },
  //         onlocaltrack: (track, added) => {
  //           // TODO local track has been added or removed
  //         },
  //         onremotetrack: (track, mid, added) => {
  //           // TODO remote track with specific mid has been added or removed
  //           if (added) {
  //             // console.log("remote track received:", track, mid, added)
  //             if (track.kind === "audio") {
  //               setRemoteAudioStreams(prev => {
  //                 return {
  //                   ...prev,
  //                   [mid]: new MediaStream([track.clone()]),
  //                 }
  //               });
  //             } else {
  //               setRemoteVideoStreams(prev => {
  //                 return {
  //                   ...prev,
  //                   [mid]: new MediaStream([track.clone()]),
  //                 }
  //               });
  //             }

  //             const remoteTrack = track.clone();

  //             setRemoteTracks(prev => {
  //               return {
  //                 ...prev,
  //                 [mid]: remoteTrack,
  //               };
  //             });
  //           } else {
  //             // console.log("remote track removed:", track, mid, added)
  //             // TODO remove video element
  //             if (track.kind === "audio") {
  //               setRemoteAudioStreams(prev => {
  //                 const { [mid]: streamToStop, ...rest } = prev;
  //                 setStreamsToStop(prev => prev.includes(streamToStop) ? prev : [...prev, streamToStop]);
  //                 return rest;
  //               });
  //             } else {
  //               setRemoteVideoStreams(prev => {
  //                 const { [mid]: streamToStop, ...rest } = prev;
  //                 setStreamsToStop(prev => prev.includes(streamToStop) ? prev : [...prev, streamToStop]);
  //                 return rest;
  //               });
  //             }
  //           }
  //         },
  //       })
  //     },
  //     error: cause => {
  //       // TODO Janus server object couldn't be initialized
  //       // console.log(cause)
  //     },
  //     destroyed: () => {
  //       // TODO Janus server object has been destroyed
  //       // console.log("destroyed")
  //     }
  //   })
  // }, [isJanusInitialized, roomId, unsubscribeFrom, userName])

  const localVideo = useMemo(() => {
    return (
      <video
        autoPlay
        playsInline
        muted
        style={{ border: "1px solid black" }}
        width={192}
        height={144}
        ref={ref => {
          if (ref)
            ref.srcObject = localStream;
        }}
      />
    );
  }, [localStream]);

  const remoteAudioElements = useMemo(() => {
    let elements = [];

    for (const stream of Object.values(remoteAudioStreams)) {
      elements = [
        ...elements,
        <audio
          key={stream.id}
          autoPlay
          hidden
          playsInline
          ref={ref => {
            if (ref)
              ref.srcObject = stream
          }}
        />
      ]
    }

    return elements;
  }, [remoteAudioStreams]);

  const remoteVideoElements = useMemo(() => {
    let elements = [];

    for (const stream of Object.values(remoteVideoStreams)) {
      elements = [
        ...elements,
        <video
          key={stream.id}
          autoPlay
          playsInline
          style={{ border: "1px solid black" }}
          width={320}
          height={240}
          ref={ref => {
            if (ref)
              ref.srcObject = stream;
          }}
        />
      ]
    }

    return elements;
  }, [remoteVideoStreams]);

  return (
    <Layout>
      <h1 style={{ textAlign: "center" }}>Room {roomId}</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
        <form
          onSubmit={event => {
            event.preventDefault();
            const usernameValue = event.currentTarget.username.value;
            setUserName(usernameValue);
            initJanus(usernameValue);
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
        </form>
        {userName && (
          <>
            {localVideo}
            <div style={{ display: "flex" }}>
              {remoteVideoElements}
            </div>
            {remoteAudioElements}
          </>
        )}
      </div>
    </Layout>
  );
}

export default Room;