<template>
  <div class="relative flex flex-col justify-center h-full bg-white px-20 py-20">
    <div class="max-w-8xl">
      <!-- Label -->
      <p class="absolute top-14 left-20 text-xs uppercase tracking-widest text-stone-400">Background</p>

      <!-- Headline -->
      <h2 class="text-4xl font-semibold text-stone-900 tracking-tight leading-tight mb-16">
        AI has fundamentally transformed software engineering
      </h2>

      <!-- Clean statements -->
      <div class="space-y-8">
        <p class="text-3xl text-stone-600">
          85% of developers use AI tools like Cursor and Claude Code
        </p>
        <p class="text-3xl text-stone-600">
          For these developers, around 60% of code is now AI-generated
        </p>
        <p class="text-3xl text-stone-600">
          Entire applications can be <span class="italic">vibe coded</span> without writing a single line of code
        </p>
      </div>
    </div>

    <!-- Sources -->
    <div class="absolute bottom-20 left-20 text-xs text-stone-400">
      <span class="font-medium pr-2">Sources:</span>
      <a href="https://survey.stackoverflow.co/2025/" target="_blank" rel="noopener" class="hover:underline">Stack Overflow Developer Survey 2025</a>
      <span class="mx-2">·</span>
      <a href="https://blog.jetbrains.com/research/2025/10/state-of-developer-ecosystem-2025" target="_blank" rel="noopener" class="hover:underline">JetBrains State of Developer Ecosystem 2025</a>
    </div>
  </div>
</template>
