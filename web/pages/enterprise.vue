<template>
  <div class="pt-36 pb-20 px-6">
    <div class="max-w-3xl mx-auto">
      <h1 class="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-stone-900 text-center">
        Shoulders for Organisations
      </h1>
      <p class="mt-4 text-base text-stone-600 text-center leading-relaxed max-w-xl mx-auto">
        Managed deployment, data governance, and support for research teams.
      </p>

      <!-- Value props -->
      <div class="mt-16 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 max-w-2xl mx-auto">
        <div>
          <h3 class="text-sm font-semibold text-stone-900">Data governance</h3>
          <p class="mt-1.5 text-sm text-stone-600 leading-relaxed">
            Local-first. Research data stays on the researcher's machine. AI requests route to private endpoints.
          </p>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-stone-900">Model configuration</h3>
          <p class="mt-1.5 text-sm text-stone-600 leading-relaxed">
            Connect to private LLMs (managed cloud, internal models) to ensure compliance and data security.
          </p>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-stone-900">Audit trail</h3>
          <p class="mt-1.5 text-sm text-stone-600 leading-relaxed">
            AI suggestions are tracked and reviewable. Every document change is versioned automatically.
          </p>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-stone-900">Central configuration</h3>
          <p class="mt-1.5 text-sm text-stone-600 leading-relaxed">
            Citation standards, AI system prompts, review workflows, and templates for your organisation.
          </p>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-stone-900">Site licences and billing</h3>
          <p class="mt-1.5 text-sm text-stone-600 leading-relaxed">
            Volume AI billing, consolidated invoicing, and licence management for your organisation.
          </p>
        </div>
        <div>
          <h3 class="text-sm font-semibold text-stone-900">Onboarding and support</h3>
          <p class="mt-1.5 text-sm text-stone-600 leading-relaxed">
            Training for researchers and analysts. Priority support with a dedicated contact.
          </p>
        </div>
      </div>

      <!-- Form -->
      <div class="mt-20 border-t border-stone-100 pt-12 max-w-md mx-auto">
        <h2 class="font-serif text-xl font-semibold tracking-tight text-stone-900 text-center">Get in touch</h2>

        <form class="mt-4 space-y-4" @submit.prevent="handleSubmit">
          <div>
            <label class="block text-xs font-medium text-stone-600 mb-1">Institution</label>
            <input v-model="form.institution" type="text" required class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300" placeholder="University or organisation">
          </div>
          <div>
            <label class="block text-xs font-medium text-stone-600 mb-1">Contact name</label>
            <input v-model="form.name" type="text" required class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300" placeholder="Your name">
          </div>
          <div>
            <label class="block text-xs font-medium text-stone-600 mb-1">Email</label>
            <input v-model="form.email" type="email" required class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300" placeholder="you@institution.edu">
          </div>
          <div>
            <label class="block text-xs font-medium text-stone-600 mb-1">Team size</label>
            <input v-model="form.teamSize" type="text" class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300" placeholder="Approximate number">
          </div>
          <div>
            <label class="block text-xs font-medium text-stone-600 mb-1">What are you looking for?</label>
            <textarea v-model="form.needs" rows="3" class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300 resize-none" placeholder="Deployment requirements, compliance needs, team size..." />
          </div>
          <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
          <p v-if="submitted" class="text-xs text-sea-600">Thank you. We'll be in touch.</p>
          <button type="submit" :disabled="submitted" class="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-medium py-2 rounded transition-colors">
            {{ submitted ? 'Message sent' : 'Send' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
const form = reactive({ institution: '', name: '', email: '', teamSize: '', needs: '' })
const submitted = ref(false)
const error = ref('')

async function handleSubmit() {
  error.value = ''
  try {
    await $fetch('/api/v1/contact', { method: 'POST', body: form })
    submitted.value = true
  } catch (e) {
    error.value = e.data?.error || 'Something went wrong. Please email contact@shoulde.rs directly.'
  }
}
</script>
