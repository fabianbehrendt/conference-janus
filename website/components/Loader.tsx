import { useAppHeight } from "../contexts/AppHeightProvider";
import styles from "../styles/Loader.module.css";

const Loader: React.FunctionComponent = props => {
  const appHeight = useAppHeight();

  return (
    <div className={styles.ldsContainer} style={{ height: appHeight }}>
      <div className={styles.ldsRing}>
        <div />
        <div />
        <div />
        <div />
      </div>
    </div>
  );
}

export default Loader;