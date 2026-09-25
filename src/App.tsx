import React, { useState, useEffect, useRef, Suspense } from 'react';
import { AuthProvider, useAuth } from '@/src/modules/auth/AuthContext';
import { isSupabaseConfigured } from '@/src/lib/supabase';
import { MissingConfigView } from '@/src/components/layout/MissingConfigView';
import { Header } from '@/src/components/layout/Header';
import { BottomNav } from '@/src/components/layout/BottomNav';
import { OfflineIndicator } from '@/src/components/layout/OfflineIndicator';
import { ReloadPrompt } from '@/src/components/layout/ReloadPrompt';
import { NotFoundView } from '@/src/components/layout/NotFoundView';
import { DynamoCard } from '@/src/components/dynamos/DynamoCard';
import { CreateDynamoModal } from '@/src/components/dynamos/CreateDynamoModal';
import { ReplyModal } from '@/src/components/replies/ReplyModal';
import { AuthModal } from '@/src/components/auth/AuthModal';
import { EmailConfirmationGate } from '@/src/components/auth/EmailConfirmationGate';
import { NotificationsModal } from '@/src/components/notifications/NotificationsModal';
import { GlobalBanner } from '@/src/components/common/GlobalBanner';
import {
  FeedSkeleton,
  ProfileSkeleton,
  DiscoverySkeleton,
  SettingsSkeleton,
  BestDynamosSkeleton,
} from '@/src/components/layout/ViewSkeletons';
import { DiscoverySection } from '@/src/modules/discovery/discoveryTypes';
import { dynamosService } from '@/src/modules/dynamos/dynamosService';
import { hashtagsService } from '@/src/modules/hashtags/hashtagsService';
import { notificationsService } from '@/src/modules/notifications/notificationsService';
import { repliesService } from '@/src/modules/replies/repliesService';
import { profilesService } from '@/src/modules/profiles/profilesService';
import { Dynamo } from '@/src/modules/dynamos/dynamosTypes';
import { Hashtag } from '@/src/modules/hashtags/hashtagsTypes';
import { Notification } from '@/src/modules/notifications/notificationsTypes';
import { economyService } from '@/src/modules/economy/economyService';
import { FeedFilterType } from '@/src/modules/relationships/relationshipsTypes';
import { Profile } from '@/src/modules/profiles/profilesTypes';
import { PublicFooter } from '@/src/components/layout/PublicFooter';
import { LegalDocsModal, LegalDocType } from '@/src/components/legal/LegalDocsModal';
import { authService } from '@/src/modules/auth/authService';
import { relationshipsService } from '@/src/modules/relationships/relationshipsService';
import { referralsService } from '@/src/modules/referrals/referralsService';
import { Zap, Plus, RefreshCw, Sparkles, AlertTriangle, CheckCircle2, Users, UserCheck, Flame, Shield, Trophy, Settings, ShieldAlert } from 'lucide-react';

// Code-split heavy modules with React.lazy
const ProfileView = React.lazy(() => import('@/src/components/profiles/ProfileView').then((m) => ({ default: m.ProfileView })));
const LandingHero = React.lazy(() => import('@/src/components/landing/LandingHero').then((m) => ({ default: m.LandingHero })));
const DiscoveryView = React.lazy(() => import('@/src/components/discovery/DiscoveryView').then((m) => ({ default: m.DiscoveryView })));
const BestDynamosView = React.lazy(() => import('@/src/components/bestDynamos/BestDynamosView').then((m) => ({ default: m.BestDynamosView })));
const AdminView = React.lazy(() => import('@/src/components/admin/AdminView').then((m) => ({ default: m.AdminView })));
const SettingsView = React.lazy(() => import('@/src/components/settings/SettingsView').then((m) => ({ default: m.SettingsView })));
const UserProfileModal = React.lazy(() => import('@/src/components/profiles/UserProfileModal').then((m) => ({ default: m.UserProfileModal })));
const EconomyModal = React.lazy(() => import('@/src/components/economy/EconomyModal').then((m) => ({ default: m.EconomyModal })));
const ReportModal = React.lazy(() => import('@/src/components/moderation/ReportModal').then((m) => ({ default: m.ReportModal })));
const SingleDynamoView = React.lazy(() => import('@/src/components/dynamos/SingleDynamoView').then((m) => ({ default: m.SingleDynamoView })));
const PublicProfileView = React.lazy(() => import('@/src/components/profiles/PublicProfileView').then((m) => ({ default: m.PublicProfileView })));
const InviteModal = React.lazy(() => import('@/src/components/referrals/InviteModal').then((m) => ({ default: m.InviteModal })));

const PAGE_SIZE = 20;

function DynamoAppContent() {
  const {
    user,
    profile,
    isRecoveryMode,
    isEmailConfirmed,
    resendConfirmationEmail,
    checkEmailConfirmation,
    signOut,
  } = useAuth();

  // Navigation & View State
  const [currentTab, setCurrentTab] = useState<'feed' | 'discovery' | 'best-dynamos' | 'landing' | 'profile' | 'admin' | 'settings' | 'single-dynamo' | 'public-profile' | 'not-found'>('feed');
  const [activeDynamoId, setActiveDynamoId] = useState<string | null>(null);
  const [activeUsername, setActiveUsername] = useState<string | null>(null);
  const [pendingNewDynamos, setPendingNewDynamos] = useState<Dynamo[]>([]);
  const [discoveryInitialSection, setDiscoveryInitialSection] = useState<DiscoverySection>('tendencias');
  const [discoveryHashtag, setDiscoveryHashtag] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Sync URL paths and hash (/admin, /settings, /d/:id, /@username, /join, /terms, etc.)
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const cleanHash = hash.replace(/^#\/?/, '');

      // Capture referral or growth ref code if present
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const ref = urlParams.get('ref');
        if (ref) {
          referralsService.setStoredReferralCode(ref);
          referralsService.trackEvent(ref, 'click');
          referralsService.trackEvent(ref, 'landing_view');
        }
      } catch {}

      // Handle /share invitation route
      if (path === '/share' || cleanHash === 'share') {
        if (user) {
          setIsInviteModalOpen(true);
        } else {
          setAuthModalMode('register');
          setIsAuthModalOpen(true);
        }
        setCurrentTab((prev) => (prev === 'landing' || prev === 'feed' ? prev : 'feed'));
        return;
      }

      // 1. Single Dynamo: /d/:id or #/d/:id
      const dynamoMatch = path.match(/^\/d\/([a-zA-Z0-9_-]+)/) || cleanHash.match(/^d\/([a-zA-Z0-9_-]+)/);
      if (dynamoMatch) {
        setActiveDynamoId(dynamoMatch[1]);
        setCurrentTab('single-dynamo');
        return;
      }

      // 2. Public Profile: /@username, /u/username, or #/@username
      const profileMatch = path.match(/^\/(?:@|u\/)([a-zA-Z0-9_.-]+)/) || cleanHash.match(/^(?:@|u\/)([a-zA-Z0-9_.-]+)/);
      if (profileMatch) {
        setActiveUsername(profileMatch[1]);
        setCurrentTab('public-profile');
        return;
      }

      // 3. /join: Directs to public landing with referral context (NO direct AuthModal popup)
      if (path === '/join' || cleanHash === 'join') {
        setCurrentTab('landing');
        return;
      }

      // 4. /register or /registro: Opens registration flow directly
      if (path === '/register' || path === '/registro' || cleanHash === 'register' || cleanHash === 'registro') {
        const storedRef = referralsService.getStoredReferralCode();
        if (storedRef) {
          referralsService.trackEvent(storedRef, 'signup_started');
        }
        setAuthModalMode('register');
        setIsAuthModalOpen(true);
        setCurrentTab((prev) => (prev === 'landing' || prev === 'feed' ? prev : 'feed'));
        return;
      }

      // 4. /login: Opens login modal
      if (path === '/login' || path === '/ingresar' || cleanHash === 'login') {
        setAuthModalMode('login');
        setIsAuthModalOpen(true);
        setCurrentTab((prev) => (prev === 'landing' || prev === 'feed' ? prev : 'feed'));
        return;
      }

      // 5. Legal and Information direct routes
      const legalMap: Record<string, LegalDocType> = {
        '/terms': 'terms',
        '/terminos': 'terms',
        '/privacy': 'privacy',
        '/privacidad': 'privacy',
        '/community': 'community',
        '/normas': 'community',
        '/safety': 'safety',
        '/seguridad': 'safety',
        '/about': 'about',
      };
      if (legalMap[path] || (cleanHash && legalMap['/' + cleanHash])) {
        const doc = legalMap[path] || legalMap['/' + cleanHash];
        handleOpenLegalDoc(doc);
        setCurrentTab((prev) => (prev === 'admin' || prev === 'settings' ? prev : 'feed'));
        return;
      }

      // 6. /landing
      if (path === '/landing' || hash === '#/landing' || hash === '#landing') {
        setCurrentTab('landing');
        return;
      }

      // 7. /admin
      if (path === '/admin' || hash === '#/admin' || hash === '#admin') {
        setCurrentTab('admin');
        return;
      }

      // 8. /settings
      if (path === '/settings' || hash === '#/settings' || hash === '#settings') {
        setCurrentTab('settings');
        return;
      }

      // 9. /discovery
      if (path === '/discovery' || hash === '#/discovery') {
        setCurrentTab('discovery');
        return;
      }

      // 10. /best-dynamos
      if (path === '/best-dynamos' || hash === '#/best-dynamos') {
        setCurrentTab('best-dynamos');
        return;
      }

      // 11. Feed / root
      if (path === '/' || path === '/feed' || path === '' || hash === '#/feed') {
        setCurrentTab((prev) => (prev === 'admin' || prev === 'settings' || prev === 'not-found' || prev === 'single-dynamo' || prev === 'public-profile' ? 'feed' : prev));
        return;
      }

      // 12. Unknown path -> 404
      setCurrentTab('not-found');
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const handleOpenPublicProfile = (targetUsername: string) => {
    const clean = targetUsername.replace(/^@/, '');
    setActiveUsername(clean);
    setCurrentTab('public-profile');
    if (window.location.pathname !== `/@${clean}`) {
      window.history.pushState(null, '', `/@${clean}`);
    }
  };

  const handleOpenSingleDynamo = (dynamoId: string) => {
    setActiveDynamoId(dynamoId);
    setCurrentTab('single-dynamo');
    if (window.location.pathname !== `/d/${dynamoId}`) {
      window.history.pushState(null, '', `/d/${dynamoId}`);
    }
  };

  const handleGoToAdmin = () => {
    setActiveDynamoId(null);
    setActiveUsername(null);
    setCurrentTab('admin');
    if (window.location.pathname !== '/admin') {
      window.history.pushState(null, '', '/admin');
    }
  };

  const handleGoToSettings = () => {
    if (!user) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      return;
    }
    setActiveDynamoId(null);
    setActiveUsername(null);
    setCurrentTab('settings');
    if (window.location.pathname !== '/settings') {
      window.history.pushState(null, '', '/settings');
    }
  };

  const handleGoToHome = () => {
    setSelectedTag(null);
    setActiveDynamoId(null);
    setActiveUsername(null);
    if (window.location.pathname !== '/' || window.location.hash) {
      window.history.pushState(null, '', '/');
    }
    setCurrentTab('feed');
  };

  const navigateToTab = (tab: 'feed' | 'discovery' | 'best-dynamos' | 'landing' | 'profile' | 'admin' | 'settings') => {
    setSelectedTag(null);
    setActiveDynamoId(null);
    setActiveUsername(null);
    if (tab === 'admin') {
      handleGoToAdmin();
      return;
    }
    if (tab === 'settings') {
      handleGoToSettings();
      return;
    }
    if (window.location.pathname !== '/' || window.location.hash) {
      window.history.pushState(null, '', '/');
    }
    setCurrentTab(tab);
  };

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeReplyDynamo, setActiveReplyDynamo] = useState<Dynamo | null>(null);
  const [focusedReplyId, setFocusedReplyId] = useState<string | null>(null);
  const [activeProfileModal, setActiveProfileModal] = useState<Profile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'forgot_password' | 'reset_password'>('login');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [reportingTarget, setReportingTarget] = useState<{
    dynamoId?: string;
    replyId?: string;
    authorId?: string;
  } | null>(null);
  const [isEconomyModalOpen, setIsEconomyModalOpen] = useState(false);
  const [economyRefreshTrigger, setEconomyRefreshTrigger] = useState(0);

  // Legal Modal
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType>('about');

  const handleOpenLegalDoc = (doc: LegalDocType) => {
    setActiveLegalDoc(doc);
    setIsLegalModalOpen(true);
  };

  // Trigger reset password modal automatically if recovery token was detected
  useEffect(() => {
    if (isRecoveryMode) {
      setAuthModalMode('reset_password');
      setIsAuthModalOpen(true);
    }
  }, [isRecoveryMode]);

  // Data State
  const [feedFilter, setFeedFilter] = useState<FeedFilterType>('todos');
  const [dynamos, setDynamos] = useState<Dynamo[]>([]);
  const [trendingTags, setTrendingTags] = useState<Hashtag[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreDynamos, setHasMoreDynamos] = useState(false);

  const loadFeed = async (offset = 0, append = false, currentFilter: FeedFilterType = feedFilter) => {
    if (offset === 0) setIsLoadingFeed(true);
    else setIsLoadingMore(true);

    try {
      const data = await dynamosService.getActiveFeed(user?.id, PAGE_SIZE, offset, currentFilter);
      if (append) {
        setDynamos((prev) => [...prev, ...data]);
      } else {
        setDynamos(data);
      }
      setHasMoreDynamos(data.length === PAGE_SIZE);
    } finally {
      setIsLoadingFeed(false);
      setIsLoadingMore(false);
    }
  };

  const loadTags = async () => {
    const tags = await hashtagsService.getTrendingHashtags();
    setTrendingTags(tags);
  };

  const loadNotifications = async () => {
    if (user?.id) {
      const notifs = await notificationsService.getNotifications(user.id);
      setNotifications(notifs);
    }
  };

  useEffect(() => {
    loadFeed(0, false, feedFilter);
    loadTags();
    setPendingNewDynamos([]);
  }, [user?.id, feedFilter]);

  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      const unsubscribe = notificationsService.subscribeToUserNotifications(user.id, () => {
        loadNotifications();
      });
      return () => {
        unsubscribe();
      };
    }
  }, [user?.id]);

  // Stable refs to prevent subscription re-creation on every render
  const userRef = useRef(user);
  userRef.current = user;

  const feedFilterRef = useRef(feedFilter);
  feedFilterRef.current = feedFilter;

  const dynamosRef = useRef(dynamos);
  dynamosRef.current = dynamos;

  // Realtime subscription for incoming dynamos and energy updates in feed (stable single connection)
  useEffect(() => {
    const unsubscribe = dynamosService.subscribeToNewDynamos(
      async (newDynamo) => {
        const currentUser = userRef.current;
        const currentFilter = feedFilterRef.current;
        const currentDynamos = dynamosRef.current;

        // 1. Ignore if authored by current user (already prepended when created)
        if (currentUser && newDynamo.user_id === currentUser.id) return;

        // 2. Ignore if already loaded in dynamos
        if (currentDynamos.some((d) => d.id === newDynamo.id)) return;

        // 3. Filter check if user has blocked/muted relationships
        if (currentUser?.id) {
          try {
            const excludedIds = await relationshipsService.getExcludedUserIdsForFeed(currentUser.id);
            if (excludedIds.includes(newDynamo.user_id)) return;

            if (currentFilter === 'siguiendo') {
              const following = await relationshipsService.getFollowingIds(currentUser.id);
              if (!following.includes(newDynamo.user_id)) return;
            } else if (currentFilter === 'amigos') {
              const friends = await relationshipsService.getFriendsIds(currentUser.id);
              if (!friends.includes(newDynamo.user_id)) return;
            }
          } catch (e) {
            console.warn('Error checking relationship for realtime dynamo:', e);
          }
        } else {
          // Unauthenticated visitor in 'siguiendo' or 'amigos' should not see dynamos
          if (currentFilter === 'siguiendo' || currentFilter === 'amigos') return;
        }

        // Live prepend directly into feed so the user sees it without needing to refresh
        setDynamos((prev) => {
          if (prev.some((p) => p.id === newDynamo.id)) return prev;
          return [newDynamo, ...prev];
        });
      },
      (update) => {
        const { id, expires_at, status, image_url, energy_gifts_count } = update;
        setDynamos((prev) =>
          prev
            .map((d) => {
              if (d.id !== id) return d;
              return {
                ...d,
                expires_at: expires_at || d.expires_at,
                status: status || d.status,
                image_url: image_url !== undefined ? image_url : d.image_url,
                energy_gifts_count: energy_gifts_count !== undefined ? energy_gifts_count : d.energy_gifts_count,
              };
            })
            .filter((d) => d.status === 'active' && new Date(d.expires_at).getTime() > Date.now())
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const handleApplyPendingDynamos = async () => {
    if (pendingNewDynamos.length === 0) return;
    setPendingNewDynamos([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await loadFeed(0, false, feedFilterRef.current);
  };

  // Handle gifting energy without full page reload
  const handleGiftEnergy = async (dynamoId: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Sin conexión. Inténtalo nuevamente cuando tengas internet.');
    }

    if (!user) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      throw new Error('Inicia sesión para inyectar energía ⚡');
    }

    const result = await economyService.giveEnergyToDynamo(dynamoId, user.id);

    // Refresh user balance indicator
    setEconomyRefreshTrigger((prev) => prev + 1);

    // Update state immediately
    setDynamos((prev) =>
      prev.map((d) =>
        d.id === dynamoId
          ? {
              ...d,
              expires_at: result.newExpiresAt,
              energy_gifts_count: result.totalGifts,
            }
          : d
      )
    );

    return result;
  };

  // Handle creating a new dynamo
  const handleCreateDynamo = async (content: string, imageUrl?: string | null) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Sin conexión. Inténtalo nuevamente cuando tengas internet.');
    }

    if (!profile) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      return;
    }
    const newDynamo = await dynamosService.createDynamo({ content, image_url: imageUrl }, profile);
    setDynamos((prev) => [newDynamo, ...prev]);
    await loadTags();
    setCurrentTab('feed');
  };

  // Handle sending a reply
  const handleSubmitReply = async (dynamoId: string, content: string, parentReplyId?: string | null) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('Sin conexión. Inténtalo nuevamente cuando tengas internet.');
    }

    if (!profile) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      throw new Error('Inicia sesión para responder');
    }

    await repliesService.createReply({ dynamoId, content, parentReplyId }, profile);
    setDynamos((prev) =>
      prev.map((d) =>
        d.id === dynamoId
          ? { ...d, replies_count: (d.replies_count || 0) + 1 }
          : d
      )
    );
  };

  // Handle deleting own dynamo
  const handleDeleteDynamo = async (dynamoId: string) => {
    if (!user?.id) return;
    await dynamosService.deleteDynamo(dynamoId, user.id);
    setDynamos((prev) => prev.filter((d) => d.id !== dynamoId));
  };

  // Handle when a dynamo expires in real-time (removes from feed)
  const handleDynamoExpired = (dynamoId: string) => {
    setDynamos((prev) => prev.filter((d) => d.id !== dynamoId));
  };

  const handleMarkAllNotificationsRead = async () => {
    if (user?.id) {
      await notificationsService.markAllAsRead(user.id);
      loadNotifications();
    }
  };

  const handleMarkNotificationRead = async (notificationId: string) => {
    if (user?.id) {
      await notificationsService.markAsRead(notificationId, user.id);
      loadNotifications();
    }
  };

  const handleNavigateNotificationContext = async (notification: Notification) => {
    setIsNotificationsOpen(false);

    // 1. Follow notification: Open follower's profile directly
    if (notification.type === 'follow') {
      if (notification.sender) {
        setActiveProfileModal(notification.sender);
        return;
      }
      const targetUserId =
        notification.sender_id ||
        notification.metadata?.follower_id ||
        notification.reference_id;
      if (targetUserId) {
        const p = await profilesService.getProfile(targetUserId);
        if (p) {
          setActiveProfileModal(p);
          return;
        }
      }
      return;
    }

    // 2. Gift notification: Open target Dynamo
    if (notification.type === 'gift') {
      const dynamoId = notification.metadata?.dynamo_id || notification.reference_id;
      if (dynamoId) {
        let targetDynamo = dynamos.find((d) => d.id === dynamoId);
        if (!targetDynamo) {
          targetDynamo = (await dynamosService.getDynamoById(dynamoId)) || undefined;
        }
        if (targetDynamo) {
          setFocusedReplyId(null);
          setActiveReplyDynamo(targetDynamo);
        }
      }
      return;
    }

    // 3. Reply notification (direct or reply-to-reply): Open Dynamo + focus the specific reply
    if (notification.type === 'reply') {
      const dynamoId = notification.metadata?.dynamo_id || notification.reference_id;
      const targetReplyId = notification.metadata?.reply_id;
      if (dynamoId) {
        let targetDynamo = dynamos.find((d) => d.id === dynamoId);
        if (!targetDynamo) {
          targetDynamo = (await dynamosService.getDynamoById(dynamoId)) || undefined;
        }
        if (targetDynamo) {
          setFocusedReplyId(targetReplyId || null);
          setActiveReplyDynamo(targetDynamo);
        }
      }
      return;
    }

    // Fallback:
    if (notification.reference_id) {
      let targetDynamo = dynamos.find((d) => d.id === notification.reference_id);
      if (!targetDynamo) {
        targetDynamo = (await dynamosService.getDynamoById(notification.reference_id)) || undefined;
      }
      if (targetDynamo) {
        setFocusedReplyId(null);
        setActiveReplyDynamo(targetDynamo);
        return;
      }
    }
    if (notification.sender) {
      setActiveProfileModal(notification.sender);
    }
  };

  // Filtered dynamos by selected hashtag
  const displayedDynamos = selectedTag
    ? dynamos.filter((d) => d.hashtags?.includes(selectedTag))
    : dynamos;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#0B0E11] text-[#ECEFF1] flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Global System & Emergency Banner */}
      <GlobalBanner />

      {/* Global Header */}
      <Header
        onOpenAuth={() => {
          setAuthModalMode('login');
          setIsAuthModalOpen(true);
        }}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        unreadCount={unreadCount}
        onGoToProfile={() => setCurrentTab('profile')}
        onGoToHome={handleGoToHome}
        onGoToAdmin={handleGoToAdmin}
        onGoToSettings={handleGoToSettings}
        onOpenEconomy={() => setIsEconomyModalOpen(true)}
        economyRefreshTrigger={economyRefreshTrigger}
        onOpenInvite={() => setIsInviteModalOpen(true)}
      />

      {/* Account Suspension Banner */}
      {user && profile?.status === 'suspended' && (
        <div
          id="banner-user-suspended"
          className="w-full bg-red-950/90 border-b border-red-800/80 px-4 py-3 text-xs text-red-200 shadow-sm"
        >
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                <strong>Cuenta Suspendida:</strong> Tu cuenta se encuentra suspendida por el equipo de moderación debido a infracciones de las Normas de la Comunidad. La creación de contenido y reacciones están deshabilitadas.
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenLegalDoc('community')}
                className="underline hover:text-white transition font-medium"
              >
                Ver Normas
              </button>
              <button
                type="button"
                onClick={() => authService.signOut()}
                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold transition"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      {user && !isEmailConfirmed && !isRecoveryMode ? (
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <EmailConfirmationGate
            email={user.email || ''}
            onResend={resendConfirmationEmail}
            onCheckConfirmation={checkEmailConfirmation}
            onSignOut={signOut}
          />
          <PublicFooter onOpenLegalDoc={handleOpenLegalDoc} />
        </main>
      ) : (
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-12">
          {/* Navigation Tabs Header (Desktop / Tablet) */}
        <div className="hidden sm:flex items-center justify-between mb-6 pb-3 border-b border-[#1F262E]">
          <div className="flex items-center gap-1 bg-[#13181E] p-1 rounded-xl border border-[#21272E]">
            <button
              id="desktop-tab-feed"
              onClick={() => {
                setDiscoveryHashtag(null);
                navigateToTab('feed');
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${
                currentTab === 'feed'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Feed Principal
            </button>
            <button
              id="desktop-tab-discovery"
              onClick={() => {
                setDiscoveryHashtag(null);
                setDiscoveryInitialSection('tendencias');
                navigateToTab('discovery');
              }}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                currentTab === 'discovery'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Descubrimiento</span>
            </button>
            <button
              id="desktop-tab-best-dynamos"
              onClick={() => navigateToTab('best-dynamos')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                currentTab === 'best-dynamos'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Best Dynamos</span>
            </button>
            <button
              id="desktop-tab-manifesto"
              onClick={() => navigateToTab('landing')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${
                currentTab === 'landing'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Manifiesto
            </button>
            {user && (
              <button
                id="desktop-tab-profile"
                onClick={() => navigateToTab('profile')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition ${
                  currentTab === 'profile'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                Mi Perfil
              </button>
            )}
            {user && (
              <button
                id="desktop-tab-settings"
                onClick={handleGoToSettings}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                  currentTab === 'settings'
                    ? 'bg-amber-500 text-black shadow-sm font-bold'
                    : 'text-stone-400 hover:text-white'
                }`}
                title="Configuración y Privacidad (/settings)"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Ajustes</span>
              </button>
            )}
            {profile && (profile.role === 'admin' || profile.role === 'moderator') && (
              <button
                id="desktop-tab-admin"
                onClick={handleGoToAdmin}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
                  currentTab === 'admin'
                    ? 'bg-amber-500 text-black shadow-sm font-bold'
                    : 'text-amber-400 hover:text-white'
                }`}
                title="Panel de Administración"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            )}
          </div>

          <button
            id="desktop-btn-create"
            onClick={() => {
              if (!user) {
                setAuthModalMode('login');
                setIsAuthModalOpen(true);
              } else {
                setIsCreateModalOpen(true);
              }
            }}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 active:scale-95 transition shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Crear Dynamo</span>
          </button>
        </div>

        {/* Tab: 404 Not Found View */}
        {currentTab === 'not-found' && (
          <Suspense fallback={<FeedSkeleton />}>
            <NotFoundView onGoHome={handleGoToHome} />
          </Suspense>
        )}

        {/* Tab: Single Dynamo View (/d/:id) */}
        {currentTab === 'single-dynamo' && activeDynamoId && (
          <Suspense fallback={<FeedSkeleton />}>
            <SingleDynamoView
              dynamoId={activeDynamoId}
              onBack={handleGoToHome}
              onOpenAuth={() => {
                setAuthModalMode('login');
                setIsAuthModalOpen(true);
              }}
              onGiftEnergy={handleGiftEnergy}
              onOpenReply={(d) => setActiveReplyDynamo(d)}
              onReport={(id, authorId) => setReportingTarget({ dynamoId: id, authorId })}
              onDelete={handleDeleteDynamo}
              onSelectHashtag={(tag) => {
                setDiscoveryHashtag(tag);
                setDiscoveryInitialSection('tendencias');
                setCurrentTab('discovery');
              }}
              onAuthorClick={(author) => {
                if (author?.username) {
                  handleOpenPublicProfile(author.username);
                } else if (author) {
                  setActiveProfileModal(author);
                }
              }}
            />
          </Suspense>
        )}

        {/* Tab: Public Profile (/@username) */}
        {currentTab === 'public-profile' && activeUsername && (
          <Suspense fallback={<ProfileSkeleton />}>
            <PublicProfileView
              username={activeUsername}
              onBack={handleGoToHome}
              onOpenAuth={() => {
                setAuthModalMode('login');
                setIsAuthModalOpen(true);
              }}
              onGiftEnergy={handleGiftEnergy}
              onOpenReply={(d) => setActiveReplyDynamo(d)}
              onReport={(id, authorId) => setReportingTarget({ dynamoId: id, authorId })}
              onDelete={handleDeleteDynamo}
              onSelectHashtag={(tag) => {
                setDiscoveryHashtag(tag);
                setDiscoveryInitialSection('tendencias');
                setCurrentTab('discovery');
              }}
              onGoToSettings={handleGoToSettings}
            />
          </Suspense>
        )}

        {/* Tab: Admin Panel (/admin) */}
        {currentTab === 'admin' && (
          <Suspense fallback={<SettingsSkeleton />}>
            <AdminView onGoToHome={handleGoToHome} />
          </Suspense>
        )}

        {/* Tab 1: Manifesto / Landing */}
        {currentTab === 'landing' && (
          <Suspense fallback={<FeedSkeleton />}>
            <LandingHero
              onStartExploring={() => setCurrentTab('feed')}
              onOpenAuth={() => {
                setAuthModalMode('login');
                setIsAuthModalOpen(true);
              }}
              onOpenRegister={() => {
                setAuthModalMode('register');
                setIsAuthModalOpen(true);
              }}
              onOpenLogin={() => {
                setAuthModalMode('login');
                setIsAuthModalOpen(true);
              }}
            />
          </Suspense>
        )}

        {/* Tab 2: Profile */}
        {currentTab === 'profile' && (
          <Suspense fallback={<ProfileSkeleton />}>
            <ProfileView
              onGoToSettings={handleGoToSettings}
              onOpenInvite={() => setIsInviteModalOpen(true)}
            />
          </Suspense>
        )}

        {/* Tab: Settings & Privacy (/settings) */}
        {currentTab === 'settings' && (
          <Suspense fallback={<SettingsSkeleton />}>
            <SettingsView
              onGoToHome={handleGoToHome}
              onGoToProfile={() => setCurrentTab('profile')}
              onOpenInvite={() => setIsInviteModalOpen(true)}
            />
          </Suspense>
        )}

        {/* Tab: Best Dynamos (Salón Histórico) */}
        {currentTab === 'best-dynamos' && (
          <Suspense fallback={<BestDynamosSkeleton />}>
            <BestDynamosView
              currentUserId={user?.id}
              onAuthorClick={(author) => (author?.username ? handleOpenPublicProfile(author.username) : setActiveProfileModal(author))}
              onRequireAuth={() => {
                setAuthModalMode('login');
                setIsAuthModalOpen(true);
              }}
            />
          </Suspense>
        )}

        {/* Tab 3: Discovery Module (Tendencias, Casi desaparecen, Reviviendo) */}
        {currentTab === 'discovery' && (
          <Suspense fallback={<DiscoverySkeleton />}>
            <DiscoveryView
              currentUserId={user?.id}
              onGiftEnergy={handleGiftEnergy}
              onOpenReply={(d) => setActiveReplyDynamo(d)}
              onReport={(id, authorId) => setReportingTarget({ dynamoId: id, authorId })}
              onDelete={handleDeleteDynamo}
              onAuthorClick={(author) => (author?.username ? handleOpenPublicProfile(author.username) : setActiveProfileModal(author))}
              onRequireAuth={() => {
                setAuthModalMode('login');
                setIsAuthModalOpen(true);
              }}
              initialSection={discoveryInitialSection}
              initialHashtag={discoveryHashtag}
            />
          </Suspense>
        )}

        {/* Tab 4: Feed */}
        {currentTab === 'feed' && (
          <div className="space-y-4 sm:space-y-5">
            {/* Feed Filter Bar: Todos | Siguiendo | Amigos */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#1C2229]">
              <div className="flex items-center gap-1.5 p-1 bg-[#12161A] rounded-xl border border-[#21272E] w-fit">
                <button
                  id="tab-feed-todos"
                  onClick={() => setFeedFilter('todos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    feedFilter === 'todos'
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Todos</span>
                </button>

                <button
                  id="tab-feed-siguiendo"
                  onClick={() => {
                    if (!user) {
                      setAuthModalMode('login');
                      setIsAuthModalOpen(true);
                      return;
                    }
                    setFeedFilter('siguiendo');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    feedFilter === 'siguiendo'
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Siguiendo</span>
                </button>

                <button
                  id="tab-feed-amigos"
                  onClick={() => {
                    if (!user) {
                      setAuthModalMode('login');
                      setIsAuthModalOpen(true);
                      return;
                    }
                    setFeedFilter('amigos');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    feedFilter === 'amigos'
                      ? 'bg-emerald-500 text-black shadow-sm font-extrabold'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Amigos</span>
                </button>
              </div>

              {/* Hashtag Filters & Refresh */}
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
                {selectedTag && (
                  <button
                    onClick={() => setSelectedTag(null)}
                    className="px-2.5 py-1 rounded-full bg-amber-500 text-black font-bold text-[11px] shrink-0 flex items-center gap-1"
                  >
                    <span>#{selectedTag}</span>
                    <span>✕</span>
                  </button>
                )}

                {trendingTags.slice(0, 3).map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTag(selectedTag === tag.name ? null : tag.name)}
                    className={`px-2.5 py-1 rounded-full border text-[11px] font-mono shrink-0 transition ${
                      selectedTag === tag.name
                        ? 'bg-amber-500 text-black border-amber-500 font-semibold'
                        : 'bg-[#141A20] text-stone-300 border-[#222932] hover:border-stone-700'
                    }`}
                  >
                    #{tag.name}
                  </button>
                ))}

                <button
                  id="btn-feed-go-discovery"
                  onClick={() => {
                    setDiscoveryHashtag(null);
                    setDiscoveryInitialSection('tendencias');
                    setCurrentTab('discovery');
                  }}
                  className="px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px] font-semibold shrink-0 hover:bg-amber-500/20 transition flex items-center gap-1"
                  title="Explorar tendencias y descubrimiento"
                >
                  <Flame className="w-3 h-3" />
                  <span>Descubrir</span>
                </button>

                <button
                  id="btn-refresh-feed"
                  onClick={() => loadFeed(0, false, feedFilter)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-white shrink-0 hover:bg-[#151D25] transition ml-auto sm:ml-0"
                  title="Actualizar publicaciones"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFeed ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Realtime Pending Dynamos Capsule */}
            {pendingNewDynamos.length > 0 && (
              <div className="sticky top-16 z-30 flex justify-center py-1">
                <button
                  id="btn-realtime-pending-dynamos"
                  onClick={handleApplyPendingDynamos}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 text-black text-xs font-bold shadow-lg shadow-amber-500/20 hover:bg-amber-400 active:scale-95 transition-all animate-bounce"
                >
                  <Zap className="w-3.5 h-3.5 fill-black stroke-black" />
                  <span>
                    ⚡ {pendingNewDynamos.length} {pendingNewDynamos.length === 1 ? 'nuevo Dynamo' : 'nuevos Dynamos'}
                  </span>
                </button>
              </div>
            )}

            {/* Dynamos Feed Stream with Skeleton Loader */}
            {isLoadingFeed ? (
              <FeedSkeleton />
            ) : displayedDynamos.length === 0 ? (
              <div className="rounded-2xl border border-[#21272E] bg-[#12161A] p-8 sm:p-12 text-center text-stone-400 space-y-3">
                <Sparkles className="w-8 h-8 mx-auto text-amber-400/50" />
                <p className="text-stone-200 font-semibold text-sm sm:text-base">⚡ Estás al día.</p>
                <p className="text-xs text-stone-400 max-w-sm mx-auto">
                  No hay publicaciones vivas en este momento con este filtro. Sé el primero en iniciar un pulso.
                </p>
                <button
                  onClick={() => {
                    if (!user) {
                      setAuthModalMode('login');
                      setIsAuthModalOpen(true);
                    } else {
                      setIsCreateModalOpen(true);
                    }
                  }}
                  className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black hover:bg-amber-400 transition shadow-md shadow-amber-500/20"
                >
                  Publicar Dynamo
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedDynamos.map((dynamo) => (
                  <DynamoCard
                    key={dynamo.id}
                    dynamo={dynamo}
                    onGiftEnergy={handleGiftEnergy}
                    onOpenReply={(d) => setActiveReplyDynamo(d)}
                    onReport={(id, authorId) => setReportingTarget({ dynamoId: id, authorId })}
                    onDelete={handleDeleteDynamo}
                    onSelectHashtag={(tag) => {
                      setDiscoveryHashtag(tag);
                      setDiscoveryInitialSection('tendencias');
                      setCurrentTab('discovery');
                    }}
                    onExpired={handleDynamoExpired}
                    onAuthorClick={(author) => (author?.username ? handleOpenPublicProfile(author.username) : setActiveProfileModal(author))}
                  />
                ))}

                {/* Pagination / End of feed indicator (NO infinite scroll) */}
                {hasMoreDynamos ? (
                  <div className="pt-2 text-center">
                    <button
                      onClick={() => loadFeed(dynamos.length, true)}
                      disabled={isLoadingMore}
                      className="px-5 py-2.5 rounded-xl border border-stone-800 bg-[#12161A] text-xs font-medium text-stone-300 hover:text-white hover:border-stone-700 transition disabled:opacity-50"
                    >
                      {isLoadingMore ? 'Cargando anteriores...' : 'Cargar publicaciones anteriores'}
                    </button>
                  </div>
                ) : (
                  <div className="py-6 text-center text-stone-400 flex flex-col items-center gap-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-300">
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                      <span>⚡ Estás al día.</span>
                    </div>
                    <p className="text-[11px] text-stone-400">
                      Has visto todas las publicaciones activas. Las no energizadas se desvanecieron.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Public Footer */}
        <PublicFooter onOpenLegalDoc={handleOpenLegalDoc} />
      </main>
      )}

      {/* Offline Banner Indicator & PWA Update Notification */}
      <OfflineIndicator />
      <ReloadPrompt />

      {/* Bottom Nav for Mobile */}
      {(!user || isEmailConfirmed || isRecoveryMode) && (
        <BottomNav
          currentTab={currentTab === 'admin' ? 'feed' : currentTab}
          onSelectTab={(tab) => {
            if (tab === 'discovery') {
              setDiscoveryHashtag(null);
              setDiscoveryInitialSection('tendencias');
            }
            navigateToTab(tab);
          }}
          onOpenCreateModal={() => {
            if (!user) {
              setAuthModalMode('login');
              setIsAuthModalOpen(true);
            } else {
              setIsCreateModalOpen(true);
            }
          }}
        />
      )}

      {/* Modals */}
      <CreateDynamoModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateDynamo}
      />

      <ReplyModal
        isOpen={Boolean(activeReplyDynamo)}
        dynamo={activeReplyDynamo}
        onClose={() => {
          setActiveReplyDynamo(null);
          setFocusedReplyId(null);
        }}
        onSubmitReply={handleSubmitReply}
        onReportReply={(replyId, authorId) => {
          setReportingTarget({ replyId, authorId });
        }}
        focusedReplyId={focusedReplyId}
        onClearFocusedReply={() => setFocusedReplyId(null)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onMarkAsRead={handleMarkNotificationRead}
        onNavigateContext={handleNavigateNotificationContext}
      />

      <Suspense fallback={null}>
        {reportingTarget && (
          <ReportModal
            isOpen={Boolean(reportingTarget)}
            dynamoId={reportingTarget?.dynamoId}
            replyId={reportingTarget?.replyId}
            targetAuthorId={reportingTarget?.authorId}
            onClose={() => setReportingTarget(null)}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {activeProfileModal && (
          <UserProfileModal
            isOpen={Boolean(activeProfileModal)}
            targetProfile={activeProfileModal}
            onClose={() => setActiveProfileModal(null)}
            onRelationshipChanged={() => loadFeed(0, false, feedFilter)}
            onOpenAuth={() => {
              setAuthModalMode('login');
              setIsAuthModalOpen(true);
            }}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {isEconomyModalOpen && (
          <EconomyModal
            isOpen={isEconomyModalOpen}
            onClose={() => setIsEconomyModalOpen(false)}
            userId={user?.id}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {isInviteModalOpen && (
          <InviteModal
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            userUsername={profile?.username}
          />
        )}
      </Suspense>

      {/* Global Configurable Legal Documents Modal */}
      <LegalDocsModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        initialDoc={activeLegalDoc}
      />
    </div>
  );
}

export default function App() {
  if (import.meta.env.PROD && !isSupabaseConfigured) {
    return <MissingConfigView />;
  }

  return (
    <AuthProvider>
      <DynamoAppContent />
    </AuthProvider>
  );
}
