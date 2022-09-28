import Icon from "@mdi/react";
import { mdiAccount } from "@mdi/js";
import randomColor from "randomcolor";

interface IAvatar {
  height: number;
  userName: string;
}

const Avatar: React.FunctionComponent<IAvatar> = props => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          aspectRatio: "1/1",
          height: `${props.height}vh`,
          background: randomColor({ seed: props.userName }),
          borderRadius: "50%",
        }}
      >
        {props.userName.length === 0 ? (
          <Icon
            path={mdiAccount}
            size="66%"
            color="var(--black)"
          />
        ) : (
          <h1
            style={{
              fontSize: `${0.5 * props.height}vh`,
              fontWeight: 500,
              color: "var(--black)",
            }}
          >
            {props.userName[0]}
          </h1>
        )}
      </div>
    </div>
  );
}

export default Avatar;