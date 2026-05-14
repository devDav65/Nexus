import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-muted rounded-md", className)} />;
}

export function SkeletonConversation() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="w-12 h-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2.5 w-10" />
        </div>
        <Skeleton className="h-2.5 w-44" />
      </div>
    </div>
  );
}

export function SkeletonMessage({ isOwn = false }: { isOwn?: boolean }) {
  return (
    <div className={cn("flex items-end gap-2 mb-1", isOwn && "flex-row-reverse")}>
      {!isOwn && <Skeleton className="w-7 h-7 rounded-full shrink-0" />}
      <Skeleton className={cn("h-9 rounded-2xl", isOwn ? "w-36 rounded-br-sm" : "w-48 rounded-bl-sm")} />
    </div>
  );
}
