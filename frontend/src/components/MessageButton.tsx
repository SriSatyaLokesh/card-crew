import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/apiClient";

export interface MessageButtonProps {
  recipientUserId: string;
  recipientName?: string;
  variant?: "button" | "icon" | "compact";
  className?: string;
  onSuccess?: (chatId: string) => void;
  ariaLabel?: string;
}

export function MessageButton({
  recipientUserId,
  recipientName,
  variant = "button",
  className = "",
  onSuccess,
  ariaLabel,
}: MessageButtonProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (isLoading) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const chatId = await api.getOrCreateDirectChat(recipientUserId);

      if (onSuccess) {
        onSuccess(chatId);
      }

      navigate(`/messages?chat=${chatId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to open conversation";
      setErrorMessage(msg);
      console.error("[MessageButton] Error creating/opening chat:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const label = ariaLabel || `Message ${recipientName || "user"}`;

  if (variant === "icon") {
    return (
      <button
        type="button"
        className={`message-action-btn message-icon-btn ${className}`}
        onClick={handleClick}
        disabled={isLoading}
        title={errorMessage || label}
        aria-label={label}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "6px 8px",
          background: "rgba(59, 130, 246, 0.12)",
          border: "1px solid rgba(59, 130, 246, 0.25)",
          borderRadius: "8px",
          color: "#3b82f6",
          cursor: isLoading ? "not-allowed" : "pointer",
          fontSize: "0.875rem",
          fontWeight: 600,
          transition: "all 0.15s ease",
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        <span aria-hidden="true" style={{ fontSize: "1rem", lineHeight: 1 }}>💬</span>
      </button>
    );
  }

  if (variant === "compact") {
    return (
      <button
        type="button"
        className={`message-action-btn message-compact-btn ${className}`}
        onClick={handleClick}
        disabled={isLoading}
        title={errorMessage || label}
        aria-label={label}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 10px",
          background: "rgba(59, 130, 246, 0.15)",
          border: "1px solid rgba(59, 130, 246, 0.3)",
          borderRadius: "6px",
          color: "#2563eb",
          fontSize: "0.8rem",
          fontWeight: 600,
          cursor: isLoading ? "not-allowed" : "pointer",
          transition: "all 0.15s ease",
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        <span aria-hidden="true">💬</span>
        <span>{isLoading ? "Opening..." : "Message"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`message-action-btn ${className}`}
      onClick={handleClick}
      disabled={isLoading}
      title={errorMessage || label}
      aria-label={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: "8px 14px",
        background: "linear-gradient(135deg, #3b82f6, #2563eb)",
        color: "#ffffff",
        border: "none",
        borderRadius: "8px",
        fontSize: "0.875rem",
        fontWeight: 600,
        cursor: isLoading ? "not-allowed" : "pointer",
        boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
        transition: "all 0.15s ease",
        opacity: isLoading ? 0.7 : 1,
      }}
    >
      <span aria-hidden="true">💬</span>
      <span>{isLoading ? "Opening..." : "Message"}</span>
    </button>
  );
}
