import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export type StudioCategory = "stays" | "dining" | "activity" | "sites";

export interface StudioItem {
  id: string;
  folder_id: string;
  user_id: string;
  category: StudioCategory;
  title: string;
  description: string | null;
  address: string | null;
  url: string | null;
  lat: number | null;
  lng: number | null;
  cost: number | null;
  google_place_id: string | null;
  source_url: string | null;
  api_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StudioFolder {
  id: string;
  user_id: string;
  name: string;
  location: string;
  is_global: boolean;
  created_at: string;
  updated_at: string;
  items: StudioItem[];
}

interface StudioStore {
  folders: StudioFolder[];
  activeFolder: StudioFolder | null;
  loading: boolean;
  anchorItemId: string | null;

  fetchFolders: () => Promise<void>;
  setActiveFolder: (folder: StudioFolder | null) => void;
  addFolder: (name: string, location: string) => Promise<StudioFolder | null>;
  addItem: (folderId: string, item: Omit<StudioItem, "id" | "folder_id" | "user_id" | "created_at" | "updated_at">) => Promise<StudioItem | null>;
  deleteItem: (folderId: string, itemId: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  setAnchorItem: (itemId: string | null) => void;
}

export const useStudioStore = create<StudioStore>((set, get) => ({
  folders: [],
  activeFolder: null,
  loading: false,
  anchorItemId: null,

  fetchFolders: async () => {
    set({ loading: true });
    const { data: folders, error } = await supabase
      .from("studio_folders")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("fetchFolders error:", error);
      set({ loading: false });
      return;
    }

    const folderIds = (folders || []).map((f: any) => f.id);
    let items: any[] = [];
    if (folderIds.length > 0) {
      const { data, error: itemsErr } = await supabase
        .from("studio_items")
        .select("*")
        .in("folder_id", folderIds)
        .order("created_at", { ascending: true });
      if (!itemsErr && data) items = data;
    }

    const enriched: StudioFolder[] = (folders || []).map((f: any) => ({
      ...f,
      items: items.filter((i: any) => i.folder_id === f.id) as StudioItem[],
    }));

    const activeFolder = get().activeFolder;
    set({
      folders: enriched,
      activeFolder: activeFolder
        ? enriched.find((f) => f.id === activeFolder.id) || null
        : null,
      loading: false,
    });
  },

  setActiveFolder: (folder) => set({ activeFolder: folder }),

  addFolder: async (name, location) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("studio_folders")
      .insert({ name, location, user_id: user.id } as any)
      .select()
      .single();

    if (error || !data) {
      console.error("addFolder error:", error);
      return null;
    }

    const folder: StudioFolder = { ...(data as any), items: [] };
    set({ folders: [...get().folders, folder] });
    return folder;
  },

  addItem: async (folderId, itemData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("studio_items")
      .insert({ ...itemData, folder_id: folderId, user_id: user.id } as any)
      .select()
      .single();

    if (error || !data) {
      console.error("addItem error:", error);
      return null;
    }

    const item = data as StudioItem;
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
    return item;
  },

  deleteItem: async (folderId, itemId) => {
    const { error } = await supabase.from("studio_items").delete().eq("id", itemId);
    if (error) {
      console.error("deleteItem error:", error);
      return;
    }

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

  deleteFolder: async (folderId) => {
    const { error } = await supabase.from("studio_folders").delete().eq("id", folderId);
    if (error) {
      console.error("deleteFolder error:", error);
      return;
    }

    set({
      folders: get().folders.filter((f) => f.id !== folderId),
      activeFolder: get().activeFolder?.id === folderId ? null : get().activeFolder,
    });
  },

  setAnchorItem: (itemId) => set({ anchorItemId: itemId }),
}));
