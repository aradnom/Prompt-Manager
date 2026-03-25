import { useState } from "react";
import { api } from "@/lib/api";
import { RasterIcon } from "@/components/RasterIcon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function FeedbackForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const submitMutation = api.users.submitFeedback.useMutation({
    onSuccess: () => {
      setSent(true);
      setTimeout(() => {
        setIsOpen(false);
        setEmail("");
        setMessage("");
        setSent(false);
      }, 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMutation.mutate({
      message,
      ...(email ? { email } : {}),
    });
  };

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setIsOpen(true)}
              className="fixed bottom-5 right-5 z-50 opacity-75 transition-opacity hover:opacity-100 cursor-pointer"
            >
              <RasterIcon name="bullhorn" size={20} opacity={0.8} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Send Feedback</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
          </DialogHeader>

          {sent ? (
            <p className="text-cyan-light py-4 text-center">
              Thanks for your feedback!
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="feedback-email"
                  className="block text-sm text-cyan-medium mb-1"
                >
                  Email <span className="text-cyan-medium/60">(optional)</span>
                </label>
                <input
                  id="feedback-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-transparent border border-cyan-medium rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-magenta-medium"
                />
              </div>

              <div>
                <label
                  htmlFor="feedback-message"
                  className="block text-sm text-cyan-medium mb-1"
                >
                  Message
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={5}
                  maxLength={5000}
                  className="w-full resize-none bg-transparent border border-cyan-medium rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-magenta-medium"
                  autoFocus
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={!message.trim() || submitMutation.isPending}
                >
                  {submitMutation.isPending ? "Sending..." : "Send"}
                </Button>
              </div>

              {submitMutation.isError && (
                <p className="text-red-400 text-sm">
                  Something went wrong. Please try again.
                </p>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
