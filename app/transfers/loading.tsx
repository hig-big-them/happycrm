import { Loader2 } from "lucide-react";

export default function TransfersLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-150px)]">
      <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
      <p className="text-lg text-muted-foreground">Transferler yükleniyor...</p>
    </div>
  );
} 