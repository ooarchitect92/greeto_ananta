import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Filter, Plus, Edit2, Upload, FileText } from 'lucide-react';
import { listWhatsappFlows, syncWhatsappFlows } from './api.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Card } from '../../components/ui/Card.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';

export default function FlowsList({ onCreate }) {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    setLoading(true);
    try {
      const data = await listWhatsappFlows();
      setFlows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncWhatsappFlows();
      await loadFlows();
    } catch (err) {
      console.error(err);
      alert('Failed to sync flows');
    } finally {
      setSyncing(false);
    }
  };

  const filteredFlows = flows.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 h-full overflow-y-auto space-y-6 bg-[#f3f1f8]">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-white shadow-sm border border-purple-100 flex items-center justify-center">
          <FileText className="w-7 h-7 text-purple-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-950">WhatsApp Forms</h1>
          <p className="text-slate-500">Create and sync interactive WhatsApp flow experiences.</p>
        </div>
        </div>
        <Button className="bg-gradient-to-r from-purple-700 to-fuchsia-600 hover:from-purple-800 hover:to-fuchsia-700 text-white rounded-2xl px-5 py-3 shadow-lg shadow-purple-200" onClick={onCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Create New Form
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Total Forms</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{flows.length}</div>
        </div>
        <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Published</div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{flows.filter((flow) => flow.status === 'PUBLISHED').length}</div>
        </div>
        <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">Draft/Other</div>
          <div className="mt-2 text-2xl font-bold text-purple-700">{flows.filter((flow) => flow.status !== 'PUBLISHED').length}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border border-white shadow-sm">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name"
            className="pl-9 h-11 rounded-2xl border-purple-100 bg-purple-50/40 focus:ring-purple-200"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-2xl border-emerald-100 bg-emerald-50 text-emerald-700" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Data
          </Button>
          <Button variant="outline" className="rounded-2xl border-purple-100 bg-white text-slate-700">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <Card className="overflow-hidden border-white shadow-sm rounded-3xl bg-white">
        <div className="p-5 border-b border-purple-100 bg-white">
          <h3 className="font-bold text-slate-900">WhatsApp Forms Details</h3>
          <p className="text-xs text-slate-500 mt-1">Synced flows, status and response activity.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-purple-50/60 text-slate-500 font-medium border-b border-purple-100">
              <tr>
                <th className="px-6 py-4">Form Name</th>
                <th className="px-6 py-4">Form ID</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Responses</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50 bg-white">
              {loading ? (
                 <tr>
                   <td colSpan="5" className="px-6 py-10 text-center text-slate-500">
                     <GreetoLoader label="Loading flows..." sublabel="Fetching WhatsApp forms" />
                   </td>
                 </tr>
              ) : filteredFlows.length === 0 ? (
                 <tr>
                   <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                     <p>No forms found.</p>
                     <p className="text-xs mt-1">Click "Sync Data" to fetch from Meta or create a new one.</p>
                   </td>
                 </tr>
              ) : (
                filteredFlows.map((flow) => (
                  <tr key={flow.id} className="hover:bg-purple-50/60 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900">{flow.name}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{flow.flow_id}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        flow.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        flow.status === 'DEPRECATED' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {flow.status || 'DRAFT'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">0</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 hover:bg-purple-50 rounded-xl text-slate-400 hover:text-purple-700 transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-emerald-50 rounded-xl text-slate-400 hover:text-emerald-600 transition-colors" title="Sync/Upload">
                          <Upload className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

