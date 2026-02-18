import { useMemo, useState } from "react";
import { displayName } from "@/components/dashboard/applications/utils";
import type { SelectedApplicationMap } from "@/components/dashboard/applications/types";
import type { ApplicationListItem } from "@/types/application";

type Params = {
  scopeKey: string;
};

const EMPTY_SELECTION: SelectedApplicationMap = {};

export function useApplicationSelection({ scopeKey }: Params) {
  const [selectedByScope, setSelectedByScope] = useState<Record<string, SelectedApplicationMap>>({});
  const selectedMap = selectedByScope[scopeKey] ?? EMPTY_SELECTION;

  const selectedIds = useMemo(() => Object.keys(selectedMap), [selectedMap]);
  const selectedCount = selectedIds.length;

  const clearSelection = () => {
    setSelectedByScope((prev) => ({
      ...prev,
      [scopeKey]: {},
    }));
  };

  const replaceSelection = (nextSelection: SelectedApplicationMap) => {
    setSelectedByScope((prev) => ({
      ...prev,
      [scopeKey]: nextSelection,
    }));
  };

  const toggleSelection = (item: ApplicationListItem) => {
    setSelectedByScope((prev) => {
      const current = prev[scopeKey] ?? {};
      const next = { ...current };
      if (next[item.applicationId]) {
        delete next[item.applicationId];
      } else {
        next[item.applicationId] = {
          applicationId: item.applicationId,
          name: displayName(item),
        };
      }
      return {
        ...prev,
        [scopeKey]: next,
      };
    });
  };

  const isSelected = (applicationId: string) => Boolean(selectedMap[applicationId]);

  const isAllCurrentPageSelected = (items: ApplicationListItem[]) =>
    items.length > 0 && items.every((item) => Boolean(selectedMap[item.applicationId]));

  const toggleCurrentPageSelection = (items: ApplicationListItem[]) => {
    const allSelected = isAllCurrentPageSelected(items);

    setSelectedByScope((prev) => {
      const current = prev[scopeKey] ?? {};
      const next = { ...current };

      if (allSelected) {
        for (const item of items) {
          delete next[item.applicationId];
        }
      } else {
        for (const item of items) {
          next[item.applicationId] = {
            applicationId: item.applicationId,
            name: displayName(item),
          };
        }
      }

      return {
        ...prev,
        [scopeKey]: next,
      };
    });
  };

  return {
    selectedMap,
    selectedIds,
    selectedCount,
    clearSelection,
    replaceSelection,
    toggleSelection,
    isSelected,
    isAllCurrentPageSelected,
    toggleCurrentPageSelection,
  };
}
