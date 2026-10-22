import type { components } from '../../../core/services/api/generated/native-schema';
// Generated from the same native host used by PostgreSQL/browser acceptance.
export type ManagedUser = components['schemas']['UserListItem'];
export type UserOptions = components['schemas']['UserAdministrationOptions'];
export type UserDetail = components['schemas']['UserDetail'];
export type MfaStatus = components['schemas']['MfaStatus'];
export type UserMutationRequest =
  | components['schemas']['CreateUserRequest']
  | components['schemas']['UpdateUserProfileRequest']
  | components['schemas']['SetAssignmentsRequest']
  | components['schemas']['SetPinRequest']
  | components['schemas']['UpdateUserStatusRequest']
  | components['schemas']['ResetPasswordRequest']
  | components['schemas']['UserSecurityRequest']
  | components['schemas']['MfaResetRequest'];
export type UserAction =
  | 'create'
  | 'profile'
  | 'assignments'
  | 'status'
  | 'reset-password'
  | 'pin'
  | 'revoke-sessions'
  | 'mfa'
  | 'unlock';
export const roleLabels: Record<string, string> = {
  SystemAdmin: 'Admin',
  Sales: 'Sales',
  Design: 'Designer',
  Planning: 'Planner',
  Inventory: 'Store',
  ProductionManager: 'Manager',
  Supervisor: 'Supervisor',
  Operator: 'Operator',
  QC: 'QC',
  Delivery: 'Delivery',
  Finance: 'Finance',
  DashboardViewer: 'Viewer',
  Station: 'Station account',
};
