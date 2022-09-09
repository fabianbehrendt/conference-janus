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
    const newSocket = io(
      process.env.NODE_ENV === "development" ? "ws://localhost:3000" : "wss://app.fabianbehrendt.de",
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