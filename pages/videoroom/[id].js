import { useRouter } from "next/router";
import { useEffect, useCallback, useRef, useState, useMemo, useReducer } from "react";

import { Janus } from 'janus-gateway'

import Layout from "../../components/Layout";

const reducer = (state, action) => {
  switch (action.type) {
    case "add feed stream":
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
      const { [action.id]: feedStreamToRemove, ...restFeedStreams } = state.feedStreams;

      return {
        ...state,
        feedStreams: restFeedStreams,
      };
    case "add sub stream":
      return {
        ...state,
        subStreams: {
          ...state.subStreams,
          [action.mid]: action.stream,
        },
      };
    case "remove sub stream":
      return {
        ...state,
      };
    case "add remote track":
      return {
        ...state,
        remoteTracks: {
          ...state.remoteTracks,
          [action.mid]: action.track,
        }
      };
    case "remove remote track":
      const { [action.mid]: trackToRemove, ...restRemoteTracks } = state.remoteTracks;

      trackToRemove.stop();

      return {
        ...state,
        remoteTracks: restRemoteTracks,
      };
    case "add remote stream":
      const feedId = state.subStreams[action.mid].feed_id;
      const remoteTrack = state.remoteTracks[action.mid];

      return {
        ...state,
        remoteStreams: {
          ...state.remoteStreams,
          [feedId]: {
            ...state.remoteStreams[feedId],
            [remoteTrack.kind]: new MediaStream([remoteTrack]),
          }
        },
      };
    case "remove remote stream":
      const { [action.feedId]: remoteStreamToRemove, ...restRemoteStreams } = state.remoteStreams;

      return {
        ...state,
        remoteStreams: restRemoteStreams,
      };
    default:
      throw new Error();
  }
}

const Room = () => {
  const [newPublishers, setNewPublishers] = useState([]);
  const [hasSubscriberJoined, setHasSubscriberJoined] = useState(false);
  const [localTracks, setLocalTracks] = useState([]);
  const [localStream, setLocalStream] = useState(null);

  const [userName, setUserName] = useState("");

  const [state, dispatch] = useReducer(reducer, { feedStreams: {}, subStreams: {}, remoteTracks: {}, remoteStreams: {} });

  const id = useRef(null);
  const privateId = useRef(null);
  const publisherHandle = useRef(null);
  const subscriberHandle = useRef(null);

  const router = useRouter();

  const parseIntStrict = useCallback(value => {
    if (/^(\-|\+)?([0-9]+|Infinity)$/.test(value))
      return Number(value);
    return NaN;
  }, []);

  const unsubscribeFrom = useCallback(id => {
    dispatch({ type: "remove feed stream", id: id });
    dispatch({ type: "remove remote stream", feedId: id });

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

  const isSubscriberJoining = useRef(false);

  useEffect(() => {
    if (roomId && privateId.current && newPublishers.length > 0) {
      if (hasSubscriberJoined) {
        subscriberHandle.current.send({
          message: {
            request: "subscribe",
            streams: newPublishers.map(publisher => ({ feed: publisher.id })),
          }
        })

        setNewPublishers([]);
      } else if (!isSubscriberJoining.current) {
        isSubscriberJoining.current = true;
        subscriberHandle.current.send({
          message: {
            request: "join",
            ptype: "subscriber",
            room: roomId,
            private_id: privateId.current,
            streams: newPublishers.map(publisher => ({ feed: publisher.id })),
          }
        })

        setNewPublishers([]);
      }
    }
  }, [roomId, newPublishers, hasSubscriberJoined]);

  const initJanus = useCallback(displayName => {
    Janus.init({
      debug: false,
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
                console.log("publisher msg, jsep:", msg, jsep)

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

                      dispatch({ type: "add feed stream", id: publisher.id, display: publisher.display, streams: publisher.streams });
                    }
                  }
                } else if (event === "event") {
                  if (msg.streams) {
                    dispatch({ type: "add feed stream", id: id.current, display: displayName, streams: msg.streams });
                  } else if (msg.publishers) {
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

                      dispatch({ type: "add feed stream", id: publisher.id, display: publisher.display, streams: publisher.streams });
                    }
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
                console.log("subscriber msg, jsep:", msg, jsep)

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
                  const remoteTrack = track.clone();

                  dispatch({ type: "add remote track", mid: mid, track: remoteTrack });
                  dispatch({ type: "add remote stream", mid: mid });
                } else {
                  dispatch({ type: "remove remote track", mid: mid });
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

  const remoteElements = useMemo(() => {
    let videoElements = [];
    let audioElements = [];

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
            {remoteElements}
          </>
        )}
      </div>
    </Layout>
  );
}

export default Room;