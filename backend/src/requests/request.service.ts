import { HttpError } from "../errors/http-error.js";
import type { ConnectionRepository } from "../connections/connection.repository.js";
import type { UserRepository } from "../users/user.repository.js";
import type { ResourceRepository } from "../resources/resource.repository.js";
import type { RequestRepository } from "./request.repository.js";

import { toRequestSummary } from "./request.repository.js";
import type { CreateRequestInput, RequestStatus, UpdateReferralInput, UpdateRequestInput } from "./request.types.js";

type RequestServiceDependencies = {
  requestRepository: RequestRepository;
  userRepository: UserRepository;
  resourceRepository: ResourceRepository;
  connectionRepository: ConnectionRepository;
};

class RequestService {
  constructor(private readonly deps: RequestServiceDependencies) {}

  async create(input: CreateRequestInput) {
    await this.assertUserExists(input.requester_id, "Requester not found");
    await this.assertUserExists(input.owner_id, "Owner not found");

    const resource = await this.deps.resourceRepository.findById(input.resource_id);
    if (!resource) {
      throw new HttpError(404, "Resource not found");
    }

    if (resource.owner_id !== input.owner_id) {
      throw new HttpError(400, "Resource does not belong to the specified owner");
    }

    if (resource.status !== "active" || !resource.request_enabled || resource.visibility === "private") {
      throw new HttpError(403, "This resource cannot accept requests");
    }

    const connection = await this.deps.connectionRepository.findActiveBetweenUsers(input.requester_id, input.owner_id);
    if (connection?.status === "blocked") {
      throw new HttpError(403, "Blocked connections cannot request resources");
    }
    const intermediaryId = connection?.status === "accepted"
      ? null
      : await this.findMutualFriend(input.requester_id, input.owner_id);
    if (!connection && !intermediaryId) throw new HttpError(403, "Only direct friends or friends-of-friends can request this resource");
    if (intermediaryId && resource.visibility !== "network") throw new HttpError(403, "This resource is not available beyond direct friends");

    const request = await this.deps.requestRepository.create({
      requester_id: input.requester_id,
      owner_id: input.owner_id,
      resource_id: input.resource_id,
      intermediary_id: intermediaryId,
      message: input.message ?? "",
    });

    return { request: toRequestSummary(request) };
  }

  async listIncoming(ownerId: string) {
    await this.assertUserExists(ownerId);
    const requests = await this.deps.requestRepository.listIncoming(ownerId);
    return { requests: requests.map(toRequestSummary) };
  }

  async listOutgoing(requesterId: string) {
    await this.assertUserExists(requesterId);
    const requests = await this.deps.requestRepository.listOutgoing(requesterId);
    return { requests: requests.map(toRequestSummary) };
  }

  async listReferral(intermediaryId: string) {
    await this.assertUserExists(intermediaryId);
    const requests = await this.deps.requestRepository.listReferral(intermediaryId);
    return { requests: requests.map(toRequestSummary) };
  }

  async update(id: string, input: UpdateRequestInput) {
    const request = await this.deps.requestRepository.findById(id);
    if (!request) {
      throw new HttpError(404, "Request not found");
    }

    if (request.owner_id !== input.user_id) {
      throw new HttpError(403, "Only the owner can update this request");
    }

    if (request.intermediary_id && request.referral_status !== "approved") {
      throw new HttpError(409, "The mutual friend must approve this referral first");
    }

    if (!isValidStatus(input.status)) {
      throw new HttpError(400, "status must be one of: pending, approved, declined, ignored");
    }

    const updated = await this.deps.requestRepository.update(id, input);
    return { request: toRequestSummary(updated) };
  }

  async updateReferral(id: string, input: UpdateReferralInput) {
    const request = await this.deps.requestRepository.findById(id);
    if (!request) throw new HttpError(404, "Request not found");
    if (request.intermediary_id !== input.user_id) throw new HttpError(403, "Only the mutual friend can decide this referral");
    if (!["approved", "declined", "ignored"].includes(input.referral_status)) throw new HttpError(400, "Invalid referral status");
    const updated = await this.deps.requestRepository.updateReferral(id, input);
    return { request: toRequestSummary(updated) };
  }

  async revealContact(id: string, userId: string, customMessage?: string) {
    const request = await this.deps.requestRepository.findById(id);
    if (!request) {
      throw new HttpError(404, "Request not found");
    }

    if (request.owner_id !== userId && request.requester_id !== userId) {
      throw new HttpError(403, "Only request participants can access contact handoff");
    }

    if (request.status !== "approved") {
      throw new HttpError(409, "Contact handoff requires an approved request");
    }

    const contactUserId = request.owner_id === userId ? request.requester_id : request.owner_id;
    const contact = await this.deps.userRepository.findById(contactUserId);
    if (!contact || contact.status !== "active") {
      throw new HttpError(404, "Contact user not found");
    }

    const message = customMessage?.trim() || `Hi ${contact.display_name}, I’m reaching out through Card Crew about a card request.`;
    const phoneDigits = contact.phone?.replace(/\D/g, "") ?? "";
    return {
      contact: {
        id: contact.id,
        display_name: contact.display_name,
        email: contact.email,
        phone: contact.phone,
        whatsapp_url: phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}` : null,
        whatsapp_message: message,
      },
    };
  }

  private async findMutualFriend(requesterId: string, ownerId: string): Promise<string | null> {
    const requesterConnections = await this.deps.connectionRepository.listByUser(requesterId, "accepted");
    for (const connection of requesterConnections) {
      const candidate = connection.requester_id === requesterId ? connection.addressee_id : connection.requester_id;
      if (candidate === ownerId) continue;
      const ownerConnection = await this.deps.connectionRepository.findActiveBetweenUsers(candidate, ownerId);
      if (ownerConnection?.status === "accepted") return candidate;
    }
    return null;
  }

  private async assertUserExists(userId: string, message = "User not found"): Promise<void> {
    const user = await this.deps.userRepository.findById(userId);
    if (!user) {
      throw new HttpError(404, message);
    }
  }
}

function isValidStatus(status: string): status is RequestStatus {
  return ["pending", "approved", "declined", "ignored"].includes(status);
}

export { RequestService };
