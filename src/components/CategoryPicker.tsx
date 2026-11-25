import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryIcon } from './CategoryIcon';
import { categoryName, isSelectable } from '../db/categories';
import { currentLocale } from '../i18n';
import type { AgeBand, Category } from '../types';

interface Props {
  categories: Category[];
  bands: Set<AgeBand>;
  recentIds: string[];
  /** Selected subcategory id. */
  value: string | null;
  onChange: (subcategoryId: string) => void;
}

/**
 * Two-level icon selector: tap a category, then a subcategory. A "Recent" row offers the
 * last-used subcategories in one tap. Age-banded child subcategories appear only while a
 * child is in that band — except the one already on an expense being edited.
 */
export function CategoryPicker({ categories, bands, recentIds, value, onChange }: Props) {
  const { t } = useTranslation();
  const locale = currentLocale();

  const offered = (c: Category) => isSelectable(c, bands) || c.id === value;
  const tops = useMemo(
    () => categories
      .filter((c) => c.parentId === null && c.deletedAt === null && c.enabled)
      .filter((top) => categories.some((s) => s.parentId === top.id && offered(s)))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    [categories, bands, value],
  );
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const recent = recentIds.map((id) => byId.get(id)).filter((c): c is Category => !!c && c.parentId !== null && offered(c));

  const [openTop, setOpenTop] = useState<string | null>(value ? (byId.get(value)?.parentId ?? null) : null);
  useEffect(() => {
    if (value) setOpenTop(byId.get(value)?.parentId ?? null);
  }, [value, byId]);

  const subs = categories
    .filter((c) => c.parentId === openTop && offered(c))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="stack" style={{ gap: 'var(--sp-md)' }}>
      {recent.length > 0 && (
        <div className="field" title={t('expense.recentHint')}>
          <span className="field-label">{t('expense.recent')}</span>
          <div className="chips">
            {recent.map((c) => (
              <button key={c.id} type="button" className={`chip${value === c.id ? ' selected' : ''}`}
                aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
                <CategoryIcon name={c.icon} size={16} /> {categoryName(c, locale)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field" title={t('expense.categoryHint')}>
        <span className="field-label">{t('expense.category')}</span>
        <div className="cat-grid">
          {tops.map((c) => (
            <button key={c.id} type="button" className={`cat-tile${openTop === c.id ? ' selected' : ''}`}
              aria-pressed={openTop === c.id} onClick={() => setOpenTop(c.id)} title={categoryName(c, locale)}>
              <CategoryIcon name={c.icon} size={24} />
              <span>{categoryName(c, locale)}</span>
            </button>
          ))}
        </div>
      </div>

      {openTop && (
        <div className="field" title={t('expense.chooseSubcategory')}>
          <span className="field-label">{t('expense.subcategory')}</span>
          <div className="chips">
            {subs.map((c) => (
              <button key={c.id} type="button" className={`chip${value === c.id ? ' selected' : ''}`}
                aria-pressed={value === c.id} onClick={() => onChange(c.id)}>
                <CategoryIcon name={c.icon} size={16} /> {categoryName(c, locale)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
