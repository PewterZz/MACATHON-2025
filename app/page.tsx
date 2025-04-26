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
          <div className="md:col-span-2 grid md:grid-cols-2 gap-8">
            <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-lg">
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
            
            {/* Contact Info Section - Simple highlighted text */}
            <div className="flex flex-col justify-center p-6 mt-4 md:mt-0">
              <h2 className="text-2xl font-bold mb-4 text-[#3ECF8E]">Contact Us Directly</h2>
              <p className="text-slate-300 mb-6">
                Contacting any of these options connects you with MeldyAI, which creates an anonymous request and provides you with a reference code for secure follow-up.
              </p>
              <div className="space-y-4">
                <div className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 mr-3 mt-1"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"></path><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z"></path><path d="M13 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1Z"></path><path d="M9 14a3 3 0 0 0 6 0"></path></svg>
                  <div>
                    <p className="text-white font-medium">WhatsApp</p>
                    <a href="https://wa.me/61483901943" className="text-green-400 hover:underline">+61 483 901 943</a>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 mr-3 mt-1"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  <div>
                    <p className="text-white font-medium">Voice Call</p>
                    <a href="tel:+61483901943" className="text-blue-400 hover:underline">+61 483 901 943</a>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <svg width="20" height="20" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500 mr-3 mt-1">
                    <g clipPath="url(#clip0)">
                      <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" fill="currentColor"/>
                    </g>
                    <defs>
                      <clipPath id="clip0">
                        <rect width="71" height="55" fill="currentColor"/>
                      </clipPath>
                    </defs>
                  </svg>
                  <div>
                    <p className="text-white font-medium">Discord</p>
                    <a href="https://discord.gg/meld-community" className="text-indigo-400 hover:underline">Join our server</a> or 
                    <a href="https://discord.com/oauth2/authorize?client_id=123456789&scope=bot&permissions=8" className="text-indigo-400 hover:underline ml-1">add Meldy to yours</a>
                  </div>
                </div>
              </div>
            </div>
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
