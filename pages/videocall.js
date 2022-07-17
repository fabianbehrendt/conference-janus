import { useState, useEffect, useRef } from "react"

import { Janus } from "janus-gateway"

import Layout from "../components/Layout"

const VideoCall = () => {
  const [isJanusInitialized, setIsJanusInitialized] = useState(false);
  const [localTracks, setLocalTracks] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteTracks, setRemoteTracks] = useState([]);
  const [remoteStream, setRemoteStream] = useState(null);

  const [username, setUsername] = useState("");
  const [remoteUser, setRemoteUser] = useState("");
  const [remoteSdp, setRemoteSdp] = useState(null);

  const pluginRef = useRef(null);

  useEffect(() => {
    if (localTracks.length == 2) {
      setLocalStream(new MediaStream(localTracks));
    }
  }, [localTracks]);

  useEffect(() => {
    if (remoteTracks.length == 2) {
      setRemoteStream(new MediaStream(remoteTracks));
    }
  }, [remoteTracks])

  useEffect(() => {
    Janus.init({
      debug: false,
      callback: () => {
        setIsJanusInitialized(true);
      }
    })
  }, []);

  useEffect(() => {
    if (!isJanusInitialized)
      return

    // let plugin = null;

    const janus = new Janus({
      server: "wss://janus.fabianbehrendt.de",
      success: () => {
        janus.attach({
          plugin: "janus.plugin.videocall",
          success: pluginHandle => {
            // TODO successfully attached
            console.log("attached to plugin videocall")
            // plugin = pluginHandle;
            pluginRef.current = pluginHandle;
            // const body = {
            //   audio: true,
            //   video: true
            // };
            // pluginRef.current.send({ request: "register", username: "Fabian" })
            // pluginRef.current.send({
            //   message: {
            //     request: "register",
            //     username: "Fabian"
            //   }
            // })
            // plugin.createOffer({
            //   success: jsep => {
            //     plugin.send({ message: body, jsep: jsep })
            //   },
            //   error: error => {
            //     // TODO Handle error
            //   },
            //   customizeSdp: jsep => {
            //     // TODO Modify original sdp if needed
            //   }
            // })
          },
          error: cause => {
            // TODO error
            console.error(cause)
          },
          consentDialog: on => {
            // TODO e.g. darken the screen if on === true (getUserMedia incoming)
          },
          onmessage: (msg, jsep) => {
            // TODO message / event received
            // TODO if jsep not null, WebRTC negotiation
            console.log("msg, jsep:", msg, jsep)
            if (jsep !== undefined && jsep !== null) {
              pluginRef.current.handleRemoteJsep({ jsep: jsep })
            }

            if (msg.result?.event === "incomingcall") {
              console.log("INCOMING CALL from", msg.result.username)
              setRemoteUser(msg.result.username);
              setRemoteSdp(jsep)
            }
          },
          onlocaltrack: (track, added) => {
            // TODO local track has been added or removed
            console.log("local:", track, added)
            setLocalTracks(prev => [...prev, track])
          },
          onremotetrack: (track, mid, added) => {
            // TODO remote track with specific mid has been added or removed
            // console.log("remote:", track, mid, added)
            setRemoteTracks(prev => {
              if (prev.includes(track))
                return prev
              else
                return [...prev, track]
            })
          },
          oncleanup: () => {
            // TODO clean UI
          },
          detached: () => {
            // TODO connection closed
          }
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
  }, [isJanusInitialized])

  return (
    <Layout>
      <div>
        <video
          autoPlay
          style={{ border: "1px solid black" }}
          ref={ref => {
            if (ref)
              ref.srcObject = localStream;
          }}
        />
        <video
          autoPlay
          style={{ border: "1px solid black" }}
          ref={ref => {
            if (ref)
              ref.srcObject = remoteStream;
          }}
        />
        <form
          onSubmit={event => {
            event.preventDefault();
            pluginRef.current.send({
              message: {
                request: "register",
                username: username,
              }
            })
          }}
        >
          <input
            type="text"
            value={username}
            onChange={event => setUsername(event.currentTarget.value)}
          />
          <button type="submit">Submit</button>
        </form>
        <form
          onSubmit={event => {
            event.preventDefault();
            pluginRef.current.createOffer({
              success: jsep => {
                pluginRef.current.send({
                  message: {
                    request: "call",
                    username: remoteUser,
                  },
                  jsep: jsep
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
        >
          <input
            type="text"
            value={remoteUser}
            onChange={event => setRemoteUser(event.currentTarget.value)}
          />
          <button type="submit">Call</button>
        </form>
        <button
          type="button"
          onClick={() => {
            pluginRef.current.send({
              message: {
                request: "list"
              }
            })
          }}
        >
          List users
        </button>
        {remoteUser && remoteSdp && (
          <button
            type="button"
            onClick={() => {
              console.log("accept")
              // pluginRef.current.send({
              //   message: {
              //     request: "accept"
              //   },
              //   jsep: remoteSdp
              // })
              pluginRef.current.createAnswer(
                {
                  // We attach the remote OFFER
                  jsep: remoteSdp,
                  success: ourjsep => {
                    var body = { "request": "start" };
                    pluginRef.current.send({
                      message: {
                        request: "accept"
                      },
                      jsep: ourjsep
                    });
                  },
                  error: function (error) {
                    // An error occurred...
                  }
                });
            }}
          >
            Accept Call from {remoteUser}
          </button>
        )}
      </div>
    </Layout>
  )
}

export default VideoCall;