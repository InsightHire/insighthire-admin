'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import Link from 'next/link';
import { Mail, Phone, Building2, Calendar, MessageSquare, ArrowLeft, ChevronDown, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'customer', label: 'Customer' },
  { value: 'lost', label: 'Lost' },
] as const;

export default function LeadsPage() {
  const { isLoading: authLoading } = useAdminAuth();
  const [filter, setFilter] = useState<'all' | 'new' | 'contacted' | 'qualified'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: leads, isLoading, refetch } = trpc.platformAdmin.getLeads.useQuery({
    status: filter === 'all' ? undefined : filter,
  }, {
    enabled: !authLoading,
  });

  const updateLeadStatus = trpc.platformAdmin.updateLeadStatus.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const deleteLead = trpc.platformAdmin.deleteLead.useMutation({
    onSuccess: () => {
      refetch();
      setDeletingId(null);
    },
    onError: (err) => {
      alert('Failed to delete lead: ' + err.message);
      setDeletingId(null);
    },
  });

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await updateLeadStatus.mutateAsync({
        leadId,
        status: newStatus as any,
      });
    } catch (error: any) {
      alert('Failed to update status: ' + error.message);
    }
  };

  const handleDelete = async (leadId: string, companyName: string) => {
    if (!confirm(`Delete lead "${companyName}"? This cannot be undone.`)) return;
    setDeletingId(leadId);
    try {
      await deleteLead.mutateAsync({ leadId });
    } catch (_) {
      // error handled in onError
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-muted">Growth</p>
          <h1 className="text-2xl font-bold tracking-tight text-admin-ink">Contact Leads</h1>
          <p className="mt-1 text-sm text-admin-muted">Sales inquiries and demo requests</p>
        </div>
        <Link
          href="/"
          className="flex items-center space-x-2 text-admin-muted hover:text-admin-ink"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="admin-panel mb-6 p-4">
        <div className="flex space-x-2">
          {['all', 'new', 'contacted', 'qualified'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status as any)}
              className={`rounded-admin-sm px-4 py-2 font-medium transition-colors ${
                filter === status
                  ? 'bg-admin-ink text-white'
                  : 'bg-slate-100 text-admin-secondary hover:bg-slate-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Leads List */}
      <div className="admin-panel overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
            <p className="text-admin-muted">Loading leads...</p>
          </div>
        ) : leads && leads.length > 0 ? (
          <div className="divide-y divide-admin-border">
            {leads.map((lead: any) => (
              <div key={lead.id} className="p-6 hover:bg-slate-50/80">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                        <Building2 className="h-5 w-5 text-gray-400" />
                        <h3 className="text-lg font-semibold text-gray-900">
                          {lead.companyName || 'Unknown Company'}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            lead.status === 'new'
                              ? 'bg-green-100 text-green-800'
                              : lead.status === 'contacted'
                              ? 'bg-blue-100 text-blue-800'
                              : lead.status === 'qualified'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {lead.status}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        {lead.contactName && (
                          <p className="flex items-center space-x-2">
                            <span className="font-medium">{lead.contactName}</span>
                          </p>
                        )}
                        {lead.email && (
                          <p className="flex items-center space-x-2">
                            <Mail className="h-4 w-4" />
                            <a href={`mailto:${lead.email}`} className="hover:text-blue-600">
                              {lead.email}
                            </a>
                          </p>
                        )}
                        {lead.phone && (
                          <p className="flex items-center space-x-2">
                            <Phone className="h-4 w-4" />
                            <span>{lead.phone}</span>
                          </p>
                        )}
                        {lead.message && (
                          <p className="flex items-center space-x-2 mt-2">
                            <MessageSquare className="h-4 w-4" />
                            <span className="italic">{lead.message}</span>
                          </p>
                        )}
                        <p className="flex items-center space-x-2 text-xs text-gray-500">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(lead.createdAt).toLocaleString()}</span>
                        </p>
                      </div>
                    </div>

                    <div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            disabled={updateLeadStatus.isLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 bg-white hover:bg-gray-50 disabled:opacity-50"
                          >
                            <span>{STATUS_OPTIONS.find((s) => s.value === lead.status)?.label ?? lead.status}</span>
                            <ChevronDown className="h-4 w-4 text-gray-700 shrink-0" aria-hidden />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {STATUS_OPTIONS.map((opt) => (
                            <DropdownMenuItem
                              key={opt.value}
                              onClick={() => lead.status !== opt.value && handleStatusChange(lead.id, opt.value)}
                              className="text-gray-900"
                            >
                              {opt.label}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDelete(lead.id, lead.companyName || 'Unknown')}
                            disabled={deletingId === lead.id}
                            className="text-gray-700 hover:bg-gray-100 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete lead
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <Mail className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No leads found</p>
              <p className="text-sm mt-2">New contact form submissions will appear here</p>
            </div>
          )}
        </div>
    </div>
  );
}
