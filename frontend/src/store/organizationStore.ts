import { create } from 'zustand';

export interface Operation {
  id: string; // SCAC
  name: string;
}

export interface Client {
  id: string;
  name: string;
  operations: Operation[];
}

export interface Entity {
  id: string;
  name: string;
  clients: Client[];
}

interface OrganizationState {
  entities: Entity[];
}

const sampleData: Entity[] = [
  {
    id: 'ent1',
    name: 'Logistics Group',
    clients: [
      {
        id: 'cli1',
        name: 'TransCo Logistics',
        operations: [
          { id: 'TRNS', name: 'Main Line' },
          { id: 'WEST', name: 'West Division' },
        ],
      },
    ],
  },
  {
    id: 'ent2',
    name: 'Healthcare Holdings',
    clients: [
      {
        id: 'cli2',
        name: 'HealthCare Solutions',
        operations: [{ id: 'HLTH', name: 'Primary' }],
      },
    ],
  },
];

export const useOrganizationStore = create<OrganizationState>(() => ({
  entities: sampleData,
}));
