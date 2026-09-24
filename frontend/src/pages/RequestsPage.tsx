import { useEffect, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/apiClient";
import { resolveDisplayName } from "../lib/resolveNames";
import type { CardCatalogSummary, ContactInfo, RequestStatus, RequestSummary } from "../types/api";

type EnrichedRequest = RequestSummary & {
  counterpartyName: string;
  cardLabel: string;
};

// wa.me needs digits only (no "+"); building this client-side keeps the phone number out of
// SQL entirely (see issue #3 plan — reveal_contact returns raw phone + message, nothing else).
function toWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}

function RequestsPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<"incoming" | "outgoing" | "referrals">("incoming");
  const [incoming, setIncoming] = useState<EnrichedRequest[]>([]);
  const [outgoing, setOutgoing] = useState<EnrichedRequest[]>([]);
  const [referrals, setReferrals] = useState<EnrichedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contactByRequestId, setContactByRequestId] = useState<Record<string, ContactInfo>>({});
  const [messageByRequestId, setMessageByRequestId] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  async function enrich(
    requests: RequestSummary[],
    counterpartyOf: (r: RequestSummary) => string,
    cardsLookup: Map<string, CardCatalogSummary>,
  ) {
    return Promise.all(
      requests.map(async (req) => {
        const counterpartyName = await resolveDisplayName(counterpartyOf(req));
        let cardLabel = "A card";

        try {
          const { resource } = await api.getResource(req.resource_id);
          const card = cardsLookup.get(resource.catalog_item_id);
          cardLabel = card ? `${card.issuer} ${card.product_name}` : resource.catalog_item_id;
        } catch {
          // resource may no longer be viewable; keep the fallback label
        }

        return { ...req, counterpartyName, cardLabel };
      }),
    );
  }

  async function loadAll() {
    if (!profile) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [{ cards: catalogCards }, { requests: all }] = await Promise.all([
        api.getCatalogCards(),
        api.getRequests(),
      ]);
      const cardsLookup = new Map(catalogCards.map((card) => [card.id, card]));

      const [incomingEnriched, outgoingEnriched, referralEnriched] = await Promise.all([
        enrich(all.filter((r) => r.owner_id === profile.id), (r) => r.requester_id, cardsLookup),
        enrich(all.filter((r) => r.requester_id === profile.id), (r) => r.owner_id, cardsLookup),
        enrich(all.filter((r) => r.intermediary_id === profile.id), (r) => r.requester_id, cardsLookup),
      ]);

      setIncoming(incomingEnriched);
      setOutgoing(outgoingEnriched);
      setReferrals(referralEnriched);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Failed to load requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function handleStatusChange(request: EnrichedRequest, status: RequestStatus) {
    if (!profile) {
      return;
    }

    setActionError(null);

    try {
      await api.respondToRequest(request.id, status);
      await loadAll();
    } catch (statusError) {
      setActionError(statusError instanceof ApiError ? statusError.message : "Failed to update request");
    }
  }

  async function handleViewContact(request: EnrichedRequest) {
    if (!profile) {
      return;
    }

    setActionError(null);

    try {
      const { contact } = await api.revealContact(request.id, messageByRequestId[request.id]);
      setContactByRequestId((prev) => ({ ...prev, [request.id]: contact }));
    } catch (contactError) {
      setActionError(contactError instanceof ApiError ? contactError.message : "Failed to load contact");
    }
  }

  async function handleReferralStatus(request: EnrichedRequest, status: "approved" | "declined" | "ignored") {
    if (!profile) return;
    setActionError(null);
    try {
      await api.respondToReferral(request.id, status);
      await loadAll();
    } catch (referralError) {
      setActionError(referralError instanceof ApiError ? referralError.message : "Failed to update referral");
    }
  }

  const activeList = tab === "incoming" ? incoming : tab === "outgoing" ? outgoing : referrals;

  return (
    <div className="page">
      <h1>Requests</h1>

      <div className="tab-bar">
        <button
          type="button"
          className={tab === "incoming" ? "tab-active" : ""}
          onClick={() => setTab("incoming")}
        >
          Incoming
        </button>
        <button
          type="button"
          className={tab === "outgoing" ? "tab-active" : ""}
          onClick={() => setTab("outgoing")}
        >
          Outgoing
        </button>
        <button
          type="button"
          className={tab === "referrals" ? "tab-active" : ""}
          onClick={() => setTab("referrals")}
        >
          Referrals{referrals.length ? ` (${referrals.length})` : ""}
        </button>
      </div>

      {loading && <p className="page-status">Loading requests...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}

      {!loading && activeList.length === 0 && (
        <p className="empty-state">
          {tab === "incoming" ? "No incoming requests." : tab === "outgoing" ? "No outgoing requests." : "No referral requests."}
        </p>
      )}

      <ul className="request-list">
        {activeList.map((request) => {
          const contact = contactByRequestId[request.id];

          return (
            <li key={request.id}>
              <div className="request-meta">
                <strong>{request.counterpartyName}</strong>
                <span>{request.cardLabel}</span>
                <span className={`badge badge-${request.status}`}>{request.status}</span>
              </div>

              {request.message && <p>&quot;{request.message}&quot;</p>}

              {tab === "referrals" && request.referral_status === "pending" && (
                <div className="request-actions">
                  <button type="button" onClick={() => void handleReferralStatus(request, "approved")}>Refer requester</button>
                  <button className="button-secondary" type="button" onClick={() => void handleReferralStatus(request, "declined")}>Decline referral</button>
                </div>
              )}

              {tab === "incoming" && request.status === "pending" && (
                <div className="request-actions">
                  <button type="button" onClick={() => void handleStatusChange(request, "approved")}>
                    Approve
                  </button>
                  <button type="button" onClick={() => void handleStatusChange(request, "declined")}>
                    Decline
                  </button>
                  <button type="button" onClick={() => void handleStatusChange(request, "ignored")}>
                    Ignore
                  </button>
                </div>
              )}

              {tab !== "referrals" && request.status === "approved" && !contact && (
                <div className="handoff-panel">
                  <label>
                    WhatsApp message <span className="label-optional">optional</span>
                    <textarea
                      rows={3}
                      value={messageByRequestId[request.id] ?? ""}
                      placeholder="Hi, I’m reaching out through Card Crew about a card request."
                      onChange={(event) => setMessageByRequestId((current) => ({ ...current, [request.id]: event.target.value }))}
                    />
                  </label>
                  <button type="button" onClick={() => void handleViewContact(request)}>Prepare contact handoff</button>
                </div>
              )}

              {contact && (
                <p className="form-success">
                  Contact details available: {contact.display_name}
                  {contact.phone ? ` (${contact.phone})` : ""}
                  {contact.phone && (
                    <>
                      <br />
                      <a href={toWhatsAppUrl(contact.phone, contact.whatsapp_message)} target="_blank" rel="noreferrer">
                        Open WhatsApp with message
                      </a>
                    </>
                  )}
                </p>
              )}

              {request.status === "declined" && <p className="empty-state">Contact details hidden.</p>}
              {request.status === "ignored" && <p className="empty-state">This request was not answered.</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { RequestsPage };
