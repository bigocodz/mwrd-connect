export type Scope = "customer" | "staff";

export type OrgType = "CLIENT" | "SUPPLIER";

export type OrgStatus =
  | "INVITED"
  | "KYC_PENDING"
  | "KYC_REVIEW"
  | "ACTIVE"
  | "SUSPENDED"
  | "ARCHIVED";

export type Role = "OWNER" | "ADMIN" | "BUYER" | "APPROVER" | "VIEWER";

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  locale: string;
  must_change_password: boolean;
}

export interface OrganizationBrief {
  id: number;
  type: OrgType;
  name: string;
  status: OrgStatus;
}

export interface MeResponse {
  user: User;
  organization: OrganizationBrief | null;
  role: Role | null;
  scope: Scope;
}

export interface LoginResponse {
  user: User;
  organization: OrganizationBrief;
  role: Role;
}
