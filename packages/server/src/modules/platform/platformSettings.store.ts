import { GLOBAL_SCOPE, readDocument, writeDocument } from '../../common/runtimeDocumentStore.js';

export type LiveCapacityOption = {
  participantLimit: number;
  priceNaira: number;
  label: string;
};

export type PlatformSettings = {
  liveMeetings: {
    defaultParticipantLimit: number;
    schoolConcurrentLimit: number;
    upgradeOptions: LiveCapacityOption[];
  };
  economy: {
    currencyName: string;
    currencyPlural: string;
    currencySymbol: string;
    aiUnitsPerNaira: number;
    cashoutNairaPerUnit: number;
    adRewardPerImpression: number;
  };
};

const NAMESPACE = 'platform-settings';

function defaultSettings(): PlatformSettings {
  return {
    liveMeetings: {
      defaultParticipantLimit: 50,
      schoolConcurrentLimit: 5,
      upgradeOptions: [
        { participantLimit: 100, priceNaira: 15000, label: 'Starter expansion' },
        { participantLimit: 150, priceNaira: 22500, label: 'Growth expansion' },
        { participantLimit: 200, priceNaira: 30000, label: 'Scale expansion' },
        { participantLimit: 300, priceNaira: 45000, label: 'Summit expansion' },
      ],
    },
    economy: {
      currencyName: 'Keyu',
      currencyPlural: 'Keyu',
      currencySymbol: 'K',
      aiUnitsPerNaira: 3,
      cashoutNairaPerUnit: 1,
      adRewardPerImpression: 1,
    },
  };
}

export async function getPlatformSettings() {
  return readDocument<PlatformSettings>(NAMESPACE, GLOBAL_SCOPE, defaultSettings);
}

export async function savePlatformSettings(settings: PlatformSettings) {
  return writeDocument(NAMESPACE, GLOBAL_SCOPE, settings);
}