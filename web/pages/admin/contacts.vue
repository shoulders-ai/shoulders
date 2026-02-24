<template>
  <div>
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <select v-model="dismissed" @change="page=1; fetchData()"
        class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
        <option value="">All</option>
        <option value="0">Pending</option>
        <option value="1">Dismissed</option>
      </select>
      <span class="text-xs text-stone-400" v-if="data">{{ data.pagination.total }} enquiries</span>
    </div>

    <div v-if="error" class="text-xs text-red-600">Failed to load. <NuxtLink to="/admin/login" class="underline">Re-login</NuxtLink></div>

    <div v-if="data" class="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-stone-200 bg-stone-50 text-left">
            <th class="py-2 px-3 font-medium text-stone-400">Institution</th>
            <th class="py-2 px-3 font-medium text-stone-400">Contact</th>
            <th class="py-2 px-3 font-medium text-stone-400">Email</th>
            <th class="py-2 px-3 font-medium text-stone-400">Team</th>
            <th class="py-2 px-3 font-medium text-stone-400">Needs</th>
            <th class="py-2 px-3 font-medium text-stone-400">Date</th>
            <th class="py-2 px-3 font-medium text-stone-400"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="c in data.contacts" :key="c.id">
            <tr class="border-b border-stone-50 hover:bg-stone-50/50"
              :class="c.dismissed ? 'opacity-50' : ''">
              <td class="py-2 px-3 text-stone-900 font-medium">{{ c.institution }}</td>
              <td class="py-2 px-3 text-stone-600">{{ c.name }}</td>
              <td class="py-2 px-3"><a :href="'mailto:' + c.email" class="text-cadet-500 hover:text-cadet-700">{{ c.email }}</a></td>
              <td class="py-2 px-3 text-stone-600 font-mono">{{ c.team_size || '-' }}</td>
              <td class="py-2 px-3 text-stone-600 max-w-[300px] truncate cursor-pointer hover:text-stone-900"
                @click="expanded = expanded === c.id ? null : c.id">{{ c.needs || '-' }}</td>
              <td class="py-2 px-3 text-stone-400 font-mono whitespace-nowrap">{{ formatDate(c.created_at) }}</td>
              <td class="py-2 px-3">
                <button @click="toggleDismiss(c)"
                  class="px-1.5 py-0.5 text-[10px] rounded transition-colors"
                  :class="c.dismissed ? 'bg-stone-100 hover:bg-stone-200 text-stone-600' : 'bg-red-50 hover:bg-red-100 text-red-600'">
                  {{ c.dismissed ? 'Restore' : 'Dismiss' }}
                </button>
              </td>
            </tr>
            <tr v-if="expanded === c.id && c.needs" class="border-b border-stone-50">
              <td colspan="7" class="px-3 py-3 bg-stone-50/50">
                <div class="text-xs text-stone-600 whitespace-pre-wrap max-w-2xl">{{ c.needs }}</div>
              </td>
            </tr>
          </template>
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
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const dismissed = ref('')
const page = ref(1)
const data = ref(null)
const error = ref(false)
const expanded = ref(null)

function formatDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function fetchData() {
  try {
    const query = { page: page.value }
    if (dismissed.value !== '') query.dismissed = dismissed.value
    data.value = await $fetch('/api/admin/contacts', { query })
  } catch {
    error.value = true
  }
}

async function toggleDismiss(contact) {
  const newVal = contact.dismissed ? 0 : 1
  try {
    await $fetch('/api/admin/contacts', { method: 'PATCH', body: { id: contact.id, dismissed: newVal } })
    contact.dismissed = newVal
  } catch (e) {
    alert(e.data?.error || 'Failed to update')
  }
}

await fetchData()
</script>
