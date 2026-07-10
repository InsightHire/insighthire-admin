'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAdminAuth } from '@/lib/use-admin-auth';
import { ArrowLeftIcon, UserCircleIcon } from '@heroicons/react/24/outline';

export default function OrganizationPersonasPage() {
  const params = useParams();
  const { isLoading: authLoading } = useAdminAuth();
  const orgId = params.id as string;

  const { data, isLoading } = trpc.platformAdmin.getOrganizationPersonas.useQuery({
    organizationId: orgId,
  }, {
    enabled: !authLoading,
  });

  const { data: orgData } = trpc.platformAdmin.getOrganization.useQuery({ id: orgId }, {
    enabled: !authLoading,
  });

  if (authLoading || isLoading) {
    return <div className="flex justify-center py-12"><div className="animate-spin h-12 w-12 border-b-2 border-blue-600 rounded-full"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-4">
            <Link href={`/organizations/${orgId}`} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold">AI Interview Avatars</h1>
              <p className="text-gray-600">{orgData?.organization?.name || 'Organization'}</p>
            </div>
            <Link
              href="/admin/personas/heygen-catalog"
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-800"
            >
              Avatar catalog
            </Link>
            <Link
              href={`/admin/personas/create?orgId=${orgId}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Create Persona
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.personas.map((persona) => (
            <div key={persona.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center space-x-4 mb-4">
                {persona.image_url ? (
                  <img
                    src={persona.image_url}
                    alt={persona.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-400 rounded-full flex items-center justify-center">
                    <UserCircleIcon className="h-10 w-10 text-white" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{persona.name}</h3>
                  {persona.is_default && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                      Org Default
                    </span>
                  )}
                </div>
              </div>

              {persona.description && (
                <p className="text-sm text-gray-600 mb-4">{persona.description}</p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Avatar:</span>
                  <span className="font-medium text-gray-900">
                    {persona.heygen_avatar_name || 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Voice:</span>
                  <span className="font-medium text-gray-900">
                    {persona.elevenlabs_voice_name || 'Not set'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    persona.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {persona.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {data?.personas.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <UserCircleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No AI avatars configured</p>
            <p className="text-sm text-gray-500 mt-2">
              This org has no personas. New orgs receive a default persona on creation; older orgs may not. Use Create Persona above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
