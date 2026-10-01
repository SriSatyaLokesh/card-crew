const CONNECTION_STATUSES = ["pending", "accepted", "blocked", "removed"] as const;

type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];
type ActiveConnectionStatus = Exclude<ConnectionStatus, "removed">;

type ConnectionRecord = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: Date;
  updated_at: Date;
};

type CreateConnectionInput = {
  requester_id: string;
  addressee_id: string;
};

type CreateConnectionRecordInput = CreateConnectionInput & {
  status: ConnectionStatus;
};

type ConnectionActorInput = {
  connection_id: string;
  user_id: string;
};

type ListConnectionsInput = {
  user_id: string;
  status?: ConnectionStatus;
};

type ConnectionSummary = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
};

function toConnectionSummary(connection: ConnectionRecord): ConnectionSummary {
  return {
    id: connection.id,
    requester_id: connection.requester_id,
    addressee_id: connection.addressee_id,
    status: connection.status,
    created_at: connection.created_at.toISOString(),
    updated_at: connection.updated_at.toISOString(),
  };
}

export { CONNECTION_STATUSES, toConnectionSummary };
export type {
  ActiveConnectionStatus,
  ConnectionActorInput,
  ConnectionRecord,
  ConnectionStatus,
  ConnectionSummary,
  CreateConnectionInput,
  CreateConnectionRecordInput,
  ListConnectionsInput,
};
