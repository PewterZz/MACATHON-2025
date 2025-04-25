import type React from "react"
import { Heart } from "lucide-react"
import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <header className="container mx-auto py-6 px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-16 w-16">
            <img src="/logo.png" alt="Meld logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Meld</h1>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="container mx-auto py-4 px-4 text-center text-slate-400 text-sm">
        © {new Date().getFullYear()} <span className="font-medium">Meld</span>. All rights reserved.
      </footer>
    </div>
  )
}
