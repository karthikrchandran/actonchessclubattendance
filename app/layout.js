import './styles.css';

export const metadata = {
  title: 'Acton Chess Club Attendance',
  description: 'Simple weekly check-in for Acton Chess Club',
  icons: { icon: '/logo.jpg' }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
