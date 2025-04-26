"use client"

import { useEffect, useState, FormEvent, useRef, Suspense } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, Heart, Shield, KeyRound } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useSimpleToast, ToastContextType } from "@/components/SimpleToaster"
// Fallback if context isn't available
import { showToast } from "@/components/SimpleToaster"

// Create a client component that uses useSearchParams
function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [referenceCode, setReferenceCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const errorCode = searchParams?.get('error');
  
  // Initialize toastContext with a proper type
  let toastContext: ToastContextType | undefined;
  try {
    toastContext = useSimpleToast();
  } catch (error) {
    console.error("Toast context not available:", error);
    // We'll use the direct DOM method as fallback
  }

  // Use a ref to track if we've shown the error message for this render
  const errorShownRef = useRef(false);

  useEffect(() => {
    // Ensure we only show each error once per page load/component mount
    if (errorCode && !errorShownRef.current) {
      try {
        if (errorCode === 'invalid_code') {
          errorShownRef.current = true;
          if (toastContext) {
            toastContext.addToast(
              "The reference code you entered was not found or has expired. Please check the code and try again.", 
              "error", 
              "Invalid Reference Code"
            );
          } else {
            // Fallback to direct DOM method
            showToast(
              "The reference code you entered was not found or has expired. Please check the code and try again.", 
              "error", 
              "Invalid Reference Code"
            );
          }
        } else if (errorCode === 'server_error') {
          errorShownRef.current = true;
          if (toastContext) {
            toastContext.addToast(
              "Something went wrong on our end. Please try again later.", 
              "error", 
              "Server Error"
            );
          } else {
            // Fallback to direct DOM method
            showToast(
              "Something went wrong on our end. Please try again later.", 
              "error", 
              "Server Error"
            );
          }
        }
      } catch (error) {
        console.error("Error showing toast notification:", error);
        // Ultimate fallback if all toast methods fail
        if (!errorShownRef.current) {
          errorShownRef.current = true;
          if (errorCode === 'invalid_code') {
            alert("Invalid Reference Code: The reference code you entered was not found or has expired.");
          } else if (errorCode === 'server_error') {
            alert("Server Error: Something went wrong on our end. Please try again later.");
          }
        }
      }
    }
    
    // Cleanup function to prevent memory leaks
    return () => {
      // No cleanup needed for this effect
    };
  }, [errorCode, toastContext]); // Only depend on errorCode and toastContext

  const handleReferenceCodeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!referenceCode.trim()) {
      try {
        if (toastContext) {
          toastContext.addToast(
            "Please enter a reference code to continue.", 
            "error", 
            "Reference Code Required"
          );
        } else {
          // Fallback to direct DOM method
          showToast(
            "Please enter a reference code to continue.", 
            "error", 
            "Reference Code Required"
          );
        }
      } catch (err) {
        console.error("Error showing toast:", err);
        alert("Please enter a reference code to continue.");
      }
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/reference-code?code=${encodeURIComponent(referenceCode.trim())}`);
      
      if (response.redirected) {
        // Follow the redirect
        router.push(response.url);
        return;
      }
      
      if (!response.ok) {
        // Handle HTTP error responses
        try {
          if (response.status === 404) {
            if (toastContext) {
              toastContext.addToast(
                "The reference code you entered was not found or has expired. Please check the code and try again.", 
                "error", 
                "Invalid Reference Code"
              );
            } else {
              // Fallback to direct DOM method
              showToast(
                "The reference code you entered was not found or has expired. Please check the code and try again.", 
                "error", 
                "Invalid Reference Code"
              );
            }
          } else {
            if (toastContext) {
              toastContext.addToast(
                "There was a problem processing your request. Please try again.", 
                "error", 
                "Error"
              );
            } else {
              // Fallback to direct DOM method
              showToast(
                "There was a problem processing your request. Please try again.", 
                "error", 
                "Error"
              );
            }
          }
        } catch (toastErr) {
          console.error("Error showing toast:", toastErr);
          alert("Invalid reference code or error processing your request. Please try again.");
        }
      }
    } catch (error) {
      console.error("Reference code error:", error);
      try {
        if (toastContext) {
          toastContext.addToast(
            "Unable to connect to the server. Please check your internet connection and try again.", 
            "error", 
            "Connection Error"
          );
        } else {
          // Fallback to direct DOM method
          showToast(
            "Unable to connect to the server. Please check your internet connection and try again.", 
            "error", 
            "Connection Error"
          );
        }
      } catch (toastErr) {
        console.error("Error showing toast:", toastErr);
        alert("Connection error. Please check your internet connection and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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

          {/* Reference Code Section */}
          <div className="md:col-span-2 bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-lg">
            <div className="h-12 w-12 rounded-full bg-[#3ECF8E]/20 flex items-center justify-center mb-6">
              <KeyRound className="h-6 w-6 text-[#3ECF8E]" />
            </div>
            <h2 className="text-2xl font-bold mb-4 text-slate-100">Have a Reference Code?</h2>
            <p className="text-slate-300 mb-6">
              Enter your reference code to access a specific session or support resource.
            </p>

            <form onSubmit={handleReferenceCodeSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Input
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="Enter your reference code"
                  className="flex-1 bg-slate-900 border-slate-700 text-slate-100"
                />
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-[#3ECF8E] hover:bg-[#3ECF8E]/90 text-slate-900"
                >
                  {isSubmitting ? (
                    <>
                      <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-t-transparent border-current"></span>
                      Processing...
                    </>
                  ) : (
                    'Continue'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-24 text-center">
          <h2 className="text-2xl font-bold mb-2 text-slate-100">How Meld Works</h2>
          <p className="text-slate-400 max-w-2xl mx-auto mb-12">
            We connect people in need with trained helpers through a secure, confidential platform.
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <div className="h-12 w-12 mx-auto rounded-full bg-[#3ECF8E]/20 flex items-center justify-center mb-4">
                <span className="font-bold text-[#3ECF8E]">1</span>
              </div>
              <h3 className="text-lg font-medium mb-2 text-slate-100">Get Connected</h3>
              <p className="text-slate-400 text-sm">
                Sign up and get matched with a trained helper who understands your needs.
              </p>
            </div>

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <div className="h-12 w-12 mx-auto rounded-full bg-[#3ECF8E]/20 flex items-center justify-center mb-4">
                <span className="font-bold text-[#3ECF8E]">2</span>
              </div>
              <h3 className="text-lg font-medium mb-2 text-slate-100">Receive Support</h3>
              <p className="text-slate-400 text-sm">
                Chat securely with your helper to get the support and guidance you need.
              </p>
            </div>

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <div className="h-12 w-12 mx-auto rounded-full bg-[#3ECF8E]/20 flex items-center justify-center mb-4">
                <span className="font-bold text-[#3ECF8E]">3</span>
              </div>
              <h3 className="text-lg font-medium mb-2 text-slate-100">Move Forward</h3>
              <p className="text-slate-400 text-sm">
                With the right support, take steps toward improved wellbeing and resilience.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-24 py-8 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="h-8 w-8">
                <img src="/logo.png" alt="Meld logo" className="h-full w-full object-contain" />
              </div>
              <span className="text-sm font-medium text-slate-400">© {new Date().getFullYear()} Meld</span>
            </div>
            <div className="flex gap-6">
              <Link href="#" className="text-sm text-slate-400 hover:text-slate-300">
                Privacy Policy
              </Link>
              <Link href="#" className="text-sm text-slate-400 hover:text-slate-300">
                Terms of Service
              </Link>
              <Link href="#" className="text-sm text-slate-400 hover:text-slate-300">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Main page component with Suspense boundary
export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-t-2 border-b-2 border-[#3ECF8E] animate-spin"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
