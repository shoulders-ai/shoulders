<script setup>
definePageMeta({ layout: 'default' })

const router = useRouter()
const { auth, refresh, fetchUsage, deleteAccount, handleLogout, authedFetch, fetchSessions, revokeSession } = useAuth()

const route = useRoute()

const usage = ref(null)
const loading = ref(true)

// Stripe actions
const upgradeLoading = ref(false)
const portalLoading = ref(false)

// Add funds
const fundsInput = ref('')
const fundsLoading = ref(false)
const fundsError = ref('')
const fundsAmountCents = computed(() => {
  const v = parseFloat(fundsInput.value)
  if (!v || isNaN(v) || v < 1 || v > 100) return null
  return Math.round(v * 100)
})

// Success banners
const showUpgradeBanner = ref(false)
const showCreditsBanner = ref(false)

// Change password
const pwForm = reactive({ current: '', newPw: '', confirm: '' })
const pwLoading = ref(false)
const pwMsg = ref('')
const pwError = ref('')

// Delete account
const showDeleteConfirm = ref(false)
const deleteInput = ref('')
const deleteLoading = ref(false)
const deleteError = ref('')

// Active sessions
const sessions = ref([])
const sessionsLoading = ref(false)
const revokeLoadingId = ref(null)

onMounted(async () => {
  if (!auth.value?.token) {
    router.push('/login')
    return
  }
  const ok = await refresh()
  if (!ok) {
    router.push('/login')
    return
  }
  usage.value = await fetchUsage()
  loading.value = false

  // After Stripe redirect, poll until the webhook has processed (up to 10s)
  if (route.query.upgraded === 'true') {
    const originalCredits = auth.value?.credits ?? 0
    for (let i = 0; i < 5; i++) {
      await refresh()
      if (auth.value?.plan === 'pro' && (auth.value?.credits ?? 0) > originalCredits) break
      await new Promise(r => setTimeout(r, 2000))
    }
    showUpgradeBanner.value = auth.value?.plan === 'pro'
    if (showUpgradeBanner.value) setTimeout(() => { showUpgradeBanner.value = false }, 8000)
  }
  if (route.query.credits === 'added') {
    const originalCredits = auth.value?.credits ?? 0
    for (let i = 0; i < 5; i++) {
      await refresh()
      if ((auth.value?.credits ?? 0) > originalCredits) break
      await new Promise(r => setTimeout(r, 2000))
    }
    showCreditsBanner.value = (auth.value?.credits ?? 0) > originalCredits
    if (showCreditsBanner.value) setTimeout(() => { showCreditsBanner.value = false }, 8000)
  }

  // Load active sessions
  sessionsLoading.value = true
  sessions.value = await fetchSessions()
  sessionsLoading.value = false
})

async function handleUpgrade() {
  upgradeLoading.value = true
  try {
    const res = await authedFetch('/api/v1/stripe/checkout', { method: 'POST' })
    if (res.url) window.location.href = res.url
  } catch (e) {
    console.error('Checkout error:', e)
  } finally {
    upgradeLoading.value = false
  }
}

async function handlePortal() {
  portalLoading.value = true
  try {
    const res = await authedFetch('/api/v1/stripe/portal', { method: 'POST' })
    if (res.url) window.open(res.url, '_blank')
  } catch (e) {
    console.error('Portal error:', e)
  } finally {
    portalLoading.value = false
  }
}

async function handleAddFunds() {
  fundsError.value = ''
  const cents = fundsAmountCents.value
  if (!cents) {
    fundsError.value = 'Enter an amount between $1 and $100'
    return
  }
  fundsLoading.value = true
  try {
    const res = await authedFetch('/api/v1/stripe/credits', { method: 'POST', body: { amount: cents } })
    if (res.url) window.location.href = res.url
  } catch (e) {
    fundsError.value = 'Something went wrong. Try again.'
    console.error('Credits error:', e)
  } finally {
    fundsLoading.value = false
  }
}

function setQuickPick(dollars) {
  fundsInput.value = String(dollars)
  fundsError.value = ''
}

async function changePassword() {
  pwMsg.value = ''
  pwError.value = ''
  if (pwForm.newPw !== pwForm.confirm) { pwError.value = 'Passwords do not match'; return }
  if (pwForm.newPw.length < 8) { pwError.value = 'Minimum 8 characters'; return }
  pwLoading.value = true
  try {
    await authedFetch('/api/v1/auth/change-password', {
      method: 'POST',
      body: { currentPassword: pwForm.current, newPassword: pwForm.newPw },
    })
    pwMsg.value = 'Password updated.'
    pwForm.current = ''
    pwForm.newPw = ''
    pwForm.confirm = ''
  } catch (e) {
    pwError.value = e.data?.error || 'Failed to change password'
  } finally {
    pwLoading.value = false
  }
}

async function handleDeleteAccount() {
  deleteError.value = ''
  if (deleteInput.value !== 'DELETE') {
    deleteError.value = 'Type DELETE to confirm'
    return
  }
  deleteLoading.value = true
  try {
    await deleteAccount('DELETE')
    router.push('/')
  } catch (e) {
    deleteError.value = e.data?.error || 'Failed to delete account'
    deleteLoading.value = false
  }
}

async function onLogout() {
  await handleLogout()
  router.push('/')
}

async function onRevokeSession(id) {
  revokeLoadingId.value = id
  try {
    await revokeSession(id)
    sessions.value = sessions.value.filter(s => s.id !== id)
  } catch { /* ignore */ }
  revokeLoadingId.value = null
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatRelativeDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  return formatDate(iso)
}

const planLabel = computed(() => {
  const p = auth.value?.plan
  if (p === 'pro') return 'Shoulders AI'
  if (p === 'enterprise') return 'Enterprise'
  return 'Free'
})

const creditsLow = computed(() => (auth.value?.credits ?? 0) < 100)
const wasSubscribed = computed(() => auth.value?.plan === 'free' && !!auth.value?.stripeCustomerId)

function formatBalance(cents) {
  if (cents == null) return '$0.00'
  return '$' + (cents / 100).toFixed(2)
}
</script>

<template>
  <div class="pt-28 pb-20 px-6">
    <div class="max-w-2xl mx-auto">

      <!-- Loading -->
      <div v-if="loading" class="text-sm text-stone-400">Loading...</div>

      <template v-else-if="auth">
        <!-- A. Page header -->
        <h1 class="font-serif text-2xl font-semibold text-stone-900 tracking-tight mb-1">{{ auth.user?.email }}</h1>
        <p class="text-sm text-stone-500 mb-10">Manage your plan, balance, and security.</p>

        <!-- B. Banners -->
        <div v-if="showUpgradeBanner" @click="showUpgradeBanner = false" class="mb-6 px-4 py-3 rounded-lg bg-sea-50 border border-sea-100 cursor-pointer">
          <p class="text-sm font-medium text-sea-800">Welcome to Shoulders AI. Your AI usage balance has been added.</p>
        </div>
        <div v-if="showCreditsBanner" @click="showCreditsBanner = false" class="mb-6 px-4 py-3 rounded-lg bg-sea-50 border border-sea-100 cursor-pointer">
          <p class="text-sm font-medium text-sea-800">Balance added to your account.</p>
        </div>
        <div v-if="auth.suspended" class="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-100">
          <p class="text-sm font-medium text-red-800">Your account has been suspended.</p>
          <p class="text-xs text-red-600 mt-1">Contact <a href="mailto:contact@shoulde.rs" class="underline">contact@shoulde.rs</a> for assistance.</p>
        </div>

        <!-- C. Overview card (hero) -->
        <div class="border border-stone-200 rounded-lg mb-8">
          <div class="grid grid-cols-1 md:grid-cols-2">
            <!-- Plan side -->
            <div class="p-6">
              <h2 class="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Plan</h2>
              <p class="text-sm font-semibold text-stone-900">{{ planLabel }}</p>
              <p v-if="auth.plan === 'pro' && auth.cancelAt" class="text-xs text-amber-600 mt-0.5">Cancels {{ formatDate(auth.cancelAt) }}</p>
              <p v-else-if="auth.plan === 'pro'" class="text-xs text-stone-500 mt-0.5">$15 / month &middot; billed monthly</p>
              <p v-else-if="auth.plan === 'enterprise'" class="text-xs text-stone-500 mt-0.5">Custom plan</p>
              <p v-else-if="wasSubscribed" class="text-xs text-stone-500 mt-0.5">Subscription ended</p>
              <p v-else class="text-xs text-stone-500 mt-0.5">Free trial</p>
              <div class="mt-4">
                <button
                  v-if="auth.plan === 'free'"
                  @click="handleUpgrade"
                  :disabled="upgradeLoading"
                  class="text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 px-3.5 py-1.5 rounded transition-colors"
                >
                  {{ upgradeLoading ? 'Loading...' : (wasSubscribed ? 'Resubscribe' : 'Upgrade') }}
                </button>
                <div v-else-if="auth.plan === 'pro'" class="flex items-center gap-3">
                  <span v-if="auth.cancelAt" class="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">Cancelling</span>
                  <span v-else class="text-[10px] font-medium text-sea-600 bg-sea-50 px-2 py-1 rounded">Active</span>
                  <button
                    @click="handlePortal"
                    :disabled="portalLoading"
                    class="text-xs text-stone-600 hover:text-stone-900 transition-colors disabled:opacity-50"
                  >
                    {{ portalLoading ? 'Loading...' : (auth.cancelAt ? 'Resubscribe' : 'Manage billing') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Balance side -->
            <div class="p-6 border-t md:border-t-0 md:border-l border-stone-200">
              <h2 class="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Balance</h2>
              <div class="flex items-end gap-2 mb-2">
                <span class="text-3xl font-semibold text-stone-900 font-mono tabular-nums leading-none">{{ formatBalance(auth.credits) }}</span>
                <span class="text-sm text-stone-400 pb-0.5">remaining</span>
              </div>
              <p v-if="usage" class="text-xs text-stone-500">
                {{ formatBalance(usage.totalCredits) }} used this month
                <span class="text-stone-300 mx-1">&middot;</span>
                {{ usage.totalCalls.toLocaleString() }} {{ usage.totalCalls === 1 ? 'call' : 'calls' }}
              </p>
              <div v-if="creditsLow" class="mt-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-100">
                <p class="text-xs text-amber-700">
                  Running low on balance.
                  <button v-if="auth.plan === 'free'" @click="handleUpgrade" class="underline font-medium">{{ wasSubscribed ? 'Resubscribe' : 'Upgrade your plan' }}</button>
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- D. Add funds card (Pro only) / Subscribe CTA (Free) -->
        <div id="add-funds" v-if="auth.plan === 'pro'" class="border border-stone-200 rounded-lg p-6 mb-8">
          <h2 class="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Add funds</h2>
          <div class="flex gap-3">
            <div class="relative flex-1">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400 pointer-events-none">$</span>
              <input
                v-model="fundsInput"
                type="number"
                min="1"
                max="100"
                step="any"
                placeholder="0.00"
                class="w-full pl-7 pr-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                @keydown.enter="handleAddFunds"
              >
            </div>
            <button
              @click="handleAddFunds"
              :disabled="fundsLoading || !fundsAmountCents"
              class="bg-stone-900 hover:bg-stone-800 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded transition-colors shrink-0"
            >
              {{ fundsLoading ? 'Redirecting...' : 'Add funds' }}
            </button>
          </div>
          <div class="flex gap-2 mt-3">
            <button
              v-for="amt in [5, 10, 20]"
              :key="amt"
              @click="setQuickPick(amt)"
              class="text-xs text-stone-500 hover:text-stone-900 border border-stone-200 hover:border-stone-300 px-3 py-1 rounded transition-colors"
              :class="{ 'border-stone-400 text-stone-900': fundsInput === String(amt) }"
            >
              ${{ amt }}
            </button>
          </div>
          <p v-if="fundsError" class="text-xs text-red-600 mt-2">{{ fundsError }}</p>
          <p class="text-xs text-stone-400 mt-2">You'll be redirected to Stripe to complete the purchase.</p>
        </div>
        <div v-else-if="auth.plan === 'free'" class="border border-stone-200 rounded-lg p-6 mb-8">
          <h2 class="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-4">Balance</h2>
          <p v-if="wasSubscribed" class="text-sm text-stone-600 leading-relaxed">
            Your subscription has ended. Resubscribe to continue using AI features and add balance.
          </p>
          <p v-else class="text-sm text-stone-600 leading-relaxed">
            Subscribe to purchase additional balance and continue using AI features after your free trial.
          </p>
          <button
            @click="handleUpgrade"
            :disabled="upgradeLoading"
            class="mt-4 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded transition-colors"
          >
            {{ upgradeLoading ? 'Loading...' : (wasSubscribed ? 'Resubscribe' : 'Subscribe') }}
          </button>
        </div>

        <!-- E. Password -->
        <div class="border border-stone-200 rounded-lg p-6 mb-8">
          <h3 class="text-sm font-medium text-stone-900 mb-3">Change password</h3>
          <p v-if="pwError" class="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{{ pwError }}</p>
          <p v-if="pwMsg" class="mb-3 text-xs text-sea-600 bg-sea-50 border border-sea-100 rounded-md px-3 py-2">{{ pwMsg }}</p>
          <form class="space-y-3" @submit.prevent="changePassword">
            <input v-model="pwForm.current" type="password" required placeholder="Current password" class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300">
            <input v-model="pwForm.newPw" type="password" required minlength="8" placeholder="New password" class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300">
            <input v-model="pwForm.confirm" type="password" required minlength="8" placeholder="Confirm new password" class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300">
            <button type="submit" :disabled="pwLoading" class="bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded transition-colors">
              {{ pwLoading ? 'Updating...' : 'Update password' }}
            </button>
          </form>
        </div>

        <!-- F. Sessions (collapsible) -->
        <details class="border border-stone-200 rounded-lg mb-8">
          <summary class="px-6 py-4 cursor-pointer text-xs font-semibold text-stone-400 uppercase tracking-wider select-none hover:text-stone-600 transition-colors">
            Active sessions
          </summary>
          <div class="px-6 pb-5">
            <div v-if="sessionsLoading" class="text-xs text-stone-400">Loading sessions...</div>
            <div v-else-if="sessions.length" class="space-y-2">
              <div
                v-for="session in sessions"
                :key="session.id"
                class="flex items-center justify-between px-3 py-2.5 rounded-md border border-stone-100 bg-stone-50/50"
              >
                <div>
                  <p class="text-sm text-stone-900">{{ session.deviceLabel }}</p>
                  <p class="text-xs text-stone-400">Signed in {{ formatRelativeDate(session.createdAt) }}</p>
                </div>
                <button
                  @click="onRevokeSession(session.id)"
                  :disabled="revokeLoadingId === session.id"
                  class="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                >
                  {{ revokeLoadingId === session.id ? 'Revoking...' : 'Revoke' }}
                </button>
              </div>
            </div>
            <p v-else class="text-xs text-stone-400">No active sessions found.</p>
          </div>
        </details>

        <!-- G. Footer actions row -->
        <div class="border-t border-stone-200 pt-6 flex items-start justify-between">
          <button @click="onLogout" class="text-sm text-stone-500 hover:text-stone-900 transition-colors">
            Sign out
          </button>
          <div class="text-right">
            <button
              v-if="!showDeleteConfirm"
              @click="showDeleteConfirm = true"
              class="text-sm text-stone-400 hover:text-red-600 transition-colors"
            >
              Delete account
            </button>
            <div v-if="showDeleteConfirm" class="max-w-xs">
              <p class="text-xs text-stone-500 mb-2">Permanently delete your account. This cannot be undone.</p>
              <p class="text-xs text-stone-600 mb-2">Type <span class="font-mono font-semibold text-red-600">DELETE</span> to confirm:</p>
              <p v-if="deleteError" class="mb-2 text-xs text-red-600">{{ deleteError }}</p>
              <div class="flex gap-2">
                <input
                  v-model="deleteInput"
                  type="text"
                  placeholder="DELETE"
                  spellcheck="false"
                  autocomplete="off"
                  class="flex-1 px-3 py-2 text-sm font-mono rounded-md border border-stone-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none transition-colors text-stone-900 placeholder-stone-300"
                  @keydown.enter="handleDeleteAccount"
                >
                <button
                  @click="handleDeleteAccount"
                  :disabled="deleteLoading || deleteInput !== 'DELETE'"
                  class="text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 px-3 py-2 rounded transition-colors"
                >
                  {{ deleteLoading ? '...' : 'Confirm' }}
                </button>
                <button
                  @click="showDeleteConfirm = false; deleteInput = ''; deleteError = ''"
                  class="text-xs text-stone-400 hover:text-stone-600 px-1 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
