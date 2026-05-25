import { Link, useNavigate } from "@tanstack/react-router";
import { QrCode, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ backgroundColor: "#4F39F6" }}>
            <QrCode className="h-5 w-5 text-white" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-white">Passly</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">Dashboard</Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/10 hover:text-white"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link to="/login">
              <Button size="sm" style={{ backgroundColor: "#4F39F6", color: "#fff" }}>Sign in</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}