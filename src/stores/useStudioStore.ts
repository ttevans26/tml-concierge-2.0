import { create } from "zustand";

export type StudioCategory = "stays" | "dining" | "activity" | "sites";

export interface StudioItem {
  id: string;
  folderId: string;
  category: StudioCategory;
  title: string;
  description: string | null;
  address: string | null;
  url: string | null;
  lat: number | null;
  lng: number | null;
  cost: number | null;
  createdAt: string;
}

export interface StudioFolder {
  id: string;
  name: string;
  location: string;
  isGlobal: boolean;
  items: StudioItem[];
}

interface StudioStore {
  folders: StudioFolder[];
  activeFolder: StudioFolder | null;
  setActiveFolder: (folder: StudioFolder | null) => void;
  addFolder: (name: string, location: string) => void;
  addItem: (folderId: string, item: Omit<StudioItem, "id" | "folderId" | "createdAt">) => void;
  deleteItem: (folderId: string, itemId: string) => void;
  deleteFolder: (folderId: string) => void;
}

const randomId = () => crypto.randomUUID();

const DEFAULT_FOLDERS: StudioFolder[] = [
  {
    id: "inspiration-default",
    name: "Random Interests & Inspiration",
    location: "Global",
    isGlobal: true,
    items: [],
  },
];

export const useStudioStore = create<StudioStore>((set, get) => ({
  folders: DEFAULT_FOLDERS,
  activeFolder: null,

  setActiveFolder: (folder) => set({ activeFolder: folder }),

  addFolder: (name, location) => {
    const folder: StudioFolder = {
      id: randomId(),
      name,
      location,
      isGlobal: false,
      items: [],
    };
    set({ folders: [...get().folders, folder] });
  },

  addItem: (folderId, itemData) => {
    const item: StudioItem = {
      ...itemData,
      id: randomId(),
      folderId,
      createdAt: new Date().toISOString(),
    };
    const folders = get().folders.map((f) =>
      f.id === folderId ? { ...f, items: [...f.items, item] } : f
    );
    const activeFolder = get().activeFolder;
    set({
      folders,
      activeFolder: activeFolder?.id === folderId
        ? folders.find((f) => f.id === folderId) || null
        : activeFolder,
    });
  },

  deleteItem: (folderId, itemId) => {
    const folders = get().folders.map((f) =>
      f.id === folderId ? { ...f, items: f.items.filter((i) => i.id !== itemId) } : f
    );
    const activeFolder = get().activeFolder;
    set({
      folders,
      activeFolder: activeFolder?.id === folderId
        ? folders.find((f) => f.id === folderId) || null
        : activeFolder,
    });
  },

  deleteFolder: (folderId) => {
    set({
      folders: get().folders.filter((f) => f.id !== folderId),
      activeFolder: get().activeFolder?.id === folderId ? null : get().activeFolder,
    });
  },
}));
