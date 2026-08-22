import { api } from "../api-client";
import { endpoints } from "../endpoints";
import type { OperatorProviders, OperatorSessions, PoolReading } from "@/shared/types";

const auth = (token: string) => ({ headers: { "x-operator-token": token } });

export const operatorService = {
  pool: (token: string) => api.request<PoolReading>(endpoints.operator.pool(), auth(token)),
  providers: (token: string) =>
    api.request<OperatorProviders>(endpoints.operator.providers(), auth(token)),
  sessions: (token: string) =>
    api.request<OperatorSessions>(endpoints.operator.sessions(), auth(token)),
};
