'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Mail, 
  Building2, 
  Activity, 
  BarChart3, 
  Shield, 
  AlertTriangle, 
  MapPin,
  ChevronDown,
  Gauge,
  LogOut,
  User,
  UserPlus,
  Lock,
  Puzzle,
  CreditCard,
  Settings,
  Users,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';

export function PlatformAdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [monitoringOpen, setMonitoringOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Load admin email
  useEffect(() => {
    const user = localStorage.getItem('admin_user');
    if (user) {
      try {
        const parsed = JSON.parse(user);
        setAdminEmail(parsed.email || '');
      } catch (e) {}
    }
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMonitoringOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/login');
  };

  // Fetch health summary for badge count
  const { data: healthData } = trpc.platformAdmin.getJourneyHealthSummary.useQuery(
    undefined,
    { refetchInterval: 30000, retry: false }
  );

  const alertCount = healthData?.alerts?.total || 0;
  const anomalyCount = healthData?.metrics?.locationAnomalies || 0;
  const totalAlerts = alertCount + anomalyCount;

  const isMonitoringActive = ['/stuck-candidates', '/anomalies', '/background-jobs', '/api-monitoring', '/email-monitoring', '/scoring'].some(
    path => pathname === path || pathname?.startsWith(path + '/')
  );

  const monitoringItems = [
    { name: 'Stuck Candidates', href: '/stuck-candidates', icon: AlertTriangle, badge: alertCount, badgeColor: 'bg-red-500' },
    { name: 'Location Anomalies', href: '/anomalies', icon: MapPin, badge: anomalyCount, badgeColor: 'bg-amber-500' },
    { name: 'Background Jobs', href: '/background-jobs', icon: Activity },
    { name: 'API Health', href: '/api-monitoring', icon: BarChart3 },
    { name: 'Email & Digests', href: '/email-monitoring', icon: Mail },
    { name: 'AI Scoring', href: '/scoring', icon: BarChart3 },
  ];

  return (
    <nav className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14">
          <div className="flex items-center space-x-6">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <span className="text-lg font-bold text-white">InsightHire</span>
              <span className="ml-2 px-2 py-0.5 text-xs font-medium text-gray-400 bg-gray-800 rounded">Admin</span>
            </Link>

            {/* Nav Items */}
            <div className="hidden md:flex items-center space-x-1">
              {/* Organizations */}
              <Link
                href="/organizations"
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/organizations' || pathname?.startsWith('/organizations/')
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Building2 className="h-4 w-4 mr-1.5" />
                Organizations
              </Link>

              {/* Onboarding */}
              <Link
                href="/onboarding"
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/onboarding'
                    ? 'bg-blue-600 text-white'
                    : 'text-blue-400 hover:bg-blue-600/20 hover:text-blue-300'
                }`}
              >
                <UserPlus className="h-4 w-4 mr-1.5" />
                Onboard
              </Link>

              {/* Monitoring Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setMonitoringOpen(!monitoringOpen)}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isMonitoringActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Gauge className="h-4 w-4 mr-1.5" />
                  Monitoring
                  {totalAlerts > 0 && (
                    <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                      {totalAlerts > 99 ? '99+' : totalAlerts}
                    </span>
                  )}
                  <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${monitoringOpen ? 'rotate-180' : ''}`} />
                </button>

                {monitoringOpen && (
                  <div className="absolute left-0 mt-1 w-56 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-50">
                    {monitoringItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMonitoringOpen(false)}
                          className={`flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-gray-700 text-white'
                              : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center">
                            <Icon className={`h-4 w-4 mr-2 ${item.badge ? 'text-red-400' : ''}`} />
                            {item.name}
                          </span>
                          {item.badge ? (
                            <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white ${item.badgeColor}`}>
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Leads */}
              <Link
                href="/leads"
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/leads' || pathname?.startsWith('/leads/')
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Mail className="h-4 w-4 mr-1.5" />
                Leads
              </Link>

              {/* Audit */}
              <Link
                href="/audit"
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/audit' || pathname?.startsWith('/audit/')
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Shield className="h-4 w-4 mr-1.5" />
                Audit
              </Link>

              {/* Integrations */}
              <Link
                href="/integrations"
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/integrations' || pathname?.startsWith('/integrations/')
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Puzzle className="h-4 w-4 mr-1.5" />
                Integrations
              </Link>

              {/* Settings Dropdown */}
              <div className="relative" ref={settingsRef}>
                <button
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === '/settings/admins' || pathname?.startsWith('/settings/')
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Settings className="h-4 w-4 mr-1.5" />
                  Settings
                  <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                </button>
                {settingsOpen && (
                  <div className="absolute left-0 mt-1 w-56 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-50">
                    <Link
                      href="/settings/admins"
                      onClick={() => setSettingsOpen(false)}
                      className={`flex items-center px-4 py-2 text-sm transition-colors ${
                        pathname === '/settings/admins'
                          ? 'bg-gray-700 text-white'
                          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }`}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Admin Users
                    </Link>
                  </div>
                )}
              </div>

              {/* Billing */}
              <Link
                href="/billing"
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/billing' || pathname?.startsWith('/billing/')
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <CreditCard className="h-4 w-4 mr-1.5" />
                Billing
              </Link>

              {/* GDPR / Privacy */}
              <Link
                href="/gdpr"
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname === '/gdpr' || pathname?.startsWith('/gdpr/')
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Lock className="h-4 w-4 mr-1.5" />
                GDPR
              </Link>
            </div>
          </div>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <User className="h-4 w-4 mr-1.5" />
              <span className="max-w-[150px] truncate">{adminEmail || 'Admin'}</span>
              <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-1 z-50">
                <div className="px-4 py-2 border-b border-gray-700">
                  <p className="text-xs text-gray-400">Signed in as</p>
                  <p className="text-sm text-white truncate">{adminEmail}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
