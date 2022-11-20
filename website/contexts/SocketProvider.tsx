import React, { useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

interface ISocketProvider {
  children: React.ReactNode;
}

const SocketContext = React.createContext<undefined | Socket>(undefined);

const useSocket = () => {
  return useContext(SocketContext);
}

const SocketProvider: React.FunctionComponent<ISocketProvider> = props => {
  const [socket, setSocket] = useState<Socket>();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SOCKET_URL == null) {
      alert("No janus URL specified");
      return;
    }
    
    const newSocket = io(
      process.env.NODE_ENV === "development" ? "ws://localhost:3000" : process.env.NEXT_PUBLIC_SOCKET_URL,
      // path is used to be able to run both, janus api and websocket server, over same (sub)domain
      { path: "/socket/socket.io", }
    );

    setSocket(newSocket);

    return () => {
      newSocket.close()
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {props.children}
    </SocketContext.Provider>
  )
}

export {
  useSocket,
  SocketProvider
}