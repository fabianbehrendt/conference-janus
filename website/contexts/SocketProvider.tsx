import React, { useContext, useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';

interface ISocketProvider {
  children: React.ReactNode;
}

const URL_WEBSOCKET_SERVER = "wss://app.fabianbehrendt.de";

const SocketContext = React.createContext<undefined | Socket>(undefined);

const useSocket = () => {
  return useContext(SocketContext);
}

const SocketProvider: React.FunctionComponent<ISocketProvider> = props => {
  const [socket, setSocket] = useState<Socket>();

  useEffect(() => {
    const newSocket = io(
      process.env.NODE_ENV === "development" ? "ws://localhost:3000" : URL_WEBSOCKET_SERVER,
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