import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';

// @ts-ignore
import { Janus } from 'janus-gateway';
import { JanusJS } from "../janus";

import Icon from "@mdi/react";
import { mdiDelete } from "@mdi/js";

import Layout from '../components/Layout';
import { useRouter } from 'next/router';

const REC_DIR = "/home/fabian/janus-recordings/";

const CreateConference = () => {
  const [isJanusInitialized, setIsJanusInitialized] = useState(false);
  const [rooms, setRooms] = useState<JanusJS.Room[]>();
  const [users, setUsers] = useState<{ [room: number]: number }>({});
  const [createRoomName, setCreateRoomName] = useState("");
  const [hostSecret, setHostSecret] = useState("");
  const [pin, setPin] = useState("");

  const plugin = useRef<JanusJS.PluginHandle>();

  const router = useRouter();

  const getRooms = useCallback(() => {
    plugin.current?.send({
      message: {
        request: "list",
      },
      success: (msg: { list: JanusJS.Room[], videoroom: "success" | "event", error_code?: number, error?: string }) => {
        const event = msg.videoroom;

        if (event === "success") {
          setRooms(msg.list);
        }

        for (const room of msg.list) {
          if (room.num_participants > 0) {
            setUsers(prev => {
              return {
                ...prev,
                [room.room]: room.num_participants,
              }
            })
          }
        }
      }
    });
  }, []);

  useEffect(() => {
    Janus.init({
      debug: false,
      callback: () => {
        setIsJanusInitialized(true);
      },
    });
  }, []);

  useEffect(() => {
    if (!isJanusInitialized)
      return;

    const janus = new Janus({
      server: "wss://janus.fabianbehrendt.de",
      // server: "ws://134.100.10.85",
      success: () => {
        janus.attach({
          plugin: "janus.plugin.videoroom",
          success: (pluginHandle: JanusJS.PluginHandle) => {
            plugin.current = pluginHandle;
            getRooms();
          },
          onmessage: (msg, jsep) => {
            console.log("msg, jsep:", msg, jsep);
          },
        } as JanusJS.PluginOptions)
      }
    });
  }, [getRooms, isJanusInitialized]);

  const roomList = useMemo(() => {
    return rooms?.map(room => {
      const id = room.room;

      return (
        <div key={id} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div
            style={{ display: "flex", cursor: "pointer" }}
            onClick={() => {
              plugin.current?.send({
                message: {
                  request: "destroy",
                  room: room.room,
                  permanent: true,
                  secret: hostSecret,
                },
                success: result => {
                  getRooms();
                }
              })
            }}
          >
            <Icon
              path={mdiDelete}
              size={1}
              color="var(--red)"
            />
          </div>
          <Link key={id} href={`/conference/${id}`}>
            {room.description}
          </Link>
          <p>|</p>
          <p>Users: {users[id] ? users[id] : 0}</p>
        </div>
      )
    })
  }, [getRooms, hostSecret, rooms, users]);

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: 8 }}>
        <form
          style={{
            display: "flex",
            gap: 8,
          }}
          onSubmit={event => {
            event.preventDefault();

            plugin.current?.send({
              message: {
                request: "create",
                permanent: true,
                description: createRoomName,
                publishers: 33,
                secret: hostSecret,
                pin: pin,
                record: true,
                rec_dir: REC_DIR,
                lock_record: true,

              },
              success: result => {
                // setCreateRoomName("");
                // getRooms();
                router.push(`/conference-details/${result.room}?pin=${pin}&secret=${hostSecret}`)
              }
            })
          }}
        >
          <input
            type="text"
            placeholder="Raumnamen eingeben"
            value={createRoomName}
            onChange={event => setCreateRoomName(event.currentTarget.value)}
          />
          <input
            type="text"
            placeholder="Raumpasswort eingeben"
            value={pin}
            onChange={event => setPin(event.currentTarget.value)}
          />
          <input
            type="text"
            placeholder="Host PIN eingeben"
            value={hostSecret}
            onChange={event => setHostSecret(event.currentTarget.value)}
          />
          <button type="submit">Raum erstellen</button>
        </form>
        {roomList}
      </div>
    </Layout>
  )
}

export default CreateConference;