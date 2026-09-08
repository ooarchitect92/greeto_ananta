import React, { useState, useEffect } from 'react';
import { getWorkflowRuns, retryWorkflowRun } from './api.js';
import { ArrowLeft, RefreshCw, XCircle, CheckCircle, Clock, Search, ChevronDown, ChevronRight, Play } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';

export default function RunsHistoryPanel({ workflow, onClose }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRun, setExpandedRun] = useState(null);

  useEffect(() => {
    fetchRuns();
  }, [workflow.id]);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const data = await getWorkflowRuns(workflow.id);
      setRuns(data.runs || []);
    } catch (err) {
      console.error('Failed to load runs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (runId) => {
    try {
      await retryWorkflowRun(workflow.id, runId);
      fetchRuns();
    } catch (err) {
      console.error(err);
      alert('Failed to retry workflow run');
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      <div className="flex items-center justify-between bg-white px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{workflow.name} - Run History</h1>
            <p className="text-sm text-slate-500">View execution logs and retry failed runs</p>
          </div>
        </div>
        <Button onClick={fetchRuns} variant="outline" className="gap-2">
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="text-center py-10 text-slate-500">Loading runs...</div>
          ) : runs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
              <Clock size={40} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">No runs yet</h3>
              <p className="text-sm text-slate-500 mt-1">This workflow hasn't been executed yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {runs.map(run => (
                <div key={run.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                  >
                    <div className="flex items-center gap-4">
                      {run.status === 'completed' ? (
                        <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                          <CheckCircle size={20} />
                        </div>
                      ) : run.status === 'failed' ? (
                        <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                          <XCircle size={20} />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                          <Clock size={20} />
                        </div>
                      )}
                      
                      <div>
                        <div className="font-semibold text-slate-900">{run.phone_number}</div>
                        <div className="text-sm text-slate-500">{formatDate(run.started_at)}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <div className="text-sm font-medium capitalize text-slate-700">{run.status}</div>
                        <div className="text-xs text-slate-500">{run.duration_ms ? `${run.duration_ms}ms` : '-'}</div>
                      </div>
                      
                      {run.status === 'failed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRetry(run.id);
                          }}
                        >
                          <Play size={14} /> Retry
                        </Button>
                      )}
                      
                      <div className="text-slate-400">
                        {expandedRun === run.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                    </div>
                  </div>

                  {expandedRun === run.id && (
                    <div className="border-t border-slate-100 bg-slate-50 p-4 text-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-semibold text-slate-700 mb-2">Context</h4>
                          <pre className="bg-slate-900 text-slate-300 p-3 rounded-lg overflow-x-auto text-xs font-mono">
                            {JSON.stringify(run.context_preview, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-700 mb-2">Execution Trace</h4>
                          {run.error_message && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-xs font-mono">
                              {run.error_message}
                            </div>
                          )}
                          <pre className="bg-slate-900 text-slate-300 p-3 rounded-lg overflow-x-auto text-xs font-mono max-h-[300px] overflow-y-auto">
                            {JSON.stringify(run.execution_log, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
