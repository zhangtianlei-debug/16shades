import release from '@/release.json';

// Keep a cloned site buildable without assigning it a public identity.
export const siteOrigin = release.publicOrigin || 'http://localhost:3106';
