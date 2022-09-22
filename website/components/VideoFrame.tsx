import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "../styles/VideoFrame.module.css";

interface IVideoFrame {
  stream: MediaStream | undefined;
  muted?: boolean;
  mirror?: boolean;
}

const VideoFrame: React.FunctionComponent<IVideoFrame> = props => {
  const [videoWidth, setVideoWidth] = useState<string>();
  const [videoHeight, setVideoHeight] = useState<string>();
  const [isMetadataLoaded, setIsMetadataLoaded] = useState<boolean>(false);

  const videoDiv = useRef<HTMLDivElement>();
  const video = useRef<HTMLVideoElement>();

  const mirror = useMemo(() => props.mirror || false, [props.mirror]);

  useEffect(() => {
    if (isMetadataLoaded) {
      const observer = new ResizeObserver(
        () => {
          if (video.current && videoDiv.current) {
            const widthRatio = video.current.offsetWidth / videoDiv.current.offsetWidth;
            const heightRatio = video.current.offsetHeight / videoDiv.current.offsetHeight;

            if (widthRatio < heightRatio) {
              setVideoWidth("100%");
              setVideoHeight("auto");
            } else {
              setVideoWidth("auto");
              setVideoHeight("100%");
            }
          }
        }
      );

      if (videoDiv.current) {
        observer.observe(videoDiv.current);
      }

      return () => {
        observer.disconnect();
      }
    }
  }, [isMetadataLoaded]);

  const handleRef = useCallback((ref: HTMLDivElement) => {
    if (ref && videoDiv.current !== ref) {
      videoDiv.current = ref;
    }
  }, []);

  return (
    <div
      className={styles.videoFrame}
      ref={handleRef}
    >
      <video
        autoPlay
        playsInline
        muted={props.muted}
        ref={ref => {
          if (ref && props.stream && ref.srcObject !== props.stream) {
            ref.srcObject = props.stream;
          }

          if (ref && video.current !== ref) {
            video.current = ref;
          }
        }}
        className={`${mirror && styles.mirror}`}
        style={{ width: videoWidth, height: videoHeight }}
        onLoadedMetadata={event => {
          if (videoDiv.current) {
            const videoWidth = event.currentTarget.offsetWidth;
            const videoHeight = event.currentTarget.offsetHeight;

            const widthRatio = videoWidth / videoDiv.current.offsetWidth;
            const heightRatio = videoHeight / videoDiv.current.offsetHeight;

            if (widthRatio < heightRatio) {
              setVideoWidth("100%");
              setVideoHeight("auto");
            } else {
              setVideoWidth("auto");
              setVideoHeight("100%");
            }
          }

          setIsMetadataLoaded(true);
        }}
      />
    </div>
  );
};

VideoFrame.defaultProps = {
  muted: false,
}

export default VideoFrame;