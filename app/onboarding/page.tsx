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

type Step = 'create-org' | 'invite-admin' | 'complete';

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
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Onboard New Customer</h1>
        <p className="mt-1 text-gray-600">Create a new organization and invite their admin</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center">
          <div className={`flex items-center ${step === 'create-org' ? 'text-blue-600' : 'text-green-600'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              step === 'create-org' ? 'bg-blue-100' : 'bg-green-100'
            }`}>
              {step !== 'create-org' ? (
                <CheckCircleIcon className="w-6 h-6" />
              ) : (
                <BuildingOfficeIcon className="w-5 h-5" />
              )}
            </div>
            <span className="ml-2 font-medium">Create Organization</span>
          </div>
          
          <div className={`flex-1 h-1 mx-4 ${step !== 'create-org' ? 'bg-green-200' : 'bg-gray-200'}`} />
          
          <div className={`flex items-center ${
            step === 'invite-admin' ? 'text-blue-600' : step === 'complete' ? 'text-green-600' : 'text-gray-400'
          }`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              step === 'invite-admin' ? 'bg-blue-100' : step === 'complete' ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              {step === 'complete' ? (
                <CheckCircleIcon className="w-6 h-6" />
              ) : (
                <UserPlusIcon className="w-5 h-5" />
              )}
            </div>
            <span className="ml-2 font-medium">Invite Admin</span>
          </div>
          
          <div className={`flex-1 h-1 mx-4 ${step === 'complete' ? 'bg-green-200' : 'bg-gray-200'}`} />
          
          <div className={`flex items-center ${step === 'complete' ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              step === 'complete' ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <CheckCircleIcon className="w-5 h-5" />
            </div>
            <span className="ml-2 font-medium">Complete</span>
          </div>
        </div>
      </div>

      {/* Step 1: Create Organization */}
      {step === 'create-org' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Organization Details</h2>
          
          <form onSubmit={handleCreateOrg} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization Name *
              </label>
              <input
                type="text"
                required
                value={orgForm.name}
                onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="Acme Corp"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Domain (optional)
              </label>
              <input
                type="text"
                value={orgForm.domain}
                onChange={(e) => setOrgForm({ ...orgForm, domain: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="acme.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                <select
                  value={orgForm.industry}
                  onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Size</label>
                <select
                  value={orgForm.size}
                  onChange={(e) => setOrgForm({ ...orgForm, size: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Plan</label>
                <select
                  value={orgForm.subscriptionPlan}
                  onChange={(e) => setOrgForm({ ...orgForm, subscriptionPlan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trial Days</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={orgForm.trialDays}
                    onChange={(e) => setOrgForm({ ...orgForm, trialDays: parseInt(e.target.value) || 14 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>
              )}
            </div>

            {createOrgMutation.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {createOrgMutation.error.message}
              </div>
            )}

            <button
              type="submit"
              disabled={createOrgMutation.isPending}
              className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {createOrgMutation.isPending ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <BuildingOfficeIcon className="w-5 h-5" />
                  Create Organization
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Invite Admin */}
      {step === 'invite-admin' && createdOrg && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircleIcon className="w-5 h-5" />
              <span className="font-medium">Organization created: {createdOrg.name}</span>
            </div>
            <p className="text-sm text-green-600 mt-1">ID: {createdOrg.id}</p>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-4">Invite Organization Admin</h2>
          
          <form onSubmit={handleInviteAdmin} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={adminForm.firstName}
                  onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={adminForm.lastName}
                  onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Smith"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={adminForm.email}
                onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="john@acme.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={adminForm.role}
                onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
              >
                <option value="ADMIN">Admin (Full access)</option>
                <option value="RECRUITER">Recruiter</option>
                <option value="HIRING_MANAGER">Hiring Manager</option>
              </select>
            </div>

            {inviteAdminMutation.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {inviteAdminMutation.error.message}
              </div>
            )}

            <button
              type="submit"
              disabled={inviteAdminMutation.isPending}
              className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {inviteAdminMutation.isPending ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  Sending Invite...
                </>
              ) : (
                <>
                  <UserPlusIcon className="w-5 h-5" />
                  Send Invitation
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Step 3: Complete */}
      {step === 'complete' && createdOrg && invitedUser && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Onboarding Complete!</h2>
            <p className="text-gray-600 mt-1">The organization has been created and the admin has been invited.</p>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Organization Details</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-gray-500">Name:</dt>
                <dd className="text-gray-900">{createdOrg.name}</dd>
                <dt className="text-gray-500">ID:</dt>
                <dd className="text-gray-900 font-mono text-xs">{createdOrg.id}</dd>
                <dt className="text-gray-500">Plan:</dt>
                <dd className="text-gray-900">{createdOrg.subscriptionPlan}</dd>
              </dl>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Admin User</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-gray-500">Name:</dt>
                <dd className="text-gray-900">{invitedUser.user.firstName} {invitedUser.user.lastName}</dd>
                <dt className="text-gray-500">Email:</dt>
                <dd className="text-gray-900">{invitedUser.user.email}</dd>
                <dt className="text-gray-500">Role:</dt>
                <dd className="text-gray-900">{invitedUser.user.role}</dd>
              </dl>
            </div>

            {invitedUser.invitation && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Invitation Link</h3>
                <p className="text-sm text-blue-700 mb-3">
                  The admin will receive an email with this link. You can also share it directly:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={invitedUser.invitation.acceptUrl}
                    className="flex-1 px-3 py-2 bg-white border border-blue-200 rounded-lg text-sm font-mono text-gray-700"
                  />
                  <button
                    onClick={copyInviteUrl}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Expires: {new Date(invitedUser.invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={startOver}
              className="flex-1 py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              Onboard Another Customer
            </button>
            <a
              href={`/organizations/${createdOrg.id}`}
              className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 text-center"
            >
              View Organization
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
