/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (!config.plugins) {
      config.plugins = []
    }

    config.plugins.push(
      new webpack.ProvidePlugin({ adapter: ["webrtc-adapter", "default"] })
    )

    if (!config.module.rules) {
      config.module.rules = []
    }

    config.module.rules.push(
      {
        test: require.resolve('janus-gateway'),
        loader: 'exports-loader',
        options: {
          exports: 'Janus',
        },
      }
    )

    // Important: return the modified config
    return config
  },
}

module.exports = nextConfig
