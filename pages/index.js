import styles from "../styles/Home.module.css";
import Layout from "../components/Layout";
import Link from "next/link";

export default function Home() {
  return (
    <Layout>
      <div className={styles.navLinks}>
        <Link href="/echotest">Echo Test</Link>
        <Link href="/videocall">Video Call</Link>
      </div>
    </Layout>
  )
}
