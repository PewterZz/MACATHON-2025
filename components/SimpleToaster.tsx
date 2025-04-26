"use client";

import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
}

export interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: ToastType, title?: string) => void;
  removeToast: (id: string) => void;
}

// Create a Set to track toast messages that have been shown recently to prevent duplicates
const recentToasts = new Set<string>();

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function SimpleToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addToast = useCallback((message: string, type: ToastType = 'info', title?: string) => {
    // Create a unique key for this toast message to prevent duplicates
    const toastKey = `${type}:${title || ''}:${message}`;
    
    // Check if this toast was recently shown (within the last 5 seconds)
    if (recentToasts.has(toastKey)) {
      console.log('Preventing duplicate toast:', toastKey);
      return;
    }
    
    // Add this toast to the recent toasts set
    recentToasts.add(toastKey);
    
    // Remove from recent toasts after 5 seconds
    setTimeout(() => {
      recentToasts.delete(toastKey);
    }, 5000);
    
    const id = Math.random().toString(36).substring(2, 9);
    
    // Clean up any existing timeout for this ID (shouldn't happen, but just in case)
    if (toastsRef.current.has(id)) {
      clearTimeout(toastsRef.current.get(id)!);
      toastsRef.current.delete(id);
    }
    
    setToasts((prevToasts) => [...prevToasts, { id, message, type, title }]);
    
    // Store the timeout reference
    const timeoutId = setTimeout(() => {
      setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
      toastsRef.current.delete(id);
    }, 5000);
    
    toastsRef.current.set(id, timeoutId);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
    
    // Clear the timeout if it exists
    if (toastsRef.current.has(id)) {
      clearTimeout(toastsRef.current.get(id)!);
      toastsRef.current.delete(id);
    }
  }, []);
  
  // Clear all timeouts when component unmounts
  useEffect(() => {
    return () => {
      toastsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      toastsRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <SimpleToaster />
    </ToastContext.Provider>
  );
}

export function useSimpleToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useSimpleToast must be used within a SimpleToastProvider');
  }
  return context;
}

function SimpleToaster() {
  const { toasts, removeToast } = useContext(ToastContext)!;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-md shadow-lg p-4 min-w-[300px] max-w-md ${
            toast.type === 'error' ? 'bg-red-600 text-white border-red-800' :
            toast.type === 'success' ? 'bg-green-600 text-white border-green-800' :
            toast.type === 'warning' ? 'bg-amber-500 text-white border-amber-700' :
            'bg-slate-700 text-white border-slate-800'
          } border-l-4`}
          style={{
            animation: 'fadeIn 0.3s ease-in-out'
          }}
        >
          <div className="flex justify-between items-start">
            {toast.title && (
              <h3 className="font-bold">{toast.title}</h3>
            )}
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-auto text-sm text-white/80 hover:text-white"
            >
              ×
            </button>
          </div>
          <p className="text-sm mt-1">{toast.message}</p>
        </div>
      ))}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// Track recently shown direct DOM toasts to prevent duplicates
const recentDomToasts = new Set<string>();

export function showToast(message: string, type: ToastType = 'info', title?: string) {
  try {
    // Create a unique key for this toast message to prevent duplicates
    const toastKey = `${type}:${title || ''}:${message}`;
    
    // Check if this toast was recently shown (within the last 5 seconds)
    if (recentDomToasts.has(toastKey)) {
      console.log('Preventing duplicate DOM toast:', toastKey);
      return;
    }
    
    // Add this toast to the recent toasts set
    recentDomToasts.add(toastKey);
    
    // Remove from recent toasts after 5 seconds
    setTimeout(() => {
      recentDomToasts.delete(toastKey);
    }, 5000);
    
    // Fallback for non-React contexts or component tree issues
    // Create a temporary div to show a toast
    const toastId = Math.random().toString(36).substring(2, 9);
    const container = document.createElement('div');
    container.id = `simple-toast-${toastId}`;
    container.style.position = 'fixed';
    container.style.bottom = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.minWidth = '300px';
    container.style.maxWidth = '400px';
    container.style.padding = '16px';
    container.style.borderRadius = '8px';
    container.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    container.style.animation = 'fadeIn 0.3s ease-in-out';
    
    // Set color based on type
    if (type === 'error') {
      container.style.backgroundColor = '#dc2626';
      container.style.borderLeft = '4px solid #991b1b';
      container.style.color = 'white';
    } else if (type === 'success') {
      container.style.backgroundColor = '#16a34a';
      container.style.borderLeft = '4px solid #166534';
      container.style.color = 'white';
    } else if (type === 'warning') {
      container.style.backgroundColor = '#f59e0b';
      container.style.borderLeft = '4px solid #b45309';
      container.style.color = 'white';
    } else {
      container.style.backgroundColor = '#334155';
      container.style.borderLeft = '4px solid #1e293b';
      container.style.color = 'white';
    }
    
    // Create title if provided
    if (title) {
      const titleElement = document.createElement('h3');
      titleElement.textContent = title;
      titleElement.style.fontWeight = 'bold';
      titleElement.style.marginBottom = '4px';
      container.appendChild(titleElement);
    }
    
    // Create message
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    messageElement.style.fontSize = '0.875rem';
    container.appendChild(messageElement);
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.top = '12px';
    closeButton.style.right = '12px';
    closeButton.style.background = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '1.25rem';
    closeButton.style.color = 'rgba(255, 255, 255, 0.8)';
    closeButton.style.cursor = 'pointer';
    
    closeButton.onclick = () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
    
    container.appendChild(closeButton);
    document.body.appendChild(container);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }, 5000);
    
    // Add fade-in keyframes
    if (!document.getElementById('toast-animation-style')) {
      const style = document.createElement('style');
      style.id = 'toast-animation-style';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `;
      document.head.appendChild(style);
    }
  } catch (error) {
    console.error('Error showing toast:', error);
    // Ultimate fallback - use alert() instead
    try {
      alert(`${title ? title + ': ' : ''}${message}`);
    } catch (alertError) {
      console.error('Even alert failed:', alertError);
    }
  }
} 