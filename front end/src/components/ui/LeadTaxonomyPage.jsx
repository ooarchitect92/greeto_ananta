import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './Card.jsx';
import { Button } from './Button.jsx';
import GreetoLoader from './GreetoLoader.jsx';
import { Plus } from 'lucide-react';

export const TAXONOMY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#6366f1', '#ec4899', '#ef4444', '#22c55e', '#0ea5e9', '#f97316', '#64748b', '#1e293b'];

export function getTaxonomyAuthHeaders() {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : undefined };
}

// Shared shell for Lead Status / Lead Stage (and similar simple CRM-taxonomy CRUD pages):
// header + stat cards + entity grid + loading/empty states. Each entity card and the create/edit
// modal stay page-specific (passed in as `renderCard` / rendered by the caller) since their
// layouts genuinely differ — this only extracts the ~70% that was byte-for-byte duplicated.
export default function LeadTaxonomyPage({
  eyebrow,
  title,
  description,
  headerIcon: HeaderIcon,
  extraHeaderBadge,
  onCreate,
  createLabel,
  statCards = [],
  listIcon: ListIcon,
  listTitle,
  loading,
  loadingLabel,
  loadingSublabel,
  items = [],
  emptyIcon: EmptyIcon,
  emptyMessage,
  emptyCreateLabel,
  gridClassName = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3',
  renderCard,
  children,
}) {
  return (
    <div className="flex-1 overflow-y-auto bg-[#f3f1f8]">
      <div className="p-8">
        <div className="rounded-[28px] border border-white bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-700 to-fuchsia-500 text-white shadow-lg shadow-purple-200">
                <HeaderIcon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-500">{eyebrow}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-950">{title}</h1>
                  {extraHeaderBadge}
                </div>
                <p className="mt-1 text-sm text-slate-500">{description}</p>
              </div>
            </div>
            <Button
              onClick={onCreate}
              className="h-12 rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-5 shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700"
            >
              <Plus className="mr-2 h-4 w-4" /> {createLabel}
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <div className="grid gap-5 md:grid-cols-3">
            {statCards.map((card) => (
              <Card key={card.label} className="overflow-hidden rounded-3xl border-white bg-white shadow-sm">
                <CardContent className="p-5">
                  <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl ${card.iconBg} ${card.iconColor}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                  {card.content ? card.content : (
                    <p className="mt-1 text-2xl font-bold text-slate-950">{card.value}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden rounded-[28px] border-white bg-white shadow-sm">
            <CardHeader className="border-b border-purple-50 px-6 py-5">
              <CardTitle className="flex items-center gap-3 text-base">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                  <ListIcon className="h-5 w-5" />
                </span>
                <span>{listTitle}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <GreetoLoader label={loadingLabel} sublabel={loadingSublabel} />
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-[28px] border border-dashed border-purple-200 bg-purple-50/40 py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-purple-600 shadow-sm">
                    <EmptyIcon className="h-7 w-7" />
                  </div>
                  <p className="font-semibold text-slate-700">{emptyMessage}</p>
                  <Button className="rounded-2xl bg-purple-700 hover:bg-purple-800" onClick={onCreate}>{emptyCreateLabel}</Button>
                </div>
              ) : (
                <div className={gridClassName}>
                  {items.map((item, index) => renderCard(item, index))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {children}
    </div>
  );
}
