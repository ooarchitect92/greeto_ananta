import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Clock3, ExternalLink, GitBranch, RefreshCw, TimerReset } from 'lucide-react';
import { getWorkflowsKanban } from './api.js';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import { Button } from '../../components/ui/Button.jsx';

function formatDelay(minutes) {
  const value = Number(minutes || 0);
  if (!value) return 'Starts immediately after the previous workflow';
  const days = Math.floor(value / 1440);
  const hours = Math.floor((value % 1440) / 60);
  const mins = value % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins) parts.push(`${mins}m`);
  return `Wait ${parts.join(' ')} after the previous workflow`;
}

export default function SequencesPage({ onOpenWorkflow }) {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sequences = useMemo(
    () => columns.filter((column) => Array.isArray(column.workflows) && column.workflows.length > 0),
    [columns]
  );

  const loadSequences = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getWorkflowsKanban();
      setColumns(Array.isArray(result?.columns) ? result.columns : []);
    } catch (err) {
      setError(err.message || 'Unable to load sequences');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSequences(); }, []);

  if (loading) return <GreetoLoader label="Loading sequences..." sublabel="Reading workflow stages and timing" />;

  return (
    <main className="flex-1 overflow-auto bg-[#f8f7fc] px-5 py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-purple-700"><TimerReset size={16} /> Sequences</div>
            <h1 className="text-2xl font-bold text-slate-950">Drip Sequences</h1>
            <p className="mt-1 text-sm text-slate-500">A stage-based view of linked workflows, delays, and execution timing.</p>
          </div>
          <Button variant="outline" onClick={loadSequences} className="gap-2"><RefreshCw size={16} /> Refresh</Button>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : sequences.length === 0 ? (
          <section className="rounded-lg border border-dashed border-purple-200 bg-white px-6 py-16 text-center">
            <GitBranch className="mx-auto mb-3 text-purple-500" size={30} />
            <h2 className="text-lg font-bold text-slate-900">No drip sequences yet</h2>
            <p className="mt-2 text-sm text-slate-500">Assign workflows to a lead stage in Workflows to build a sequence.</p>
          </section>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {sequences.map((column) => (
              <section key={column.stage.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{column.stage.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{column.workflows.length} workflow{column.workflows.length === 1 ? '' : 's'} in this sequence</div>
                  </div>
                  <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">Stage sequence</span>
                </header>
                <div className="p-5">
                  {column.workflows.map((workflow, index) => (
                    <React.Fragment key={workflow.id}>
                      <button
                        type="button"
                        onClick={() => onOpenWorkflow?.({ ...workflow, stageName: column.stage.name })}
                        className="group flex w-full items-center justify-between gap-4 rounded-lg border border-slate-200 p-4 text-left transition hover:border-purple-300 hover:bg-purple-50/50"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">{index + 1}</span>
                            <span className="truncate text-sm font-semibold text-slate-900">{workflow.name}</span>
                          </div>
                          <p className="mt-1 pl-8 text-xs text-slate-500">{workflow.status === 'active' ? 'Active' : 'Inactive'} workflow</p>
                        </div>
                        <ExternalLink className="shrink-0 text-slate-400 group-hover:text-purple-700" size={16} />
                      </button>
                      {index < column.workflows.length - 1 && (
                        <div className="flex items-center gap-2 py-3 pl-3 text-xs text-slate-500">
                          <Clock3 size={14} className="text-purple-600" />
                          <ArrowRight size={14} className="text-slate-300" />
                          <span>{workflow.isIndependent ? 'Next workflow is independent' : formatDelay(column.workflows[index + 1].delayMinutes)}</span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
