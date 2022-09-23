import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';

// @ts-ignore
import { Janus } from 'janus-gateway';
import { JanusJS } from "../janus";

import Icon from "@mdi/react";
import { mdiDelete } from "@mdi/js";

import Layout from '../components/Layout';
import { useRouter } from 'next/router';

const CreateConference = () => {
  const [isJanusInitialized, setIsJanusInitialized] = useState(false);
  const [rooms, setRooms] = useState<JanusJS.Room[]>();
  const [users, setUsers] = useState<{ [room: number]: number }>({});
  const [createRoomName, setCreateRoomName] = useState("");

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
          <Link key={id} href={`/videoroom/${id}`}>
            {room.description}
          </Link>
          <p>|</p>
          <p>Users: {users[id] ? users[id] : 0}</p>
        </div>
      )
    })
  }, [getRooms, rooms, users]);

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <form
          onSubmit={event => {
            event.preventDefault();

            plugin.current?.send({
              message: {
                request: "create",
                description: createRoomName,
              },
              success: result => {
                // setCreateRoomName("");
                // getRooms();
                router.push(`/conference-details/${result.room}`)
              }
            })
          }}
        >
          <input type="text" value={createRoomName} onChange={event => setCreateRoomName(event.currentTarget.value)} />
          <button type="submit">Create Room</button>
        </form>
        {roomList}
      </div>
    </Layout>
  )
}

export default CreateConference;