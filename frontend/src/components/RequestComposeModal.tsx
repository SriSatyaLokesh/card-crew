import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { api, ApiError } from "../lib/apiClient";

type RequestComposeModalProps = {
  requesterId: string;
  ownerId: string;
  ownerName: string;
  resourceId: string;
  cardLabel: string;
  onClose: () => void;
  onSent: () => void;
};

function RequestComposeModal({
  requesterId,
  ownerId,
  ownerName,
  resourceId,
  cardLabel,
  onClose,
  onSent,
}: RequestComposeModalProps) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageFieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messageFieldRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.createRequest({
        requester_id: requesterId,
        owner_id: ownerId,
        resource_id: resourceId,
        message: message.trim() || undefined,
      });
      onSent();
    } catch (submitError) {
      setError(submitError instanceof ApiError ? submitError.message : "Failed to send request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="request-compose-title">
      <div className="modal">
        <h2 id="request-compose-title">Request help</h2>
        <p>
          Ask {ownerName} for help with {cardLabel}.
        </p>
          <p className="modal-helper">If this is a friend-of-friend request, the mutual friend decides whether to refer you first.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Message (optional)
            <textarea
              ref={messageFieldRef}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              placeholder="I need help with an offer..."
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}>
              {submitting ? "Sending..." : "Send request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { RequestComposeModal };
