import '../styles/globals.css'
import '../styles/colors.css'
import '../styles/typography.css'
import '@fontsource/roboto/100.css'
import '@fontsource/roboto/300.css'
import '@fontsource/roboto/400.css'
import '@fontsource/roboto/500.css'
import { SocketProvider } from '../contexts/SocketProvider';
import { AppHeightProvider } from '../contexts/AppHeightProvider';
import { AuthContextProvider } from '../contexts/AuthContextProvider';

function MyApp({ Component, pageProps }) {
  return (
    <AppHeightProvider>
      <SocketProvider>
        <AuthContextProvider>
          <Component {...pageProps} />
        </AuthContextProvider>
      </SocketProvider>
    </AppHeightProvider>
  )
}

export default MyApp
