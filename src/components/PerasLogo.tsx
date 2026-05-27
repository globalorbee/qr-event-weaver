import { cn } from "@/lib/utils";

export function PerasLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9 32V8h13.2C29.8 8 35 12.7 35 19.1 35 25.4 29.8 30 22.2 30h-4.7v-7.2h4.2c3.4 0 5.4-1.4 5.4-3.8 0-2.3-2-3.7-5.4-3.7H17v16.8H9Z"
        fill="currentColor"
      />
      <path d="M20.5 8H31L17 32H6.5L20.5 8Z" fill="currentColor" opacity="0.38" />
    </svg>
  );
}