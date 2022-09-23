import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { parseIntStrict } from "../../utils/parseIntStrict";

// @ts-ignore
import { Janus } from 'janus-gateway';
import { JanusJS } from "../../janus";

import Icon from "@mdi/react";
import { mdiContentCopy } from "@mdi/js";

const ConferenceDetails = () => {
  const [room, setRoom] = useState<JanusJS.Room>();

  const router = useRouter();

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

  useEffect(() => {
    if (roomId == null) {
      return;
    }

    Janus.init({
      debug: false,
      callback: () => {
        const janus = new Janus({
          server: "wss://janus.fabianbehrendt.de",
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
  }, [roomId]);

  const meetingUrl = useMemo(() => {
    if (room == null) {
      return;
    }

    return window.location.protocol + "//" + window.location.host + "/videoroom/" + room.room.toString();
  }, [room]);

  const pageUrl = useMemo(() => {
    if (room == null) {
      return;
    }

    return window.location.protocol + "//" + window.location.host + router.pathname.replaceAll("[id]", room.room.toString());
  }, [room, router.pathname])

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 32,
        padding: 128,
        maxWidth: "480px",
        margin: "0 auto"
      }}
    >
      <h1 style={{ textAlign: "center" }}>Konferenzdetails</h1>
      <p style={{ textAlign: "center" }}>Sample Text</p>
      {room != null && meetingUrl != null && pageUrl != null && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            border: "1px solid black",
            borderRadius: 8
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              textAlign: "center",
              padding: 32,
              borderBottom: "1px solid black",
            }}
          >
            {room.description}
          </div>
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
                style={{ height: 40, paddingRight: 40 }}
                disabled
                readOnly
                value={meetingUrl}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(50% - 12px)",
                  right: 8,
                  cursor: "pointer",
                }}
                onClick={async () => {
                  await navigator.clipboard.writeText(meetingUrl)
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
                style={{ height: 40, paddingRight: 40 }}
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
          </div>
        </div>
      )}
    </div>
  );
}

export default ConferenceDetails;