import '../styles/globals.css'
import { SocketProvider } from '../contexts/SocketProvider';

function MyApp({ Component, pageProps }) {
  return (
    <SocketProvider>
      <Component {...pageProps} />
    </SocketProvider>
  )
}

export default MyApp
