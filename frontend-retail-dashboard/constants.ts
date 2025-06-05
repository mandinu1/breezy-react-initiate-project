import { FilterOption, ProviderConfig } from './types';

export const API_BASE_URL = '/api';

export const PROVIDERS_CONFIG: ProviderConfig[] = [
  { value: 'all', label: 'All Providers', name: 'All', key: 'all', color: '#718096' },
  { value: 'dialog', label: 'Dialog', name: 'Dialog', key: 'dialog', color: '#bb1118', logoUrl: '/assets/provider-logos/Dialog.png' },
  { value: 'mobitel', label: 'Mobitel', name: 'Mobitel', key: 'mobitel', color: '#53ba4e', logoUrl: '/assets/provider-logos/mobitel.jpg' },
  { value: 'airtel', label: 'Airtel', name: 'Airtel', key: 'airtel', color: '#ed1b25', logoUrl: '/assets/provider-logos/airtel.png' },
  { value: 'hutch', label: 'Hutch', name: 'Hutch', key: 'hutch', color: '#ff6b08', logoUrl: '/assets/provider-logos/hutch.png' },
];

export const PROVIDER_FILTER_OPTIONS: FilterOption[] = PROVIDERS_CONFIG.map(p => ({ value: p.value, label: p.label }));

export const BOARD_TYPES: FilterOption[] = [
  { value: 'dealer', label: 'Dealer Board' },
  { value: 'tin', label: 'Tin Board' }, // Changed from "Tin Plate"
  { value: 'vertical', label: 'Vertical Board' },
];

export const POSM_STATUSES: FilterOption[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'increase', label: 'Dominant' },
  { value: 'decrease', label: 'Not Dominant' },
];

export const PROVINCES_STATIC_EXAMPLE: FilterOption[] = [
  { value: 'all', label: 'All Provinces' },
  { value: 'western', label: 'Western' },
  { value: 'central', label: 'Central' },
];

export const DISTRICTS_BY_PROVINCE_STATIC_EXAMPLE: { [key: string]: FilterOption[] } = {
  all: [{ value: 'all', label: 'All Districts' }],
  western: [
    { value: 'all', label: 'All Districts (Western)' },
    { value: 'colombo', label: 'Colombo' },
  ],
};