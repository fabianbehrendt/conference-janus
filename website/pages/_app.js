import '../styles/globals.css'
import '../styles/colors.css'
import '../styles/typography.css'
import '@fontsource/roboto/100.css'
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import { SocketProvider } from '../contexts/SocketProvider';
import { AppHeightProvider } from '../contexts/AppHeightProvider';

function MyApp({ Component, pageProps }) {
  return (
    <AppHeightProvider>
      <SocketProvider>
        <Component {...pageProps} />
      </SocketProvider>
    </AppHeightProvider>
  )
}

export default MyApp
