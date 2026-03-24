export type Role = string;

export interface WebsiteSection {
  id: string;
  type: 'hero' | 'about' | 'admissions' | 'news' | 'contact' | 'features';
  content: any;
}

export interface WebsitePage {
  id: string;
  title: string;
  slug: string;
  isHidden?: boolean;
  sections: WebsiteSection[];
}

export interface SchoolWebsite {
  schoolId: string;
  publicUrl?: string | null;
  legal?: {
    privacyPolicy?: {
      title: string;
      lastUpdated: string;
      body: string;
    };
    termsOfService?: {
      title: string;
      lastUpdated: string;
      body: string;
    };
  };
  contactInfo?: {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
  };
  theme: {
    primaryColor: string;
    fontFamily: string;
    logoUrl?: string;
  };
  pages: WebsitePage[];
}

export interface Vacancy {
  id: string;
  schoolId: string;
  schoolName: string;
  title: string;
  description: string;
  type: 'Full-time' | 'Part-time' | 'Contract';
  category: 'Teaching' | 'Administrative' | 'Support' | 'ICT';
  salary?: string;
  postedAt: string;
  isNdoveraOfficial?: boolean;
}

export interface Resume {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  experience: string;
  education: string;
  skills: string[];
  fileUrl?: string;
}

export interface GrowthPartner {
  userId: string;
  referralCode: string;
  totalReferrals: number;
  auraBalance: number;
  rank: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
}

export interface AuraTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'Referral' | 'Mission' | 'Purchase' | 'Reward';
  description: string;
  timestamp: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  school_id: string;
}

export interface School {
  id: string;
  name: string;
  subdomain: string;
  logo_url?: string;
  primary_color?: string;
}
