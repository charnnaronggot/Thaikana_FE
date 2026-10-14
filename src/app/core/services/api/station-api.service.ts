import { inject, Injectable } from '@angular/core';
import {
  ActionAuthorization,
  AuthorizationRequest,
  ExecutionActionRequest,
  Station,
  StationAction,
  StationJob,
} from '../../models/api.models';
import type { components } from './generated/schema';
import { ApiClient } from './api-client.service';
function required<T>(value: T | null | undefined, field: string): T {
  if (value === null || value === undefined) throw new Error('API response is missing ' + field);
  return value;
}
function station(value: components['schemas']['StationResponse']): Station {
  return {
    id: required(value.id, 'station.id'),
    code: required(value.code, 'station.code'),
    name: required(value.name, 'station.name'),
    departmentId: value.departmentId ?? undefined,
    isActive: required(value.isActive, 'station.isActive'),
  };
}
function job(value: components['schemas']['StationJobResponse']): StationJob {
  return {
    workOrderId: required(value.workOrderId, 'workOrderId'),
    workOrderNumber: required(value.workOrderNumber, 'workOrderNumber'),
    productName: required(value.productName, 'productName'),
    plannedQuantity: required(value.plannedQuantity, 'plannedQuantity'),
    completedQuantity: required(value.completedQuantity, 'completedQuantity'),
    remainingQuantity: required(value.remainingQuantity, 'remainingQuantity'),
    workOrderVersion: required(value.workOrderVersion, 'workOrderVersion'),
    operationId: required(value.operationId, 'operationId'),
    operationSequence: required(value.operationSequence, 'operationSequence'),
    operationName: required(value.operationName, 'operationName'),
    operationCode: value.operationCode ?? 'PROD',
    predecessorId: value.predecessorId ?? undefined,
    requiredGoodQuantity: value.requiredGoodQuantity ?? undefined,
    availableInputQuantity: value.availableInputQuantity ?? undefined,
    blockedReason: value.blockedReason ?? undefined,
    runPlannedQuantity: value.runPlannedQuantity ?? undefined,
    goodQuantity: value.goodQuantity ?? 0,
    scrapQuantity: value.scrapQuantity ?? 0,
    isFinalOutput: value.isFinalOutput ?? false,
    processSource: value.processSource ?? undefined,
    executionId: value.executionId ?? undefined,
    executionVersion: value.executionVersion ?? undefined,
    ownerUserId: value.ownerUserId ?? undefined,
    ownerName: value.ownerName ?? undefined,
    status: required(value.status, 'status'),
    productRevision: value.productRevision ?? undefined,
    drawingFileId: value.drawingFileId ?? undefined,
    startedAt: value.startedAt ?? undefined,
    activeSeconds: value.activeSeconds ?? 0,
    serverTime: value.serverTime ?? undefined,
    materialReadiness: value.materialReadiness
      ? { ...value.materialReadiness, lines: value.materialReadiness.lines ?? [] }
      : undefined,
    allowedActions: required(value.allowedActions, 'allowedActions').filter(
      (a): a is StationJob['allowedActions'][number] =>
        [
          'start',
          'pause',
          'resume',
          'complete',
          'problem',
          'pauseOnBehalf',
          'resumeOnBehalf',
        ].includes(a),
    ),
  };
}
@Injectable({ providedIn: 'root' })
export class StationApi {
  private api = inject(ApiClient);
  async stations() {
    return (await this.api.get<components['schemas']['StationResponse'][]>('/stations')).map(
      station,
    );
  }
  async jobs(stationId: string) {
    return (
      await this.api.get<components['schemas']['StationJobResponse'][]>(
        '/stations/' + stationId + '/work-orders',
      )
    ).map(job);
  }
  events(stationId: string, workOrderId: string) {
    return this.api.get<components['schemas']['ExecutionEventResponse'][]>(
      '/stations/' + stationId + '/events',
      { workOrderId },
    );
  }
  async authorize(stationId: string, body: AuthorizationRequest): Promise<ActionAuthorization> {
    const request: components['schemas']['StationAuthorizationRequest'] = body;
    const response = await this.api.post<components['schemas']['StationAuthorizationResponse']>(
      '/stations/' + stationId + '/authorizations',
      request,
    );
    return {
      authorizationId: required(response.authorizationId, 'authorizationId'),
      expiresAt: required(response.expiresAt, 'expiresAt'),
      ownerUserId: required(response.ownerUserId, 'ownerUserId'),
      actorUserId: required(response.actorUserId, 'actorUserId'),
    };
  }
  action(
    stationId: string,
    target: StationJob,
    action: StationAction,
    body: ExecutionActionRequest,
    key: string,
  ) {
    const root = '/stations/' + stationId + '/executions';
    const request:
      | components['schemas']['StationStartRequest']
      | components['schemas']['StationExecutionRequest'] =
      action === 'start'
        ? { ...body, workOrderId: target.workOrderId, operationId: target.operationId }
        : body;
    return this.api.post<components['schemas']['StationExecutionResponse']>(
      action === 'start' ? root + '/start' : root + '/' + target.executionId + '/' + action,
      request,
      key,
    );
  }
}
