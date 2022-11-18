import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { parseIntStrict } from "../../utils/parseIntStrict";

// @ts-ignore
import { Janus } from 'janus-gateway';
import { JanusJS } from "../../janus";

import Icon from "@mdi/react";
import { mdiContentCopy } from "@mdi/js";
import Layout from "../../components/Layout";
import { useAppHeight } from "../../contexts/AppHeightProvider";

const ConferenceDetails = () => {
  const [room, setRoom] = useState<JanusJS.Room>();

  const router = useRouter();
  const appHeight = useAppHeight();

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
  }, [router.isReady, router.query]);

  const pin = useMemo(() => {
    if (!router.isReady || typeof router.query.pin !== "string" || router.query.pin.length === 0)
      return;

    return router.query.pin;
  }, [router.isReady, router.query.pin]);

  const hostSecret = useMemo(() => {
    if (!router.isReady || typeof router.query.secret !== "string" || router.query.secret.length === 0)
      return;

    return router.query.secret;
  }, [router.isReady, router.query.secret]);

  const janusUrl = useMemo(() => process.env.NEXT_PUBLIC_JANUS_URL, []);

  useEffect(() => {
    if (janusUrl == null) {
      alert("No janus URL specified")
      return;
    }
    
    if (roomId == null) {
      return;
    }

    Janus.init({
      debug: true,
      callback: () => {
        const janus = new Janus({
          // server: "wss://janus.fabianbehrendt.de",
          // server: "ws://134.100.10.85",
          server: janusUrl,
          success: () => {
            janus.attach({
              plugin: "janus.plugin.videoroom",
              success: (pluginHandle: JanusJS.PluginHandle) => {
                pluginHandle.send({
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
                })
              },
              onmessage: (msg, jsep) => {
                console.log("msg, jsep:", msg, jsep);
              },
            } as JanusJS.PluginOptions)
          }
        });
      },
    });
  }, [janusUrl, roomId]);

  const meetingUrl = useMemo(() => {
    if (room == null) {
      return;
    }

    return `${window.location.protocol}//${window.location.host}/conference/${room.room.toString()}`;
  }, [room]);

  const pageUrl = useMemo(() => {
    if (room == null) {
      return;
    }

    return `${window.location.protocol}//${window.location.host}${window.location.pathname}${window.location.search}`;
  }, [room])

  return (
    <Layout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          padding: 64,
          boxSizing: "border-box",
          height: appHeight,
        }}
      >
        <h1>Konferenzdetails</h1>
        <h3>Sample Text</h3>
        {room != null && meetingUrl != null && pageUrl != null && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              border: "1px solid black",
              borderRadius: 8,
              maxWidth: "640px",
              width: "100%",
            }}
          >
            <h2
              style={{
                textAlign: "center",
                padding: 32,
                borderBottom: "1px solid black",
              }}
            >
              {room.description}
            </h2>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 32,
                borderBottom: "1px solid black",
              }}
            >
              <p>Teilen Sie den Link der Konferenz</p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                <input
                  style={{ height: 40, paddingRight: 40, background: "var(--secondary)", }}
                  disabled
                  readOnly
                  value={`${meetingUrl}?pin=${pin}`}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(50% - 12px)",
                    right: 8,
                    cursor: "pointer",
                  }}
                  onClick={async () => {
                    await navigator.clipboard.writeText(`${meetingUrl}?pin=${pin}`)
                  }}
                >
                  <Icon
                    path={mdiContentCopy}
                    size="24px"
                  />
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 32,
              }}
            >
              <p>Teilen Sie diese Seite mit anderen Moderator:innen</p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                <input
                  style={{ height: 40, paddingRight: 40, background: "var(--secondary)", }}
                  disabled
                  readOnly
                  value={pageUrl}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(50% - 12px)",
                    right: 8,
                    cursor: "pointer",
                  }}
                  onClick={async () => {
                    await navigator.clipboard.writeText(pageUrl)
                  }}
                >
                  <Icon
                    path={mdiContentCopy}
                    size="24px"
                  />
                </div>
              </div>
              <button
                onClick={async () => {
                  // TODO add secret to URL
                  await router.push(meetingUrl + window.location.search);
                }}
              >
                Als Moderator:in beitreten
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ConferenceDetails;