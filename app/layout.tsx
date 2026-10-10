import "./globals.css";

// i hope these fonts work lol
export const metadata = {
  title: "GitPulse - check ur repo",
  description: "homework project for dev class",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* navigation maybe?? nah too much work */}
        {children}
      </body>
    </html>
  );
}