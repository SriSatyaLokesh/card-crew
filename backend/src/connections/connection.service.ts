import { HttpError } from "../errors/http-error.js";

import { toConnectionSummary } from "./connection.types.js";
import type {
  ConnectionActorInput,
  ConnectionRecord,
  ConnectionStatus,
  ConnectionSummary,
  CreateConnectionInput,
  ListConnectionsInput,
} from "./connection.types.js";
import type { ConnectionRepository } from "./connection.repository.js";
import type { UserRepository } from "../users/user.repository.js";

type ConnectionServiceDependencies = {
  connectionRepository: ConnectionRepository;
  userRepository: UserRepository;
};

class ConnectionService {
  private readonly connectionRepository: ConnectionRepository;
  private readonly userRepository: UserRepository;

  constructor({ connectionRepository, userRepository }: ConnectionServiceDependencies) {
    this.connectionRepository = connectionRepository;
    this.userRepository = userRepository;
  }

  async sendRequest(input: CreateConnectionInput): Promise<ConnectionSummary> {
    if (input.requester_id === input.addressee_id) {
      throw new HttpError(400, "You cannot send a connection request to yourself");
    }

    await this.assertUserExists(input.requester_id, "Requester not found");
    await this.assertUserExists(input.addressee_id, "Addressee not found");

    const existingConnection = await this.connectionRepository.findActiveBetweenUsers(
      input.requester_id,
      input.addressee_id,
    );

    if (existingConnection) {
      throw this.createDuplicateConnectionError(existingConnection.status);
    }

    const connection = await this.connectionRepository.create({
      requester_id: input.requester_id,
      addressee_id: input.addressee_id,
      status: "pending",
    });

    return toConnectionSummary(connection);
  }

  async accept(input: ConnectionActorInput): Promise<ConnectionSummary> {
    await this.assertUserExists(input.user_id);

    const connection = await this.getConnectionOrThrow(input.connection_id);

    if (connection.addressee_id !== input.user_id) {
      throw new HttpError(403, "Only the addressee can accept this connection request");
    }

    if (connection.status !== "pending") {
      throw new HttpError(409, "Only pending connections can be accepted");
    }

    const updatedConnection = await this.connectionRepository.updateStatus(connection.id, "accepted");
    return toConnectionSummary(updatedConnection);
  }

  async block(input: ConnectionActorInput): Promise<ConnectionSummary> {
    await this.assertUserExists(input.user_id);

    const connection = await this.getConnectionOrThrow(input.connection_id);
    this.assertParticipant(connection, input.user_id);

    if (connection.status === "blocked") {
      throw new HttpError(409, "Connection is already blocked");
    }

    if (connection.status === "removed") {
      throw new HttpError(409, "Removed connections cannot be blocked");
    }

    const updatedConnection = await this.connectionRepository.updateStatus(connection.id, "blocked");
    return toConnectionSummary(updatedConnection);
  }

  async remove(input: ConnectionActorInput): Promise<void> {
    await this.assertUserExists(input.user_id);

    const connection = await this.getConnectionOrThrow(input.connection_id);
    this.assertParticipant(connection, input.user_id);

    if (connection.status === "removed") {
      throw new HttpError(409, "Connection is already removed");
    }

    if (connection.status === "blocked") {
      throw new HttpError(409, "Blocked connections cannot be removed");
    }

    await this.connectionRepository.updateStatus(connection.id, "removed");
  }

  async list(input: ListConnectionsInput): Promise<ConnectionSummary[]> {
    await this.assertUserExists(input.user_id);

    const connections = await this.connectionRepository.listByUser(input.user_id, input.status);
    return connections.map(toConnectionSummary);
  }

  private async assertUserExists(userId: string, message = "User not found"): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new HttpError(404, message);
    }
  }

  private async getConnectionOrThrow(connectionId: string): Promise<ConnectionRecord> {
    const connection = await this.connectionRepository.findById(connectionId);

    if (!connection) {
      throw new HttpError(404, "Connection not found");
    }

    return connection;
  }

  private assertParticipant(connection: ConnectionRecord, userId: string): void {
    if (connection.requester_id !== userId && connection.addressee_id !== userId) {
      throw new HttpError(403, "Only connection participants can modify this connection");
    }
  }

  private createDuplicateConnectionError(status: ConnectionStatus): HttpError {
    switch (status) {
      case "pending":
        return new HttpError(409, "A pending connection already exists between these users");
      case "accepted":
        return new HttpError(409, "Users are already connected");
      case "blocked":
        return new HttpError(409, "Connection between these users is blocked");
      case "removed":
        return new HttpError(409, "A connection already exists between these users");
    }
  }
}

export { ConnectionService };
