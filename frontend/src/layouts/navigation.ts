import { LucideIcon, Home, Search, FileText, HandCoins, ShieldAlert, Users, Building2, ClipboardList, ReceiptText, Layers, Briefcase, ClipboardCheck, PiggyBank, Settings, BookOpenText, MessageSquare, FileSignature } from 'lucide-react';
import { UserRole } from '../app/store/authSlice';

export interface NavItem {
  labelKey: string;
  path: string;
  icon: LucideIcon;
}

export const roleNavigation: Record<UserRole, NavItem[]> = {
  TENANT: [
    { labelKey: 'nav.tenant.home', path: '/tenant/home', icon: Home },
    { labelKey: 'nav.tenant.search', path: '/tenant/search', icon: Search },
    { labelKey: 'nav.tenant.applications', path: '/tenant/applications', icon: ClipboardList },
    { labelKey: 'nav.tenant.contracts', path: '/tenant/contracts', icon: FileText },
    { labelKey: 'nav.tenant.payments', path: '/tenant/payments', icon: HandCoins },
    { labelKey: 'nav.tenant.incidents', path: '/tenant/incidents', icon: ShieldAlert },
    { labelKey: 'nav.tenant.profile', path: '/tenant/profile', icon: Users },
    { labelKey: 'nav.tenant.kyc', path: '/tenant/profile/kyc', icon: FileSignature },
    { labelKey: 'nav.tenant.pro', path: '/tenant/profile/pro', icon: Layers },
    { labelKey: 'nav.tenant.services', path: '/tenant/services', icon: Building2 },
  ],
  LANDLORD: [
    { labelKey: 'nav.landlord.home', path: '/landlord/home', icon: Home },
    { labelKey: 'nav.landlord.properties', path: '/landlord/properties', icon: Building2 },
    { labelKey: 'nav.landlord.requests', path: '/landlord/requests', icon: ClipboardList },
    { labelKey: 'nav.landlord.candidates', path: '/landlord/candidates', icon: Users },
    { labelKey: 'nav.landlord.contracts', path: '/landlord/contracts', icon: FileText },
    { labelKey: 'nav.landlord.deposits', path: '/landlord/deposits', icon: PiggyBank },
    { labelKey: 'nav.landlord.payments', path: '/landlord/payments', icon: HandCoins },
    { labelKey: 'nav.landlord.incidents', path: '/landlord/incidents', icon: ShieldAlert },
    { labelKey: 'nav.landlord.professionals', path: '/landlord/professionals', icon: Briefcase },
    { labelKey: 'nav.landlord.tax', path: '/landlord/tax', icon: ReceiptText },
  ],
  PROFESSIONAL: [
    { labelKey: 'nav.professional.home', path: '/professional/home', icon: Home },
    { labelKey: 'nav.professional.offers', path: '/professional/offers', icon: ClipboardList },
    { labelKey: 'nav.professional.jobs', path: '/professional/jobs', icon: Briefcase },
    { labelKey: 'nav.professional.billing', path: '/professional/billing', icon: HandCoins },
    { labelKey: 'nav.professional.reputation', path: '/professional/reputation', icon: Users },
  ],
  AGENCY: [
    { labelKey: 'nav.agency.home', path: '/agency/home', icon: Home },
    { labelKey: 'nav.agency.visits', path: '/agency/visits', icon: ClipboardList },
    { labelKey: 'nav.agency.captacion', path: '/agency/capture', icon: Users },
    { labelKey: 'nav.agency.contracts', path: '/agency/contracts', icon: FileText },
    { labelKey: 'nav.agency.commissions', path: '/agency/commissions', icon: ReceiptText },
  ],
  ADMIN: [
    { labelKey: 'nav.admin.dashboard', path: '/admin/dashboard', icon: Home },
    { labelKey: 'nav.admin.users', path: '/admin/users', icon: Users },
    { labelKey: 'nav.admin.payments', path: '/admin/payments', icon: HandCoins },
    { labelKey: 'nav.admin.deposits', path: '/admin/deposits', icon: PiggyBank },
    { labelKey: 'nav.admin.catalog', path: '/admin/catalog', icon: Settings },
    { labelKey: 'nav.admin.legal', path: '/admin/legal', icon: BookOpenText },
  ],
};
