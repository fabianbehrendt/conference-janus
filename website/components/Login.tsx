import { useEffect, useState } from "react";
import { useAppHeight } from "../contexts/AppHeightProvider";
import { useAuth } from "../contexts/AuthContextProvider";
import { JanusJS } from "../janus";

interface ILogin {
  pluginHandle: JanusJS.PluginHandle;
}

const Login: React.FunctionComponent<ILogin> = props => {
  const appHeight = useAppHeight();
  const auth = useAuth();

  return (
    <div
      style={{
        position: "fixed",
        width: "100%",
        height: appHeight,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <form
        style={{
          display: "flex",
          gap: 8,
        }}
        onSubmit={event => {
          event.preventDefault();

          const adminKey = event.currentTarget.admin_key.value;

          props.pluginHandle.send({
            message: {
              request: "create",
              description: "authRoom",
              admin_key: adminKey,
            },
            success: createSuccess => {
              if (createSuccess.error != null) {
                auth.setIsAdminKeyWrong(true);
              } else {
                props.pluginHandle.send({
                  message: {
                    request: "destroy",
                    room: createSuccess.room,
                    admin_key: adminKey,
                  },
                  success: destroySuccess => {
                    if (destroySuccess.videoroom === "destroyed") {
                      auth.setIsAdminKeyWrong(false);
                      auth.setAdminKey(adminKey);
                    }
                  }
                })
              }
            }
          })
        }}
      >
        <input name="admin_key" placeholder="Admin Key eingeben" />
        <button>Login</button>
      </form>
      {auth.isAdminKeyWrong && <p className="red">Falscher Admin Key</p>}
    </div>
  );
}

export default Login;