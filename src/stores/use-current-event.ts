import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CurrentEvent = {
  id: string;
  name: string;
  brand_color: string;
};

type Store = {
  current: CurrentEvent | null;
  setCurrent: (e: CurrentEvent | null) => void;
};

export const useCurrentEvent = create<Store>()(
  persist(
    (set) => ({
      current: null,
      setCurrent: (e) => set({ current: e }),
    }),
    { name: "passly:current-event" },
  ),
);