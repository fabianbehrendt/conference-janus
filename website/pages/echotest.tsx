import { useState, useEffect } from 'react'

// @ts-ignore
import { Janus } from 'janus-gateway';
import { JanusJS } from '../janus';

import Layout from '../components/Layout'

const body = {
  audio: true,
  video: true
};

const EchoTest = () => {
  const [isJanusInitialized, setIsJanusInitialized] = useState(false);
  const [localTracks, setLocalTracks] = useState<MediaStreamTrack[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream>();
  const [remoteTracks, setRemoteTracks] = useState<MediaStreamTrack[]>([]);
  const [remoteStream, setRemoteStream] = useState<MediaStream>();

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

    let plugin: any;

    const janus = new Janus({
      // server: "wss://janus.fabianbehrendt.de",
      server: "wss://fabeturn.informatik.uni-hamburg.de",
      success: () => {
        janus.attach({
          plugin: "janus.plugin.echotest",
          success: (pluginHandle: JanusJS.PluginHandle) => {
            // TODO successfully attached
            // console.log("attached to plugin echotest")
            plugin = pluginHandle;
            plugin.send({ message: body })
            // plugin.createOffer({
            //   success: (jsep: JanusJS.JSEP) => {
            //     plugin.send({ message: body, jsep: jsep })
            //   },
            //   error: (error: any) => {
            //     // TODO Handle error
            //   },
            //   customizeSdp: (jsep: JanusJS.JSEP) => {
            //     // TODO Modify original sdp if needed
            //   }
            // })
            plugin.createOffer({
              tracks: [
                { type: "audio", capture: true },
                { type: "video", capture: true },
              ],
              success: (jsep: JanusJS.JSEP) => {
                // console.log(`own jsep ${jsep.type}:`, jsep.sdp)
                plugin.send({ message: body, jsep: jsep })
              },
              error: (error: any) => {
                // TODO Handle error
              },
              customizeSdp: (jsep: JanusJS.JSEP) => {
                // TODO Modify original sdp if needed
              }
            })
          },
          error: (cause: any) => {
            // TODO error
          },
          consentDialog: (on: boolean) => {
            // TODO e.g. darken the screen if on === true (getUserMedia incoming)
          },
          onmessage: (msg: any, jsep: JanusJS.JSEP) => {
            // TODO message / event received

            // TODO if jsep not null, WebRTC negotiation
            if (jsep != null) {
              // console.log(`got jsep ${jsep.type}:`, jsep.sdp)
              plugin.handleRemoteJsep({ jsep: jsep })
            }
          },
          onlocaltrack: (track: MediaStreamTrack, added: boolean) => {
            // TODO local track has been added or removed
            // console.log("local:", track, added)
            setLocalTracks(prev => [...prev, track])
          },
          onremotetrack: (track: MediaStreamTrack, mid: number, added: boolean) => {
            // TODO remote track with specific mid has been added or removed
            // console.log("remote:", track, mid, added)
            setRemoteTracks(prev => {
              if (prev.includes(track))
                return prev
              else
                return [...prev, track]
            })
          },
          webrtcState: (active: boolean) => {
            console.log("webrtcState:", active)
          },
          iceState: (state: string) => {
            console.log("iceState:", state)
          },
          mediaState: (mid: number, type: string, on: boolean) => {
            console.log("mediaState:", mid, type, on)
          },
          oncleanup: () => {
            // TODO clean UI
          },
          detached: () => {
            // TODO connection closed
          }
        })
      },
      error: (cause: any) => {
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
            if (ref && localStream)
              ref.srcObject = localStream;
          }}
        />
        <video
          autoPlay
          style={{ border: "1px solid black" }}
          ref={ref => {
            if (ref && remoteStream)
              ref.srcObject = remoteStream;
          }}
        />
      </div>
    </Layout>
  )
}

export default EchoTest;