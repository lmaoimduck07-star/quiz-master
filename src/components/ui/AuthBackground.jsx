// src/components/ui/AuthBackground.jsx
// Nền gradient mesh + blur blob dùng chung cho Login & Register
import React from 'react';

export default function AuthBackground() {
  return (
    <>
      {/* Gradient mesh background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-blue-950/20 dark:to-indigo-950/10 -z-10" />

      {/* Animated blur blobs */}
      <div
        className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full -z-10 opacity-30 dark:opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'blobFloat 8s ease-in-out infinite alternate',
        }}
      />
      <div
        className="fixed bottom-[-15%] right-[-5%] w-[450px] h-[450px] rounded-full -z-10 opacity-25 dark:opacity-15"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'blobFloat 10s ease-in-out infinite alternate-reverse',
        }}
      />
      <div
        className="fixed top-[40%] right-[20%] w-[300px] h-[300px] rounded-full -z-10 opacity-20 dark:opacity-10"
        style={{
          background: 'radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%)',
          filter: 'blur(50px)',
          animation: 'blobFloat 12s ease-in-out 2s infinite alternate',
        }}
      />

      <style>{`
        @keyframes blobFloat {
          from { transform: translate(0, 0) scale(1); }
          to   { transform: translate(20px, -20px) scale(1.05); }
        }
      `}</style>
    </>
  );
}

