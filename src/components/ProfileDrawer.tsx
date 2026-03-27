import { LogOut, Settings, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileDrawer({ open, onOpenChange }: Props) {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-80 bg-background p-6">
        <SheetHeader className="text-left">
          <SheetTitle className="font-playfair text-lg font-semibold text-foreground">
            Profile
          </SheetTitle>
          <SheetDescription className="font-inter text-xs text-muted-foreground">
            {user?.email ?? "—"}
          </SheetDescription>
        </SheetHeader>

        <Separator className="my-5" />

        <nav className="flex flex-col gap-1">
          <Button
            variant="ghost"
            className="justify-start gap-2.5 font-inter text-sm text-foreground"
          >
            <Settings className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            Profile Settings
          </Button>

          <Button
            variant="ghost"
            className="justify-start gap-2.5 font-inter text-sm text-foreground"
          >
            <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            Travel Network
          </Button>
        </nav>

        <Separator className="my-5" />

        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start gap-2.5 font-inter text-sm text-destructive hover:text-destructive"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          Sign Out
        </Button>
      </SheetContent>
    </Sheet>
  );
}
