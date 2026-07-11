import React from "react";
import { cn } from "../../lib/utils";

const Button = React.forwardRef(({ className, variant = "primary", size = "default", ...props }, ref) => {
  const baseStyles = "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-blue-900 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-md",
    danger: "bg-accent-danger text-white hover:bg-red-700 rounded-md",
    success: "bg-accent-success text-white hover:bg-green-700 rounded-md",
    outline: "border border-slate-200 bg-white hover:bg-slate-100 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:text-slate-100 rounded-md",
    ghost: "hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100 rounded-md",
  };
  
  const sizes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 px-3",
    lg: "h-11 px-8",
    icon: "h-10 w-10",
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      ref={ref}
      {...props}
    />
  );
});

Button.displayName = "Button";
export { Button };
