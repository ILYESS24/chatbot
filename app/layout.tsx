export const metadata = {
  title: "Chatbot UI",
  description: "Chatbot UI"
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}


