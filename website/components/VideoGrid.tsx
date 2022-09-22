import React, { ReactNode } from "react";

import styles from "../styles/VideoGrid.module.css";

interface IVideoGrid {
  columns: number;
  rows: number;
  children: ReactNode;
}

const VideoGrid: React.FunctionComponent<IVideoGrid> = props => {
  return (
    <div
      className={styles.videoGrid}
      style={{
        gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
        // gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gridTemplateRows: `repeat(${props.rows}, 1fr)`,
      }}
    >
      {props.children}
    </div>
  );
};

export default VideoGrid;