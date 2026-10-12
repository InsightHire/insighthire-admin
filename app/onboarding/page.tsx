'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { 
  BuildingOfficeIcon, 
  UserPlusIcon, 
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { AdminPageChrome } from '@/components/admin/page-chrome';
import { SectionCard, DetailList } from '@/components/admin/section-card';
import { buttonClass, inputClass, selectClass } from '@/components/admin/controls';

type Step = 'create-org' | 'invite-admin' | 'complete';

const labelClass = 'block text-sm font-medium text-admin-secondary mb-1';

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('create-org');
  const [createdOrg, setCreatedOrg] = useState<any>(null);
  const [invitedUser, setInvitedUser] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Form states
  const [orgForm, setOrgForm] = useState({
    name: '',
    domain: '',
    industry: 'TECHNOLOGY',
    size: 'SMALL',
    subscriptionPlan: 'TRIAL',
    trialDays: 14,
  });

  const [adminForm, setAdminForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'ADMIN',
  });

  const createOrgMutation = trpc.platformAdmin.createOrganization.useMutation({
    onSuccess: (data) => {
      setCreatedOrg(data.organization);
      setStep('invite-admin');
    },
  });

  const inviteAdminMutation = trpc.platformAdmin.inviteOrgAdmin.useMutation({
    onSuccess: (data) => {
      setInvitedUser(data);
      setStep('complete');
    },
  });

  const handleCreateOrg = (e: React.FormEvent) => {
    e.preventDefault();
    createOrgMutation.mutate({
      name: orgForm.name,
      domain: orgForm.domain || undefined,
      industry: orgForm.industry as any,
      size: orgForm.size as any,
      subscriptionPlan: orgForm.subscriptionPlan as any,
      trialDays: orgForm.trialDays,
    });
  };

  const handleInviteAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createdOrg) return;
    
    inviteAdminMutation.mutate({
      organizationId: createdOrg.id,
      email: adminForm.email,
      firstName: adminForm.firstName,
      lastName: adminForm.lastName,
      role: adminForm.role as any,
    });
  };

  const copyInviteUrl = () => {
    if (invitedUser?.invitation?.acceptUrl) {
      navigator.clipboard.writeText(invitedUser.invitation.acceptUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const startOver = () => {
    setStep('create-org');
    setCreatedOrg(null);
    setInvitedUser(null);
    setOrgForm({
      name: '',
      domain: '',
      industry: 'TECHNOLOGY',
      size: 'SMALL',
      subscriptionPlan: 'TRIAL',
      trialDays: 14,
    });
    setAdminForm({
      email: '',
      firstName: '',
      lastName: '',
      role: 'ADMIN',
    });
  };

  return (
    <AdminPageChrome
      width="narrow"
      icon={<BuildingOfficeIcon />}
      breadcrumbs={[{ label: 'Tenants', href: '/organizations' }, { label: 'Onboard customer' }]}
      title="Onboard New Customer"
      description="Create a new organization and invite their admin"
    >
      {/* Progress Steps */}
      <div className="admin-panel mb-6 px-5 py-4">
        <div className="flex items-center text-sm">
          <div className={`flex items-center ${step === 'create-org' ? 'text-admin-accent-ink' : 'text-admin-ok'}`}>
            <div className={`w-9 h-9 rounded-full border flex items-center justify-center ${
              step === 'create-org' ? 'bg-admin-accent-soft border-admin-accent-border' : 'bg-admin-ok-soft border-admin-ok/20'
            }`}>
              {step !== 'create-org' ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                <BuildingOfficeIcon className="w-4 h-4" />
              )}
            </div>
            <span className="ml-2 font-medium">Create Organization</span>
          </div>
          
          <div className={`flex-1 h-0.5 mx-4 rounded-full ${step !== 'create-org' ? 'bg-admin-ok/40' : 'bg-admin-border'}`} />
          
          <div className={`flex items-center ${
            step === 'invite-admin' ? 'text-admin-accent-ink' : step === 'complete' ? 'text-admin-ok' : 'text-admin-muted'
          }`}>
            <div className={`w-9 h-9 rounded-full border flex items-center justify-center ${
              step === 'invite-admin' ? 'bg-admin-accent-soft border-admin-accent-border' : step === 'complete' ? 'bg-admin-ok-soft border-admin-ok/20' : 'bg-admin-bg border-admin-border'
            }`}>
              {step === 'complete' ? (
                <CheckCircleIcon className="w-5 h-5" />
              ) : (
                <UserPlusIcon className="w-4 h-4" />
              )}
            </div>
            <span className="ml-2 font-medium">Invite Admin</span>
          </div>
          
          <div className={`flex-1 h-0.5 mx-4 rounded-full ${step === 'complete' ? 'bg-admin-ok/40' : 'bg-admin-border'}`} />
          
          <div className={`flex items-center ${step === 'complete' ? 'text-admin-ok' : 'text-admin-muted'}`}>
            <div className={`w-9 h-9 rounded-full border flex items-center justify-center ${
              step === 'complete' ? 'bg-admin-ok-soft border-admin-ok/20' : 'bg-admin-bg border-admin-border'
            }`}>
              <CheckCircleIcon className="w-4 h-4" />
            </div>
            <span className="ml-2 font-medium">Complete</span>
          </div>
        </div>
      </div>

      {/* Step 1: Create Organization */}
      {step === 'create-org' && (
        <SectionCard icon={<BuildingOfficeIcon />} title="Organization Details">
          <form onSubmit={handleCreateOrg} className="space-y-4">
            <div>
              <label className={labelClass}>
                Organization Name *
              </label>
              <input
                type="text"
                required
                value={orgForm.name}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                className={inputClass}
                placeholder="Acme Corp"
              />
            </div>

            <div>
              <label className={labelClass}>
                Domain (optional)
              </label>
              <input
                type="text"
                value={orgForm.domain}
                onChange={(e) => setOrgForm({ ...orgForm, domain: e.target.value })}
                className={inputClass}
                placeholder="acme.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Industry</label>
                <select
                  value={orgForm.industry}
                  onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
                  className={`${selectClass} w-full`}
                >
                  <option value="TECHNOLOGY">Technology</option>
                  <option value="HEALTHCARE">Healthcare</option>
                  <option value="FINANCE">Finance</option>
                  <option value="EDUCATION">Education</option>
                  <option value="RETAIL">Retail</option>
                  <option value="MANUFACTURING">Manufacturing</option>
                  <option value="CONSULTING">Consulting</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="SALES">Sales</option>
                  <option value="HUMAN_RESOURCES">Human Resources</option>
                  <option value="LEGAL">Legal</option>
                  <option value="REAL_ESTATE">Real Estate</option>
                  <option value="HOSPITALITY">Hospitality</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Company Size</label>
                <select
                  value={orgForm.size}
                  onChange={(e) => setOrgForm({ ...orgForm, size: e.target.value })}
                  className={`${selectClass} w-full`}
                >
                  <option value="STARTUP">Startup (1-10)</option>
                  <option value="SMALL">Small (11-50)</option>
                  <option value="MEDIUM">Medium (51-200)</option>
                  <option value="LARGE">Large (201-1000)</option>
                  <option value="ENTERPRISE">Enterprise (1000+)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Subscription Plan</label>
                <select
                  value={orgForm.subscriptionPlan}
                  onChange={(e) => setOrgForm({ ...orgForm, subscriptionPlan: e.target.value })}
                  className={`${selectClass} w-full`}
                >
                  <option value="TRIAL">Trial</option>
                  <option value="STARTER">Starter</option>
                  <option value="PROFESSIONAL">Professional</option>
                  <option value="ENTERPRISE">Enterprise</option>
                  <option value="ENTERPRISE_PLUS">Enterprise Plus</option>
                </select>
              </div>

              {orgForm.subscriptionPlan === 'TRIAL' && (
                <div>
                  <label className={labelClass}>Trial Days</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={orgForm.trialDays}
                    onChange={(e) => setOrgForm({ ...orgForm, trialDays: parseInt(e.target.value) || 14 })}
                    className={inputClass}
                  />
                </div>
              )}
            </div>

            {createOrgMutation.error && (
              <div className="p-3 bg-admin-danger-soft border border-admin-danger/30 rounded-admin-sm text-admin-danger text-sm">
                {createOrgMutation.error.message}
              </div>
            )}

            <button
              type="submit"
              disabled={createOrgMutation.isPending}
              className={`${buttonClass.primary} w-full py-2.5`}
            >
              {createOrgMutation.isPending ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <BuildingOfficeIcon className="w-4 h-4" />
                  Create Organization
                </>
              )}
            </button>
          </form>
        </SectionCard>
      )}

      {/* Step 2: Invite Admin */}
      {step === 'invite-admin' && createdOrg && (
        <SectionCard icon={<UserPlusIcon />} title="Invite Organization Admin">
          <div className="mb-4 p-3 bg-admin-ok-soft border border-admin-ok/20 rounded-admin-sm">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircleIcon className="w-5 h-5" />
              <span className="font-medium">Organization created: {createdOrg.name}</span>
            </div>
            <p className="text-sm text-emerald-700 mt-1">ID: <span className="font-mono text-xs">{createdOrg.id}</span></p>
          </div>

          <form onSubmit={handleInviteAdmin} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First Name *</label>
                <input
                  type="text"
                  required
                  value={adminForm.firstName}
                  onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })}
                  className={inputClass}
                  placeholder="John"
                />
              </div>
              <div>
                <label className={labelClass}>Last Name *</label>
                <input
                  type="text"
                  required
                  value={adminForm.lastName}
                  onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })}
                  className={inputClass}
                  placeholder="Smith"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Email Address *</label>
              <input
                type="email"
                required
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                className={inputClass}
                placeholder="john@acme.com"
              />
            </div>

            <div>
              <label className={labelClass}>Role</label>
              <select
                value={adminForm.role}
                onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                className={`${selectClass} w-full`}
              >
                <option value="ADMIN">Admin (Full access)</option>
                <option value="RECRUITER">Recruiter</option>
                <option value="HIRING_MANAGER">Hiring Manager</option>
              </select>
            </div>

            {inviteAdminMutation.error && (
              <div className="p-3 bg-admin-danger-soft border border-admin-danger/30 rounded-admin-sm text-admin-danger text-sm">
                {inviteAdminMutation.error.message}
              </div>
            )}

            <button
              type="submit"
              disabled={inviteAdminMutation.isPending}
              className={`${buttonClass.primary} w-full py-2.5`}
            >
              {inviteAdminMutation.isPending ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Sending Invite...
                </>
              ) : (
                <>
                  <UserPlusIcon className="w-4 h-4" />
                  Send Invitation
                </>
              )}
            </button>
          </form>
        </SectionCard>
      )}

      {/* Step 3: Complete */}
      {step === 'complete' && createdOrg && invitedUser && (
        <SectionCard>
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-admin-ok-soft border border-admin-ok/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="w-8 h-8 text-admin-ok" />
            </div>
            <h2 className="text-xl font-semibold text-admin-ink">Onboarding Complete!</h2>
            <p className="text-admin-muted mt-1">The organization has been created and the admin has been invited.</p>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-admin-sm border border-admin-border bg-admin-bg/50">
                <h3 className="text-sm font-semibold text-admin-ink mb-3">Organization Details</h3>
                <DetailList
                  cols={2}
                  items={[
                    { label: 'Name', value: createdOrg.name },
                    { label: 'Plan', value: createdOrg.subscriptionPlan },
                    { label: 'ID', value: <span className="font-mono text-xs break-all">{createdOrg.id}</span> },
                  ]}
                />
              </div>

              <div className="p-4 rounded-admin-sm border border-admin-border bg-admin-bg/50">
                <h3 className="text-sm font-semibold text-admin-ink mb-3">Admin User</h3>
                <DetailList
                  cols={2}
                  items={[
                    { label: 'Name', value: `${invitedUser.user.firstName} ${invitedUser.user.lastName}` },
                    { label: 'Role', value: invitedUser.user.role },
                    { label: 'Email', value: <span className="break-all">{invitedUser.user.email}</span> },
                  ]}
                />
              </div>
            </div>

            {invitedUser.invitation && (
              <div className="p-4 bg-admin-accent-soft border border-admin-accent-border rounded-admin-sm">
                <h3 className="text-sm font-semibold text-admin-accent-ink mb-2">Invitation Link</h3>
                <p className="text-sm text-admin-secondary mb-3">
                  The admin will receive an email with this link. You can also share it directly:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={invitedUser.invitation.acceptUrl}
                    className={`${inputClass} flex-1 font-mono`}
                  />
                  <button
                    onClick={copyInviteUrl}
                    className={buttonClass.primary}
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-admin-muted mt-2">
                  Expires: {new Date(invitedUser.invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={startOver}
              className={`${buttonClass.primary} flex-1 py-2.5`}
            >
              Onboard Another Customer
            </button>
            <a
              href={`/organizations/${createdOrg.id}`}
              className={`${buttonClass.secondary} flex-1 py-2.5`}
            >
              View Organization
            </a>
          </div>
        </SectionCard>
      )}
    </AdminPageChrome>
  );
}
