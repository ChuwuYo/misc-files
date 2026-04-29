/**
 * Mini App 必须在 <head> 放 fc:miniapp meta tag
 * spec: https://miniapps.farcaster.xyz/docs/specification （检索 2026-04）
 */

const MINIAPP_META = {
  version: 'next',
  imageUrl: 'https://my.app/cover.png',
  button: {
    title: 'Open my app',
    action: {
      type: 'launch_miniapp',
      url: 'https://my.app',
      name: 'MyApp',
      splashImageUrl: 'https://my.app/splash.png',
      splashBackgroundColor: '#000000',
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="fc:miniapp" content={JSON.stringify(MINIAPP_META)} />
      </head>
      <body>{children}</body>
    </html>
  )
}
