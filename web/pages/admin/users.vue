<template>
  <div>
    <!-- Toolbar -->
    <div class="flex items-center gap-3 mb-4">
      <input v-model="search" placeholder="Search by email..." @input="debouncedFetch"
        class="px-3 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 focus:ring-1 focus:ring-stone-400 outline-none w-64 text-stone-900 placeholder-stone-400">
      <select v-model="planFilter" @change="page = 1; fetchData()"
        class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
        <option value="">All plans</option>
        <option value="free">Free</option>
        <option value="pro">Pro</option>
        <option value="enterprise">Enterprise</option>
      </select>
      <span class="text-xs text-stone-400" v-if="data">{{ data.pagination.total }} users</span>
      <div class="flex-1" />
      <button @click="showCreateModal = true"
        class="px-3 py-1.5 text-xs rounded bg-stone-900 text-white hover:bg-stone-800 transition-colors">Create User</button>
    </div>

    <div v-if="error" class="text-xs text-red-600">Failed to load. <NuxtLink to="/admin/login" class="underline">Re-login</NuxtLink></div>

    <div v-else-if="data" class="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-stone-200 bg-stone-50 text-left">
            <th class="py-2 px-3 font-medium text-stone-400">Email</th>
            <th class="py-2 px-3 font-medium text-stone-400">Plan</th>
            <th class="py-2 px-3 font-medium text-stone-400 text-right cursor-pointer select-none" @click="toggleSort('credits')">
              Balance <span v-if="sort === 'credits'" class="text-stone-900">{{ dir === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th class="py-2 px-3 font-medium text-stone-400 text-right">Calls</th>
            <th class="py-2 px-3 font-medium text-stone-400 text-right">Spent</th>
            <th class="py-2 px-3 font-medium text-stone-400">Verified</th>
            <th class="py-2 px-3 font-medium text-stone-400 cursor-pointer select-none" @click="toggleSort('active')">
              Last Active <span v-if="sort === 'active'" class="text-stone-900">{{ dir === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th class="py-2 px-3 font-medium text-stone-400 cursor-pointer select-none" @click="toggleSort('created')">
              Joined <span v-if="sort === 'created'" class="text-stone-900">{{ dir === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th class="py-2 px-3 font-medium text-stone-400">Status</th>
            <th class="py-2 px-3 font-medium text-stone-400">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in data.users" :key="u.id" class="border-b border-stone-50 hover:bg-stone-50/50">
            <td class="py-2 px-3 font-mono text-stone-900">{{ u.email || '(no email)' }}</td>
            <td class="py-2 px-3">
              <span class="capitalize" :class="u.plan === 'pro' ? 'text-sea-600 font-medium' : u.plan === 'enterprise' ? 'text-amber-600 font-medium' : 'text-stone-600'">{{ u.plan }}</span>
            </td>
            <td class="py-2 px-3 text-right font-mono" :class="u.credits < 100 ? 'text-red-500' : 'text-stone-900'">${{ (u.credits / 100).toFixed(2) }}</td>
            <td class="py-2 px-3 text-right font-mono text-stone-600">
              <NuxtLink :to="'/admin/calls?userId=' + u.id" class="text-cadet-500 hover:text-cadet-700 hover:underline">{{ u.total_calls }}</NuxtLink>
            </td>
            <td class="py-2 px-3 text-right font-mono text-stone-600">${{ (u.total_credits_used / 100).toFixed(2) }}</td>
            <td class="py-2 px-3">
              <span :class="u.email_verified ? 'text-sea-600' : 'text-stone-300'">{{ u.email_verified ? 'Yes' : 'No' }}</span>
            </td>
            <td class="py-2 px-3 text-stone-400 font-mono whitespace-nowrap">{{ formatRelative(u.last_active_at) }}</td>
            <td class="py-2 px-3 text-stone-400 font-mono whitespace-nowrap">{{ new Date(u.created_at).toLocaleDateString() }}</td>
            <td class="py-2 px-3">
              <span v-if="u.suspended" class="px-1.5 py-0.5 text-[10px] rounded bg-red-100 text-red-700 font-medium">Suspended</span>
              <span v-else class="px-1.5 py-0.5 text-[10px] rounded bg-green-50 text-green-700 font-medium">Active</span>
            </td>
            <td class="py-2 px-3">
              <div class="flex items-center gap-1">
                <button @click="openEdit(u)" title="Edit"
                  class="px-1.5 py-0.5 text-[10px] rounded bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors">Edit</button>
                <button @click="toggleSuspend(u)" :title="u.suspended ? 'Unsuspend' : 'Suspend'"
                  class="px-1.5 py-0.5 text-[10px] rounded transition-colors"
                  :class="u.suspended ? 'bg-green-50 hover:bg-green-100 text-green-700' : 'bg-amber-50 hover:bg-amber-100 text-amber-700'">
                  {{ u.suspended ? 'Unsuspend' : 'Suspend' }}
                </button>
                <button @click="deleteUser(u)" title="Delete"
                  class="px-1.5 py-0.5 text-[10px] rounded bg-red-50 hover:bg-red-100 text-red-600 transition-colors">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="data" class="flex items-center justify-between mt-3 text-xs text-stone-400">
      <span>Page {{ page }} of {{ data.pagination.pages || 1 }}</span>
      <div class="flex gap-2">
        <button :disabled="page <= 1" @click="page--; fetchData()"
          class="px-2 py-1 rounded border border-stone-200 hover:bg-white disabled:opacity-30 transition-colors">Prev</button>
        <button :disabled="page >= data.pagination.pages" @click="page++; fetchData()"
          class="px-2 py-1 rounded border border-stone-200 hover:bg-white disabled:opacity-30 transition-colors">Next</button>
      </div>
    </div>

    <div v-if="!data && !error" class="text-xs text-stone-400">Loading...</div>

    <!-- Create User Modal -->
    <div v-if="showCreateModal" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50" @click.self="showCreateModal = false">
      <div class="bg-white rounded-lg border border-stone-200 p-6 w-96 shadow-lg">
        <div class="text-sm font-medium text-stone-900 mb-4">Create User</div>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-stone-500 mb-1">Email</label>
            <input v-model="createForm.email" type="email" class="w-full px-3 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
          </div>
          <div>
            <label class="block text-xs text-stone-500 mb-1">Password</label>
            <input v-model="createForm.password" type="password" class="w-full px-3 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
          </div>
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-xs text-stone-500 mb-1">Plan</label>
              <select v-model="createForm.plan" class="w-full px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div class="flex-1">
              <label class="block text-xs text-stone-500 mb-1">Balance (cents)</label>
              <input v-model.number="createForm.credits" type="number" class="w-full px-3 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
              <span class="text-[10px] text-stone-400">${{ (createForm.credits / 100).toFixed(2) }}</span>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button @click="showCreateModal = false" class="px-3 py-1.5 text-xs rounded border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors">Cancel</button>
          <button @click="createUser" class="px-3 py-1.5 text-xs rounded bg-stone-900 text-white hover:bg-stone-800 transition-colors">Create</button>
        </div>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div v-if="showEditModal" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50" @click.self="showEditModal = false">
      <div class="bg-white rounded-lg border border-stone-200 p-6 w-96 shadow-lg">
        <div class="text-sm font-medium text-stone-900 mb-4">Edit User</div>
        <div class="text-xs text-stone-400 mb-3 font-mono">{{ editForm.email }}</div>
        <div class="space-y-3">
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="block text-xs text-stone-500 mb-1">Plan</label>
              <select v-model="editForm.plan" class="w-full px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div class="flex-1">
              <label class="block text-xs text-stone-500 mb-1">Balance (cents)</label>
              <input v-model.number="editForm.credits" type="number" class="w-full px-3 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
              <span class="text-[10px] text-stone-400">${{ (editForm.credits / 100).toFixed(2) }}</span>
            </div>
          </div>
          <label class="flex items-center gap-2 text-xs text-stone-600 cursor-pointer">
            <input type="checkbox" v-model="editForm.verified" class="rounded border-stone-300 text-stone-600 focus:ring-stone-400">
            Email verified
          </label>
          <div>
            <label class="block text-xs text-stone-500 mb-1">Reset Password <span class="text-stone-400">(leave blank to keep)</span></label>
            <input v-model="editForm.password" type="password" placeholder="New password..." class="w-full px-3 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900 placeholder-stone-400">
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button @click="showEditModal = false" class="px-3 py-1.5 text-xs rounded border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors">Cancel</button>
          <button @click="saveEdit" class="px-3 py-1.5 text-xs rounded bg-stone-900 text-white hover:bg-stone-800 transition-colors">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const search = ref('')
const planFilter = ref('')
const sort = ref('created')
const dir = ref('desc')
const page = ref(1)
const data = ref(null)
const error = ref(false)
let timer = null

// Create modal
const showCreateModal = ref(false)
const createForm = reactive({ email: '', password: '', plan: 'free', credits: 500 })

// Edit modal
const showEditModal = ref(false)
const editForm = reactive({ userId: '', email: '', plan: '', credits: 0, verified: false, password: '' })

function toggleSort(col) {
  if (sort.value === col) {
    dir.value = dir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sort.value = col
    dir.value = 'desc'
  }
  page.value = 1
  fetchData()
}

async function fetchData() {
  try {
    data.value = await $fetch('/api/admin/users', {
      query: { page: page.value, search: search.value, plan: planFilter.value, sort: sort.value, dir: dir.value }
    })
  } catch {
    error.value = true
  }
}

function debouncedFetch() {
  clearTimeout(timer)
  timer = setTimeout(() => { page.value = 1; fetchData() }, 300)
}

function formatRelative(iso) {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

async function createUser() {
  try {
    await $fetch('/api/admin/users', { method: 'POST', body: { ...createForm } })
    showCreateModal.value = false
    Object.assign(createForm, { email: '', password: '', plan: 'free', credits: 500 })
    await fetchData()
  } catch (e) {
    alert(e.data?.error || 'Failed to create user')
  }
}

function openEdit(user) {
  editForm.userId = user.id
  editForm.email = user.email
  editForm.plan = user.plan
  editForm.credits = user.credits
  editForm.verified = !!user.email_verified
  editForm.password = ''
  showEditModal.value = true
}

async function saveEdit() {
  try {
    await $fetch('/api/admin/users', {
      method: 'PATCH',
      body: { userId: editForm.userId, plan: editForm.plan, credits: editForm.credits, emailVerified: editForm.verified ? 1 : 0, ...(editForm.password ? { password: editForm.password } : {}) }
    })
    showEditModal.value = false
    await fetchData()
  } catch (e) {
    alert(e.data?.error || 'Failed to update user')
  }
}

async function toggleSuspend(user) {
  try {
    await $fetch('/api/admin/users', { method: 'PATCH', body: { userId: user.id, suspended: user.suspended ? 0 : 1 } })
    await fetchData()
  } catch (e) {
    alert(e.data?.error || 'Failed to update user')
  }
}

async function deleteUser(user) {
  if (!confirm(`Delete user ${user.email || user.id}? This will also delete all their tokens and API call history.`)) return
  try {
    await $fetch('/api/admin/users', { method: 'DELETE', body: { userId: user.id } })
    await fetchData()
  } catch (e) {
    alert(e.data?.error || 'Failed to delete user')
  }
}

await fetchData()
</script>
