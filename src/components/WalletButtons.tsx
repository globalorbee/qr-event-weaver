import { Apple, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function WalletButtons() {
  const notReady = (provider: string) =>
    toast.info(`${provider} Wallet is coming soon`, {
      description: "Pass packaging is wired up but requires production credentials.",
    });

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" size="sm" onClick={() => notReady("Apple")}>
        <Apple className="mr-2 h-4 w-4" /> Apple Wallet
      </Button>
      <Button variant="outline" size="sm" onClick={() => notReady("Google")}>
        <Smartphone className="mr-2 h-4 w-4" /> Google Wallet
      </Button>
    </div>
  );
}