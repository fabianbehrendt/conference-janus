import styles from "../styles/Home.module.css";
import Layout from "../components/Layout";
import Link from "next/link";

export default function Home() {
  return (
    <Layout>
      <ul>
        <li><Link href="/echotest">Echo Test</Link></li>
      </ul>
    </Layout>
  )
}
