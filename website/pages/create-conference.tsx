import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';

// @ts-ignore
import { Janus } from 'janus-gateway';
import { JanusJS } from "../janus";

import Icon from "@mdi/react";
import { mdiDelete } from "@mdi/js";

import Layout from '../components/Layout';
import { useRouter } from 'next/router';
import Login from '../components/Login';
import Loader from '../components/Loader';
import { useAuth } from '../contexts/AuthContextProvider';
import { useAppHeight } from '../contexts/AppHeightProvider';

const CreateConference = (props: any) => {
  const [isJanusInitialized, setIsJanusInitialized] = useState(false);
  const [rooms, setRooms] = useState<JanusJS.Room[]>();
  const [users, setUsers] = useState<{ [room: number]: number }>({});
  const [createRoomName, setCreateRoomName] = useState("");
  const [hostSecret, setHostSecret] = useState("");
  const [pin, setPin] = useState("");
  const [pluginHandle, setPluginHandle] = useState<JanusJS.PluginHandle>();
  const [deleteRoomNumber, setDeleteRoomNumber] = useState<number>();
  const [isHostPinWrong, setIsHostPinWrong] = useState<boolean>(false);

  const router = useRouter();
  const auth = useAuth();
  const appHeight = useAppHeight();

  const getRooms = useCallback(() => {
    if (pluginHandle == null) {
      return;
    }

    pluginHandle.send({
      message: {
        request: "list",
        admin_key: auth.adminKey,
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
  }, [auth.adminKey, pluginHandle]);

  useEffect(() => {
    Janus.init({
      debug: false,
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
          success: (pluginHandle: JanusJS.PluginHandle) => {
            setPluginHandle(pluginHandle);
            getRooms();
          },
          onmessage: (msg, jsep) => {
            console.log("msg, jsep:", msg, jsep);
          },
        } as JanusJS.PluginOptions)
      }
    });
  }, [getRooms, isJanusInitialized, janusUrl]);

  const roomList = useMemo(() => {
    return rooms?.map(room => {
      const id = room.room;

      return (
        <div key={id} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div
            style={{ display: "flex", cursor: "pointer" }}
            onClick={() => {
              if (pluginHandle == null) {
                return;
              }

              setDeleteRoomNumber(room.room);
            }}
          >
            <Icon
              path={mdiDelete}
              size={1}
              color="var(--red)"
            />
          </div>
          <p>{room.description}</p>
          <p>|</p>
          <p>Users: {users[id] ? users[id] : 0}</p>
        </div>
      )
    })
  }, [pluginHandle, rooms, users]);

  return (
    <Layout>
      {deleteRoomNumber != null && (
        <div
          className="backdrop"
          style={{
            position: "fixed",
            height: appHeight,
            width: "100%",
          }}
          onClick={() => {
            setDeleteRoomNumber(undefined);
          }}
        >
          <div
            style={{
              position: "absolute",
              background: "var(--secondary)",
              padding: 12,
              borderRadius: 8,
              top: "50%",
              left: "50%",
              translate: "-50% -50%",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
            onClick={event => {
              event.stopPropagation();
            }}
          >
            <h2 className="black" style={{ textAlign: "center" }}>Raum <b>{rooms?.find(room => room.room === deleteRoomNumber)?.description}</b> löschen</h2>
            <p className="black">Bitte die Host PIN des Raumes eingeben:</p>
            <form
              style={{
                display: "flex",
                gap: 8,
              }}
              onSubmit={event => {
                event.preventDefault();

                if (pluginHandle == null) {
                  return;
                }

                pluginHandle.send({
                  message: {
                    request: "destroy",
                    room: deleteRoomNumber,
                    permanent: true,
                    secret: event.currentTarget.hostSecret.value,
                  },
                  success: msg => {
                    if (msg.error) {
                      setIsHostPinWrong(true);
                      return;
                    }

                    getRooms();
                    setIsHostPinWrong(false);
                    setDeleteRoomNumber(undefined);
                  }
                })
              }}
            >
              <input style={{ flex: 1 }} name="hostSecret" placeholder="Host PIN" />
              <button>Löschen</button>
            </form>
            {isHostPinWrong && <p className="red">Falscher Host PIN</p>}
          </div>
        </div>
      )}


      {pluginHandle == null ? (
        <Loader />
      ) : (
        auth.adminKey == null ? (
          <Login
            pluginHandle={pluginHandle}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: 8 }}>
            <form
              style={{
                display: "flex",
                gap: 8,
              }}
              onSubmit={event => {
                event.preventDefault();

                pluginHandle.send({
                  message: {
                    request: "create",
                    permanent: true,
                    description: createRoomName,
                    publishers: 33,
                    secret: hostSecret,
                    pin: pin,
                    record: true,
                    rec_dir: process.env.NEXT_PUBLIC_RECORDING_DIR,
                    lock_record: true,
                    is_private: true,
                    admin_key: auth.adminKey,

                  },
                  success: result => {
                    pluginHandle.hangup();
                    pluginHandle.detach({
                      success: () => {
                        router.push(`/conference-details/${result.room}?pin=${pin}&secret=${hostSecret}`)
                      }
                    })
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
              <button type="submit" disabled={createRoomName.length === 0 || pin.length === 0 || hostSecret.length === 0}>Raum erstellen</button>
            </form>
            {roomList == null ? (
              <p>Wird geladen...</p>
            ) : (
              roomList.length === 0 ? (
                <p>Keine Räume vorhanden</p>
              ) : (
                roomList
              )
            )}
          </div>
        )
      )}
    </Layout>
  )
}

export default CreateConference;