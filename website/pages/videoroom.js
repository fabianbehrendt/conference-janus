import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';

// @ts-ignore
import { Janus } from 'janus-gateway';

import Layout from '../components/Layout';

const VideoRoom = () => {
  const [isJanusInitialized, setIsJanusInitialized] = useState(false);
  const [rooms, setRooms] = useState(null);
  const [users, setUsers] = useState({});
  const [deleteRoomName, setDeleteRoomName] = useState("");
  const [createRoomName, setCreateRoomName] = useState("");
  const [listRoomName, setListRoomName] = useState("");

  const plugin = useRef(null);

  const getRooms = useCallback(() => {
    plugin.current.send({
      message: {
        request: "list",
      },
      success: msg => {
        const event = msg.videoroom;

        if (event === "success") {
          setRooms(msg.list);
          // console.log(msg.list);
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
      debug: true,
      callback: () => {
        setIsJanusInitialized(true);
      },
    });
  }, []);

  const janusUrl = useMemo(() => process.env.NEXT_PUBLIC_JANUS_URL, []);

  useEffect(() => {
    if (janusUrl == null) {
      alert("No janus URL specified")
      return;
    }
    
    if (!isJanusInitialized)
      return;

    const janus = new Janus({
      server: janusUrl,
      success: () => {
        janus.attach({
          plugin: "janus.plugin.videoroom",
          success: pluginHandle => {
            plugin.current = pluginHandle;
            getRooms();
          },
          onmessage: (msg, jsep) => {
            console.log("msg, jsep:", msg, jsep);
          },
        })
      }
    });
  }, [getRooms, isJanusInitialized, janusUrl]);

  const roomList = useMemo(() => {
    return rooms?.map(room => {
      const id = room.room;

      return (
        <div key={id} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Link key={id} href={`/videoroom/${id}`}>
            {`${id}  "${room.description}"`}
          </Link>
          <p>|</p>
          <p>Users: {users[id] ? users[id] : 0}</p>
        </div>
      )
    })
  }, [rooms, users]);

  return (
    <Layout>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <form
          onSubmit={event => {
            event.preventDefault();

            plugin.current.send({
              message: {
                request: "destroy",
                room: parseInt(deleteRoomName),
              },
              success: result => {
                console.log(result)
                setDeleteRoomName("");
                getRooms();
              }
            })
          }}
        >
          <input type="number" min={1} max={Number.MAX_SAFE_INTEGER} value={deleteRoomName} onChange={event => setDeleteRoomName(event.currentTarget.value)} />
          <button type="submit">Destroy Room</button>
        </form>
        <form
          onSubmit={event => {
            event.preventDefault();

            plugin.current.send({
              message: {
                request: "create",
                room: parseInt(createRoomName)
              },
              success: result => {
                console.log(result)
                setCreateRoomName("");
                getRooms();
              }
            })
          }}
        >
          <input type="number" min={1} max={Number.MAX_SAFE_INTEGER} value={createRoomName} onChange={event => setCreateRoomName(event.currentTarget.value)} />
          <button type="submit">Create Room</button>
        </form>
        <form
          onSubmit={event => {
            event.preventDefault();

            plugin.current.send({
              message: {
                request: "listparticipants",
                room: parseInt(listRoomName)
              },
              success: result => {
                console.log(result)
              }
            })
          }}
        >
          <input type="text" min={1} max={Number.MAX_SAFE_INTEGER} value={listRoomName} onChange={event => setListRoomName(event.currentTarget.value)} />
          <button type="submit">List Participants</button>
        </form>
        {roomList}
      </div>
    </Layout>
  )
}

export default VideoRoom;