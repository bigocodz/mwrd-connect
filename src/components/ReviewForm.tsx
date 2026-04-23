import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@cvx/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Star } from "lucide-react";

interface ReviewFormProps {
  supplierId: string;
  orderId?: string;
  onSubmitted?: () => void;
}

const ReviewForm = ({ supplierId, orderId, onSubmitted }: ReviewFormProps) => {
  const createReview = useMutation(api.reviews.create);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    setSubmitting(true);
    try {
      await createReview({
        supplier_id: supplierId as any,
        order_id: orderId || undefined,
        rating,
        comment: comment || undefined,
      });
      toast.success("Review submitted! Thank you.");
      onSubmitted?.();
    } catch (err: any) {
      toast.error("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Rate your experience</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Rating</Label>
          <div className="flex gap-1 mt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(i)}
                className="focus:outline-none"
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    i <= (hover || rating) ? "fill-primary text-primary" : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Comment (optional)</Label>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience…"
          />
        </div>
        <Button onClick={handleSubmit} disabled={submitting || rating === 0}>
          {submitting ? "Submitting…" : "Submit Review"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ReviewForm;
