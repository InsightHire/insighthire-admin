'use client';

import {
  Settings,
  CreditCard,
  Shield,
  Mail,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

export default function BillingSettingsPage() {
  // Auth handled by middleware.ts.
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Billing settings</h2>
        <p className="text-gray-500 mt-1">
          Stripe configuration and non-payment policies. Most settings are configured via environment variables.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stripe config */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Stripe</h3>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">STRIPE_SECRET_KEY</code> — API key
            </li>
            <li>
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">STRIPE_WEBHOOK_SECRET</code> — Webhook signing
            </li>
            <li>
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">STRIPE_PRICE_*_MONTHLY</code> — Price IDs per plan
            </li>
          </ul>
          <p className="text-xs text-gray-500 mt-4">
            Webhook handles: subscription created/updated/deleted, invoice paid, invoice failed.
          </p>
        </div>

        {/* Non-payment suspension */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Shield className="h-5 w-5 text-amber-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Non-payment suspension</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            When <code className="bg-gray-100 px-1 rounded">invoice.payment_failed</code> is received, the org status is set to <strong>PAST_DUE</strong>.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Admins can manually <strong>Suspend</strong> from the Collections page. Suspension:
          </p>
          <ul className="space-y-1 text-sm text-gray-600 list-disc list-inside">
            <li>Sets subscription status to CANCELED</li>
            <li>Deactivates all users in the org</li>
            <li>Logs the action in audit</li>
          </ul>
          <p className="text-xs text-gray-500 mt-4">
            Future: configurable grace period (e.g. auto-suspend after 7 days past due).
          </p>
        </div>

        {/* Dunning */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-cyan-100 rounded-lg">
              <Mail className="h-5 w-5 text-cyan-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Dunning & collections</h3>
          </div>
          <p className="text-sm text-gray-600">
            Stripe can send automatic payment failure emails. Configure in Stripe Dashboard → Settings → Billing → Customer emails.
          </p>
          <p className="text-xs text-gray-500 mt-4">
            Future: custom dunning sequences, reminder emails before suspension.
          </p>
        </div>

        {/* Quick reference */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Quick reference</h3>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Update plan/status per org: Organization detail → Subscription section</li>
            <li>• Suspend for non-payment: Billing → Collections → Suspend</li>
            <li>• View payment history: Organization detail → Payment History</li>
            <li>• Stripe Dashboard: dashboard.stripe.com</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
