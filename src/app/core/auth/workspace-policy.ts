import type { UserProfile } from '../models/api.models';
export type ModuleKey =
  | 'overview'
  | 'sales'
  | 'design'
  | 'planning'
  | 'production'
  | 'station'
  | 'inventory'
  | 'qc'
  | 'delivery'
  | 'finance'
  | 'users'
  | 'customers'
  | 'settings'
  | 'reports';
export const workspaceModules: {
  key: ModuleKey;
  path: string;
  label: string;
  icon: string;
  permissions: string[];
}[] = [
  {
    key: 'overview',
    path: '/overview',
    label: 'ภาพรวม',
    icon: 'c0176.svg',
    permissions: ['dashboard.view'],
  },
  {
    key: 'sales',
    path: '/sales',
    label: 'ใบเสนอราคา',
    icon: 'e5799.svg',
    permissions: ['sales.manage'],
  },
  {
    key: 'design',
    path: '/design',
    label: 'ออกแบบ',
    icon: 'c68cb.svg',
    permissions: ['design.manage'],
  },
  {
    key: 'planning',
    path: '/planning',
    label: 'วางแผนผลิต',
    icon: 'd4e68.svg',
    permissions: ['planning.decide'],
  },
  {
    key: 'production',
    path: '/production',
    label: 'งานผลิต',
    icon: '5ceb8.svg',
    permissions: ['work_order.view'],
  },
  {
    key: 'station',
    path: '/station',
    label: 'งานของสถานี',
    icon: '5e1e4.svg',
    permissions: ['production.execute'],
  },
  { key: 'qc', path: '/qc', label: 'ตรวจคุณภาพ', icon: '58d26.svg', permissions: ['qc.inspect','qc.approve'] },
  {
    key: 'inventory',
    path: '/inventory',
    label: 'คลังสินค้า',
    icon: 'f3d62.svg',
    permissions: ['inventory.manage'],
  },
  {
    key: 'delivery',
    path: '/delivery',
    label: 'จัดส่ง',
    icon: 'fb8ea.svg',
    permissions: ['delivery.manage', 'delivery.confirm', 'delivery.gps_approve'],
  },
  {
    key: 'finance',
    path: '/finance',
    label: 'การเงิน',
    icon: 'e5799.svg',
    permissions: ['finance.view'],
  },
  {
    key: 'reports',
    path: '/reports',
    label: 'รายงาน',
    icon: 'e5799.svg',
    permissions: ['dashboard.view','report.export','finance.view'],
  },
  {
    key: 'users',
    path: '/users',
    label: 'ผู้ใช้และสิทธิ์',
    icon: '271fe.svg',
    permissions: ['user.view'],
  },
  {
    key: 'customers',
    path: '/customers',
    label: 'ทะเบียนลูกค้า',
    icon: '271fe.svg',
    permissions: ['sales.manage'],
  },
  {
    key: 'settings',
    path: '/settings',
    label: 'ตั้งค่าบริษัท',
    icon: '271fe.svg',
    permissions: ['user.manage'],
  },
];
export function canOpenModule(user: UserProfile | null, key: ModuleKey): boolean {
  if (!user) return false;
  const station = user.accountType === 'Station';
  if (station) return key === 'station' && user.permissions.includes('work_order.view');
  const module = workspaceModules.find((m) => m.key === key);
  return !!module && module.permissions.some((p) => user.permissions.includes(p));
}
export function homeFor(user: UserProfile | null): string {
  if (!user) return '/login';
  if (user.mustChangePassword) return '/change-password';
  if (user.accountType === 'Station')
    return canOpenModule(user, 'station') ? '/station' : '/workspace';
  if (user.roles.includes('SystemAdmin') && canOpenModule(user, 'overview')) return '/overview';
  const preferred: Record<string, ModuleKey> = {
    SystemAdmin: 'overview',
    Sales: 'sales',
    Design: 'design',
    Planning: 'planning',
    Inventory: 'inventory',
    ProductionManager: 'production',
    Supervisor: 'production',
    Operator: 'station',
    QC: 'qc',
    Delivery: 'delivery',
    Finance: 'finance',
    DashboardViewer: 'overview',
  };
  for (const role of user.roles) {
    const key = preferred[role];
    if (key && canOpenModule(user, key)) return workspaceModules.find((m) => m.key === key)!.path;
  }
  return workspaceModules.find((m) => canOpenModule(user, m.key))?.path ?? '/workspace';
}
export function safeDestination(user: UserProfile | null, returnUrl: string | null): string {
  if (user?.mustChangePassword) return '/change-password';
  if (
    !returnUrl ||
    !returnUrl.startsWith('/') ||
    returnUrl.startsWith('//') ||
    returnUrl.includes('\\')
  )
    return homeFor(user);
  const pathname = returnUrl.split(/[?#]/)[0];
  const module = workspaceModules.find(
    (m) => pathname === m.path || pathname.startsWith(m.path + '/'),
  );
  return module && canOpenModule(user, module.key) ? returnUrl : homeFor(user);
}
