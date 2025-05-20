import './globals.css'

export const metadata = {
  title: 'Agent Interface - Speech to Text',
  description: 'Speech to text conversion tool using OpenAI API',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}