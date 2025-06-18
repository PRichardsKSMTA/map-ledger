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
    name: 'TMS',
    clients: [
      {
        id: 'cli1',
        name: 'CarrierOne',
        operations: [{ id: 'CO1', name: 'Mainline' }],
      },
      {
        id: 'cli2',
        name: 'CarrierTwo',
        operations: [
          { id: 'CT1', name: 'Linehaul' },
          { id: 'CT2', name: 'Intermodal' },
        ],
      },
    ],
  },
  {
    id: 'ent2',
    name: 'TMS2',
    clients: [
      {
        id: 'cli3',
        name: 'CarrierThree',
        operations: [{ id: 'C3P', name: 'Primary' }],
      },
    ],
  },
  {
    id: 'ent3',
    name: 'TMS3',
    clients: [
      {
        id: 'cli4',
        name: 'CarrierFour',
        operations: [{ id: 'C4P', name: 'Primary' }],
      },
    ],
  },
];

export const useOrganizationStore = create<OrganizationState>(() => ({
  entities: sampleData,
}));
