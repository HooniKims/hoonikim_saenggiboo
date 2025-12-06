import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "생기부 작성 도우미 by HooniKim",
  description: "AI 기반 학교 생활기록부 작성 도우미",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <header className="main-header">
          <div className="container header-content">
            <Link href="/" className="brand-logo">
              <span>생기부 작성 도우미</span>
              <span className="brand-by">by HooniKim</span>
            </Link>
            <nav className="nav-links">
              <Link href="/gwasetuk" className="nav-item">과세특(자유학기 세특)</Link>
              <Link href="/club" className="nav-item">동아리 세특</Link>
              <Link href="/behavior" className="nav-item">행발 작성</Link>
              <Link href="/letter" className="nav-item">가정통신문 작성</Link>
            </nav>
          </div>
        </header>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
