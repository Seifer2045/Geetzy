import { useMemo } from 'react';
import { useCategories } from '@/api/hooks';
import type { IconName } from '@/components/Icon';
import { categoryIcon, OCCASIONS } from '@/constants/catalog';

export type CategoryTile = {
  /** Category slug. Same as the old occasion id for Birthday / Anniversary / Apology / Festival. */
  id: string;
  label: string;
  icon: IconName;
  emoji?: string | null;
  colors: readonly [string, string];
  soon?: boolean;
};

/**
 * Chips / tiles for Home, Explore and Templates. Comes from the server so the admin can add, hide and
 * reorder categories without an app update. Until it loads (or when offline) the built-in list is shown.
 */
export const useCategoryTiles = (): CategoryTile[] => {
  const { data } = useCategories();
  return useMemo(
    () =>
      data && data.length > 0
        ? data.map((c) => ({ id: c.slug, label: c.name, icon: categoryIcon(c.slug), emoji: c.emoji, colors: c.colors }))
        : OCCASIONS.map((o) => ({ ...o })),
    [data],
  );
};
