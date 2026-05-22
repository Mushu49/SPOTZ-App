import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

export type LegalPageSlug = 'terms' | 'privacy' | 'account-deletion' | 'community' | 'support';

export type LegalPageSummary = {
  slug: LegalPageSlug;
  title: string;
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
};

export type LegalSection = {
  heading: string;
  body: string[];
};

export type LegalPage = LegalPageSummary & {
  updatedLabel: string;
  intro: string;
  sections: LegalSection[];
};

export const LEGAL_PUBLIC_BASE_URL = 'https://spotzapp.app';

export const LEGAL_PUBLIC_URLS: Record<LegalPageSlug, string> = {
  terms: `${LEGAL_PUBLIC_BASE_URL}/terms`,
  privacy: `${LEGAL_PUBLIC_BASE_URL}/privacy`,
  'account-deletion': `${LEGAL_PUBLIC_BASE_URL}/account-deletion`,
  community: `${LEGAL_PUBLIC_BASE_URL}/community-guidelines`,
  support: `${LEGAL_PUBLIC_BASE_URL}/support`,
};

export const LEGAL_PAGE_SUMMARIES: LegalPageSummary[] = [
  {
    slug: 'terms',
    title: 'Terms of Use',
    description: 'Rules for SPOTZ accounts, uploads, comments, reports, and app access.',
    icon: 'document-text-outline',
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    description: 'How SPOTZ handles accounts, location, photos, comments, reports, and providers.',
    icon: 'shield-checkmark-outline',
  },
  {
    slug: 'account-deletion',
    title: 'Account Deletion',
    description: 'How to delete your account and what information is deleted or retained.',
    icon: 'person-remove-outline',
  },
  {
    slug: 'community',
    title: 'Community Guidelines',
    description: 'Standards for respectful, safe, and accurate sharing.',
    icon: 'people-outline',
  },
];

export const LEGAL_PAGES: Record<LegalPageSlug, LegalPage> = {
  terms: {
    ...LEGAL_PAGE_SUMMARIES[0],
    updatedLabel: 'Effective May 20, 2026',
    intro:
      'These Terms of Use govern access to SPOTZ, a photography location discovery app for saving, sharing, and discussing photo spots. By creating an account or using SPOTZ, you agree to these terms and to the Privacy Policy.',
    sections: [
      {
        heading: 'Who May Use SPOTZ',
        body: [
          'You must be legally able to enter into these terms and use SPOTZ in compliance with the laws and rules that apply to you.',
          'You are responsible for keeping your account credentials secure and for activity that happens through your account.',
        ],
      },
      {
        heading: 'Accounts And Profiles',
        body: [
          'SPOTZ accounts are created with Firebase Authentication using sign-in credentials. Your username, display name, bio, profile image, and public profile details may be shown with spots, comments, and replies.',
          'Do not impersonate another person, reserve misleading usernames, attempt to access another account, or use SPOTZ after your account has been suspended or removed.',
        ],
      },
      {
        heading: 'User-Generated Content',
        body: [
          'SPOTZ lets users upload photo spots, photos, location details, descriptions, categories, comments, replies, favorites, likes, profile information, and reports.',
          'You are responsible for the content you upload or submit. You must have the rights and permissions needed to share photos, text, and location information through SPOTZ.',
        ],
      },
      {
        heading: 'Photo And Location Responsibility',
        body: [
          'Only upload photos you created, own, or are allowed to use. Do not upload stolen photos, private images without permission, or content that violates intellectual property, privacy, or publicity rights.',
          'Spot details and map pins should be accurate and lawful. Do not encourage trespassing, unsafe behavior, property damage, harassment, or access to restricted or sensitive locations.',
        ],
      },
      {
        heading: 'Comments And Replies',
        body: [
          'Comments and replies should be relevant, respectful, and useful to the SPOTZ community.',
          'Do not post harassment, threats, hate, sexual exploitation, graphic violence, illegal content, spam, scams, doxxing, or intentionally misleading information.',
        ],
      },
      {
        heading: 'Reports And Moderation',
        body: [
          'Users can report spots, comments, replies, profiles, safety concerns, and other content for review. Reports may include account identifiers, target content, reason, details, timestamps, and moderation status.',
          'SPOTZ may review, hide, remove, restrict, or preserve content and accounts when needed to enforce these terms, protect users, investigate abuse, maintain service integrity, or comply with legal obligations.',
        ],
      },
      {
        heading: 'Service Providers',
        body: [
          'SPOTZ uses Firebase for authentication, Firestore database storage, syncing, and app infrastructure. SPOTZ uses Cloudinary for uploaded image storage and delivery.',
          'We may use analytics, diagnostics, crash reporting, messaging, notifications, or similar tools if enabled in the app to operate, secure, understand, and improve SPOTZ.',
        ],
      },
      {
        heading: 'Availability And Changes',
        body: [
          'SPOTZ is provided as-is and may change, pause, or become unavailable without notice. Maps, distance labels, nearby sorting, user content, and location data may be incomplete or inaccurate.',
          'Always use your own judgment when visiting locations. Follow local laws, property rules, safety guidance, and posted restrictions.',
        ],
      },
      {
        heading: 'Termination',
        body: [
          'You may stop using SPOTZ at any time and may delete your account from the app. SPOTZ may suspend or terminate access if we believe an account or content violates these terms or creates risk for users, the service, or others.',
          "Some information may remain after account deletion when needed for moderation history, security, legal compliance, backup integrity, or to avoid removing other users' content.",
        ],
      },
      {
        heading: 'Future Request Options',
        body: [
          'Additional request options will become available in a future update.',
          'Until then, use the in-app report and moderation tools where available.',
        ],
      },
    ],
  },
  privacy: {
    ...LEGAL_PAGE_SUMMARIES[1],
    updatedLabel: 'Effective May 20, 2026',
    intro:
      'This Privacy Policy explains how SPOTZ collects, uses, stores, shares, and protects information when you use the app and related public legal pages.',
    sections: [
      {
        heading: 'Information You Provide',
        body: [
          'When you create or use a SPOTZ account, we collect information such as your email address, username, display name, bio, profile image, account settings, accepted terms version, and account status.',
          'You may also provide photo spot titles, descriptions, categories, coordinates, uploaded photos, comments, replies, favorites, likes, reports, and messages submitted through future request tools.',
        ],
      },
      {
        heading: 'Location Information',
        body: [
          'SPOTZ uses location information to provide map display, nearby discovery, distance labels, sorting, and location-based photo spot features.',
          'If you enable Location Access in SPOTZ and allow device permission, the app may use your current device location while you use location features. You can turn Location Access off in SPOTZ Privacy Settings or change permission in your device settings.',
          'Photo spots you upload may include the location coordinates and place details you choose to save. Shared public spots may be visible to other users.',
        ],
      },
      {
        heading: 'Uploaded Photos',
        body: [
          'Photos you upload for spots or your profile are processed so SPOTZ can store, resize, display, moderate, and deliver them in the app.',
          'SPOTZ uses Cloudinary for image hosting and delivery. Cloudinary may process image files, URLs, technical metadata, and delivery information needed to provide the image service.',
        ],
      },
      {
        heading: 'Comments, Replies, Favorites, And Likes',
        body: [
          'SPOTZ stores comments, replies, favorites, likes, timestamps, counters, and related account identifiers to power community and saved-content features.',
          'Comments and replies may be visible to other users. Favorites and likes may be used to maintain counts, personalize your account, and provide app functionality.',
        ],
      },
      {
        heading: 'Reports And Moderation',
        body: [
          'When users submit reports, SPOTZ stores information needed to review the report, such as reporter account id, target type, target id, owner id, reason, details, content snapshots, status, and timestamps.',
          'Moderation records may be retained to investigate abuse, enforce rules, protect users, comply with legal obligations, and prevent repeated violations.',
        ],
      },
      {
        heading: 'Firebase And Authentication',
        body: [
          'SPOTZ uses Firebase Authentication for sign-up, login, password reset, session handling, and account deletion. Firebase may process account identifiers, email addresses, authentication metadata, and technical information needed for those features.',
          'SPOTZ uses Cloud Firestore for account records, usernames, public profiles, spots, comments, favorites, reports, settings, and related app data.',
        ],
      },
      {
        heading: 'Analytics, Diagnostics, And Notifications',
        body: [
          'The Firebase project includes an analytics measurement id. SPOTZ may use analytics or diagnostics if enabled to understand app performance, feature usage, crashes, device information, and general usage patterns.',
          'SPOTZ includes notification preferences and may add push notifications in the future. If notifications are enabled, we may process device tokens and notification preferences to send account, community, safety, or feature notifications.',
        ],
      },
      {
        heading: 'How We Use Information',
        body: [
          'We use information to create and secure accounts, operate maps and discovery, show user-generated content, store photos, sync data across devices, personalize settings, process reports, moderate content, prepare future request tools, and improve SPOTZ.',
          'We may also use information to detect misuse, enforce terms, comply with legal obligations, protect rights and safety, and maintain service integrity.',
        ],
      },
      {
        heading: 'Sharing And Visibility',
        body: [
          'Public profile information, uploaded public spots, spot photos, comments, replies, and related usernames may be visible to other SPOTZ users.',
          'We share information with service providers such as Firebase and Cloudinary as needed to operate SPOTZ. We may disclose information if required by law, to protect safety or rights, or during a business transfer such as a merger, acquisition, or asset sale.',
        ],
      },
      {
        heading: 'Retention And Deletion',
        body: [
          'We keep information while your account is active and as needed to provide SPOTZ, resolve disputes, enforce rules, protect safety, maintain backups, and comply with legal obligations.',
          'You can delete your account in the app. Account deletion removes your Firebase Auth account, user profile records, username reservation, saved favorites, and local account data, and anonymizes your authorship on existing spots, comments, and replies.',
        ],
      },
      {
        heading: 'Your Choices',
        body: [
          'You can update profile details, disable in-app Location Access, change device permissions, manage notification preferences where available, delete uploaded content where app controls allow it, or delete your account.',
          'Additional privacy, access, and deletion request options will become available in a future update.',
        ],
      },
      {
        heading: 'Children',
        body: [
          'SPOTZ is not intended for children under 13. Child account review options will become available with future request tools.',
        ],
      },
      {
        heading: 'Future Request Options',
        body: [
          'Additional request options will become available in a future update.',
          'Use the in-app account deletion flow for account removal.',
        ],
      },
    ],
  },
  'account-deletion': {
    ...LEGAL_PAGE_SUMMARIES[2],
    updatedLabel: 'Effective May 20, 2026',
    intro:
      'SPOTZ provides an in-app account deletion flow for signed-in users. This page explains where to find it, what is deleted, and what may remain for safety, moderation, legal, or technical reasons.',
    sections: [
      {
        heading: 'How To Delete Your Account In The App',
        body: [
          'Open SPOTZ and sign in to the account you want to delete.',
          'Go to Profile, tap the settings button, open Legal, then choose Delete Account.',
          'Read the warning, type DELETE, and confirm. For security, Firebase may require that you recently logged in. If prompted, log out, log back in, and return to Delete Account.',
        ],
      },
      {
        heading: 'What SPOTZ Deletes',
        body: [
          'SPOTZ deletes your Firebase Authentication account, your private user document, your public profile document, your username reservation, your saved favorites, and local account/session data stored on the device.',
          'SPOTZ also removes your account from favorite/like counters where applicable and deletes profile references that are tied directly to your user record.',
        ],
      },
      {
        heading: 'What Is Anonymized',
        body: [
          "Existing spots, comments, and replies created by your account may remain so that other users' conversations, reports, and app content are not unexpectedly broken.",
          'When retained content remains, SPOTZ replaces your user id, username, display name, avatar, and related author fields with Deleted user / deleted-account indicators where technically possible.',
        ],
      },
      {
        heading: 'What May Remain',
        body: [
          'Reports, moderation records, safety review notes, abuse-prevention records, legal records, system logs, backups, and content needed to protect other users or comply with law may remain after account deletion.',
          'Copies of content already viewed, saved, cached, exported, screenshotted, or shared by other users may not be recoverable or removable by SPOTZ.',
        ],
      },
      {
        heading: 'Uploaded Photos',
        body: [
          'Profile image references connected to your profile are removed with account deletion. Photos attached to existing spots may remain if the spot remains visible or is retained for moderation, safety, legal, backup, or service-integrity reasons.',
          'Specific uploaded-photo review options will become available in a future update.',
        ],
      },
      {
        heading: 'Future Request Options',
        body: [
          'Additional request options will become available in a future update.',
          'If you can access your account, use the in-app deletion flow from Profile > Settings > Legal > Delete Account.',
        ],
      },
    ],
  },
  community: {
    ...LEGAL_PAGE_SUMMARIES[3],
    updatedLabel: 'Effective May 20, 2026',
    intro:
      'These Community Guidelines describe the standards expected from everyone sharing and discovering photo spots on SPOTZ.',
    sections: [
      {
        heading: 'Respectful Behavior',
        body: [
          'Treat other users with respect, even when you disagree about locations, feedback, or photography choices.',
          'Keep comments constructive and relevant to the spot or conversation.',
        ],
      },
      {
        heading: 'No Harassment',
        body: [
          'Do not threaten, bully, shame, stalk, dox, or repeatedly target another person.',
          'Content that attacks people based on protected characteristics or personal identity is not allowed.',
        ],
      },
      {
        heading: 'No Illegal Content',
        body: [
          'Do not share content that promotes illegal activity, exploitation, violence, or unsafe access to restricted areas.',
          'Do not use SPOTZ to coordinate harm, trespassing, theft, or property damage.',
        ],
      },
      {
        heading: 'No Stolen Photos',
        body: [
          'Only share photos you created, own, or have clear permission to upload.',
          'Do not remove credits, repost another photographers work as your own, or upload copyrighted material without authorization.',
        ],
      },
      {
        heading: 'No Fake Or Misleading Spots',
        body: [
          'Spot titles, descriptions, categories, and map pins should accurately represent the location being shared.',
          'Do not intentionally add fake places, misleading coordinates, unsafe instructions, or deceptive images.',
        ],
      },
      {
        heading: 'Safe Location Sharing',
        body: [
          'Avoid sharing private homes, sensitive locations, restricted areas, or places where public attention could create safety risks.',
          'Respect local laws, posted rules, property rights, wildlife, and other people when visiting or sharing photo spots.',
        ],
      },
      {
        heading: 'Consequences',
        body: [
          'Violations may lead to content removal, feature restrictions, account suspension, or other moderation actions.',
          'Serious or repeated violations may result in permanent account removal where appropriate.',
        ],
      },
    ],
  },
  support: {
    slug: 'support',
    title: 'Support Availability',
    description: 'Current support availability for SPOTZ.',
    icon: 'information-circle-outline',
    updatedLabel: 'Effective May 20, 2026',
    intro:
      'SPOTZ does not offer public support channels yet. This page will be updated when support options become available.',
    sections: [
      {
        heading: 'Current Status',
        body: [
          'Support options will become available in a future update.',
        ],
      },
      {
        heading: 'Content Or Safety Reports',
        body: [
          'Use the in-app report tools where available for spots, comments, profiles, and safety concerns.',
          'Reports remain part of the moderation workflow.',
        ],
      },
      {
        heading: 'Account Deletion',
        body: [
          'Signed-in users can delete their account in the app from Profile > Settings > Legal > Delete Account.',
          'Additional account request options will become available with future support tools.',
        ],
      },
    ],
  },
};

export function getLegalPage(slug: string | string[] | undefined) {
  const normalizedSlug = Array.isArray(slug) ? slug[0] : slug;

  if (
    normalizedSlug === 'terms' ||
    normalizedSlug === 'privacy' ||
    normalizedSlug === 'account-deletion' ||
    normalizedSlug === 'community' ||
    normalizedSlug === 'support'
  ) {
    return LEGAL_PAGES[normalizedSlug];
  }

  return LEGAL_PAGES.terms;
}
