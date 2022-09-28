import VideoFrame from "./VideoFrame";

interface ILocalVideoFrame {
  stream: MediaStream | undefined;
  userName?: string;
}

const VideoElement: React.FunctionComponent<ILocalVideoFrame> = props => {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative", }}>
      <VideoFrame
        stream={props.stream}
        mirror
        muted
      />
      {props.userName != null && (
        <p style={{ position: "absolute", left: 0, bottom: 0, margin: 0, padding: "4px 4px", background: "black", color: "white", opacity: "75%", borderRadius: "4px" }}>
          {props.userName}
        </p>
      )}
    </div>
  )
}

export default VideoElement;