import { cn } from "../lib/utils";

export function LoadingState({ message = "Loading...", className = "", minHeight = "min-h-[400px]" }) {
  return (
    <div className={cn("flex items-center justify-center", minHeight, className)}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
