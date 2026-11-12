import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { submitAiAnswerFeedback } from "@/lib/ai-answer-feedback.functions";

export function AiAnswerFeedback({ messageId }: { messageId: string }) {
  const submitFeedback = useServerFn(submitAiAnswerFeedback);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState<"accurate" | "incorrect" | null>(null);

  async function save(value: "accurate" | "incorrect") {
    if (busy) return;
    setBusy(true);
    try {
      await submitFeedback({ data: { messageId, rating: value, reason: value === "incorrect" ? reason : "" } });
      setRating(value);
      setShowReason(false);
      toast.success("AI feedback saved. Thank you!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save feedback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border/50 pt-3" aria-label="AI answer feedback">
      <p className="text-xs text-muted-foreground">Was this AI answer accurate and helpful?</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => save("accurate")}
          aria-pressed={rating === "accurate"}>
          <ThumbsUp className="size-3.5" /> Accurate / Helpful
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setShowReason((prev) => !prev)}
          aria-pressed={rating === "incorrect"}>
          <ThumbsDown className="size-3.5" /> Report Incorrect
        </Button>
      </div>
      {showReason && (
        <div className="space-y-2">
          <label htmlFor={`ai-feedback-${messageId}`} className="text-xs font-medium">What should be corrected? (optional)</label>
          <Textarea id={`ai-feedback-${messageId}`} maxLength={800} rows={2} value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain what seems wrong. Avoid including passwords or private data." />
          <Button type="button" size="sm" disabled={busy} onClick={() => save("incorrect")}>
            {busy ? "Saving…" : "Submit feedback"}
          </Button>
        </div>
      )}
      {rating && <p role="status" className="text-xs text-muted-foreground">Feedback saved. You can change your rating.</p>}
    </div>
  );
}
