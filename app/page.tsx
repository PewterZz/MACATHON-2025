import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Heart, Shield, KeyRound } from "lucide-react"
import { Input } from "@/components/ui/input"

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900">
      <header className="container mx-auto py-6 px-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="h-16 w-16">
            <img src="/logo.png" alt="Meld logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">Meld</h1>
        </div>
        <Link href="/signin">
          <Button variant="outline" className="text-slate-100 border-slate-700 hover:bg-slate-800">
            Sign In
          </Button>
        </Link>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="relative">
          {/* Gradient blob in background */}
          <div className="absolute -top-20 right-0 w-96 h-96 bg-[#3ECF8E]/20 rounded-full filter blur-3xl opacity-50" />
          <div className="absolute top-40 -left-20 w-72 h-72 bg-[#3ECF8E]/10 rounded-full filter blur-3xl opacity-50" />
        </div>

        <div className="grid md:grid-cols-2 gap-12 relative z-10">
          {/* Get Help Section */}
          <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-lg">
            <div className="h-12 w-12 rounded-full bg-[#3ECF8E]/20 flex items-center justify-center mb-6">
              <Heart className="h-6 w-6 text-[#3ECF8E]" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-slate-100">Get Help</h2>
            <p className="text-slate-300 mb-8">
              Connect with trained helpers who understand what you're going through. Our platform provides
              support when you need it most.
            </p>
            <p className="text-slate-400 text-sm mb-6">
              Access via phone, WhatsApp, or Discord - we'll connect you with someone who can help.
            </p>
            <Link href="/signin">
              <Button className="w-full bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900">
                Get Support Now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          {/* Become a Helper Section */}
          <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-lg">
            <div className="h-12 w-12 rounded-full bg-[#3ECF8E]/20 flex items-center justify-center mb-6">
              <Shield className="h-6 w-6 text-[#3ECF8E]" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-slate-100">Become a Helper</h2>
            <p className="text-slate-300 mb-6">
              Use your experience and empathy to support others in crisis. Join our community of verified helpers
              and make a difference.
            </p>
            <p className="text-slate-400 text-sm mb-6">
              Complete training, get verified, and start helping others navigate through difficult times.
            </p>
            <Link href="/signup">
              <Button className="w-full bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900">
                Become a Helper <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* How It Works + Reference Code Section in a grid */}
        <div className="mt-12 grid md:grid-cols-2 gap-12 relative z-10">
          {/* How It Works Section - no box, just text */}
          <div className="flex flex-col justify-center p-4">
            <h2 className="text-2xl font-bold mb-4 text-slate-100">How It Works</h2>
            <p className="text-slate-300">
              Meld connects students in crisis with trained helpers who have been through similar
              experiences. Our AI-powered system matches you with the right helper for your specific situation.
            </p>
          </div>

          {/* Reference Code Section */}
          <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-lg">
            <div className="h-12 w-12 rounded-full bg-[#3ECF8E]/20 flex items-center justify-center mb-6">
              <KeyRound className="h-6 w-6 text-[#3ECF8E]" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-slate-100">Have a Reference Code?</h2>
            <p className="text-slate-300 mb-6">
              If you received a reference code via SMS or WhatsApp, enter it below to access your conversation.
            </p>
            <form className="flex space-x-2" action="/api/reference-code" method="GET">
              <Input 
                name="code" 
                placeholder="Enter your code" 
                className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400"
              />
              <Button type="submit" className="bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900">
                Access
              </Button>
            </form>
          </div>
        </div>
      </main>

      <footer className="container mx-auto py-8 px-4 border-t border-slate-800 mt-24">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <span className="text-slate-300 font-medium tracking-tight">Meld</span>
          </div>
          <div className="text-slate-400 text-sm">
            © {new Date().getFullYear()} <span className="font-medium">Meld</span>. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
