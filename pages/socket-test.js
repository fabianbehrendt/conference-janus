import { useCallback, useEffect, useState } from "react";
import io from "socket.io-client";
import Layout from "../components/Layout";

let socket;

const SocketTest = () => {
  const [input, setInput] = useState("");

  useEffect(() => {
    const socketInitializer = async () => {
      await fetch("/api/socket");
      socket = io();

      socket.on("connect", () => {
        console.log("connected")
      })

      socket.on("update-input", msg => {
        setInput(msg);
      })
    };

    socketInitializer();
  }, []);

  const onChangeHandler = (e) => {
    setInput(e.target.value);
    socket.emit("input-change", e.target.value);
  }

  return (
    <Layout>
      <input
        placeholder="Type something"
        value={input}
        onChange={onChangeHandler}
      />
    </Layout>
  );
}

export default SocketTest;