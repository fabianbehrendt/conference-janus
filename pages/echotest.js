import { useState, useEffect } from 'react'

import Janus from '../janus-es.js'

export default function EchoTest() {
  const [isJanusInitialized, setIsJanusInitialized] = useState(false);
  const [localTracks, setLocalTracks] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteTracks, setRemoteTracks] = useState([]);
  const [remoteStream, setRemoteStream] = useState(null);

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

    let plugin = null;

    const janus = new Janus({
      server: "wss://fabianbehrendt.me/server",
      success: () => {
        janus.attach({
          plugin: "janus.plugin.echotest",
          success: pluginHandle => {
            // TODO successfully attached
            // console.log("attached to plugin echotest")
            plugin = pluginHandle;
            const body = {
              audio: true,
              video: true
            };
            plugin.send({ message: body })
            plugin.createOffer({
              success: jsep => {
                plugin.send({ message: body, jsep: jsep })
              },
              error: error => {
                // TODO Handle error
              },
              customizeSdp: jsep => {
                // TODO Modify original sdp if needed
              }
            })
          },
          error: cause => {
            // TODO error
          },
          consentDialog: on => {
            // TODO e.g. darken the screen if on === true (getUserMedia incoming)
          },
          onmessage: (msg, jsep) => {
            // TODO message / event received
            // TODO if jsep not null, WebRTC negotiation
            if (jsep !== undefined && jsep !== null) {
              plugin.handleRemoteJsep({ jsep: jsep })
            }
          },
          onlocaltrack: (track, added) => {
            // TODO local track has been added or removed
            // console.log("local:", track, added)
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
    </div>
  )
}
