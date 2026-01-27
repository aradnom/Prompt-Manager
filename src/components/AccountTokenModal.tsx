import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AccountTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
}

export function AccountTokenModal({
  isOpen,
  onClose,
  token,
}: AccountTokenModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Your Account ID</DialogTitle>
          <DialogDescription className="text-base space-y-4 pt-4">
            <div className="text-magenta-light font-semibold">
              Write this down immediately!
            </div>
            <div>
              This is your unique Account ID. You'll need it to log in to your
              account. If you lose it, it cannot be retrieved.
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="my-6">
          <div className="font-mono text-3xl font-bold tracking-wider p-6 bg-cyan-dark/20 rounded-lg border-2 border-cyan-dark text-center">
            {token}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-cyan-medium">
            You can view your Account ID later on the{" "}
            <Link
              to="/account"
              className="text-magenta-medium hover:text-magenta-light underline"
            >
              Account page
            </Link>
            .
          </p>

          <div className="flex justify-end">
            <Button onClick={onClose} variant="default">
              I've Written It Down
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
