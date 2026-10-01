import React from "react";

interface UserSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  isSearching?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function UserSearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search users by name or username...",
  isSearching = false,
  className = "",
  autoFocus = false,
}: UserSearchInputProps) {
  function handleClear() {
    onChange("");
    if (onClear) {
      onClear();
    }
  }

  return (
    <div className={`network-search-input-wrap ${className}`}>
      <input
        className="network-search-input"
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        aria-label="Search users"
      />
      {value && (
        <button
          type="button"
          className="button-secondary"
          style={{ minHeight: "50px", minWidth: "70px" }}
          onClick={handleClear}
          aria-label="Clear search query"
        >
          Clear
        </button>
      )}
      {isSearching && (
        <span
          style={{
            position: "absolute",
            right: value ? "85px" : "16px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.85rem",
            color: "var(--ink-500)",
            pointerEvents: "none",
          }}
        >
          Searching...
        </span>
      )}
    </div>
  );
}
