import {
    LayoutDashboard,
    ClipboardCheck,
    BarChart3,
    FilePlus,
} from 'lucide-react';

export interface MenuItem {
    label: string;
    labelTh: string;
    icon: any;
    path?: string;
    children?: MenuItem[];
    roles?: string[];
}

export const NAVIGATION_CONFIG: MenuItem[] = [
    {
        label: 'Dashboard',
        labelTh: 'แดชบอร์ด',
        icon: LayoutDashboard,
        path: '/dashboard'
    },
    {
        label: 'Leave',
        labelTh: 'การลา',
        icon: FilePlus,
        path: '/leave'
    },
    {
        label: 'Probation',
        labelTh: 'ประเมินทดลองงาน',
        icon: ClipboardCheck,
        path: '/probation-evaluations',
        roles: ['leader', 'manager', 'hr', 'admin', 'dev']
    },
    {
        label: 'Approvals',
        labelTh: 'การอนุมัติ',
        icon: ClipboardCheck,
        path: '/approval',
        roles: ['manager', 'hr', 'admin']
    },
    {
        label: 'Reports',
        labelTh: 'รายงาน',
        icon: BarChart3,
        path: '/reports',
        roles: ['manager', 'hr', 'admin', 'dev']
    }
];
