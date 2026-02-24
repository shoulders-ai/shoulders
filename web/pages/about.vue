<template>
  <div class="pt-36 pb-20 px-6">
    <div class="max-w-2xl mx-auto">

      <h1 class="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-stone-900">
        About Shoulders
      </h1>

      <p class="mt-8 text-base text-stone-600 leading-relaxed">
        Shoulders is an AI workspace for researchers. It combines
        text editing, reference management, coding, and AI assistance in one application.
        The aim is to integrate AI into the research workflow in a way that preserves agency
        and critical thinking. 
      </p>

      <div class="mt-12 mb-12 md:mt-16 md:mb-16">
        <blockquote class="border-l-2 border-stone-300 pl-6 pt-1">
          <p class="font-serif text-lg md:text-xl italic leading-relaxed text-stone-800">
            &ldquo;If I have seen further, it is by standing on the shoulders of giants.&rdquo;
          </p>
          <p class="mt-1 md:mt-3 pb-1 text-sm text-stone-500">
            Isaac Newton, 1675 (echoing Bernard of Chartres, c. 1120)
          </p>
        </blockquote>
      </div>

      <h2 class="mt-12 lg:mt-16 font-serif text-xl font-semibold tracking-tight text-stone-900">
        AI research tools built with intention and purpose
      </h2>

      <p class="mt-6 text-base text-stone-600 leading-relaxed">
        Software development has seen major disruption from AI. What started as better
        autocomplete has become agentic workflows where entire applications are built
        autonomously by AI.
      </p>

      <p class="mt-5 text-base text-stone-600 leading-relaxed">
        Meanwhile, many researchers are still copy-pasting from a ChatGPT browser window.
      </p>

      <p class="mt-5 text-base text-stone-600 leading-relaxed">
        Over the next few years, this will change. AI will take on a central place in how
        researchers work. While this holds enormous potential to accelerate
        scientific discovery, it also carries risks.
      </p>

      <p class="mt-5 text-base text-stone-600 leading-relaxed">
        Sycophantic AI, automation-induced complacency, and the mass-production of low-quality,
        <em>AI slop</em> papers threaten the integrity of research. We need to establish
        new practices, new norms &mdash; and build better tools with intention and purpose.
      </p>

      <div class="my-10 h-px bg-stone-100" />

      <p class="text-base text-stone-600 leading-relaxed">
        The patterns from software engineering &ndash; AI works autonomously, human
        reviews &ndash; will not transfer to research. Researchers require more
        iteration, critical judgment, and fine-grained controls. They must retain
        agency and oversight.
      </p>

      <p class="mt-5 text-base text-stone-600 leading-relaxed">
        We believe AI research tools must be built around the human &mdash; as tools
        for thought that increase not just the speed, but the quality of research.
      </p>

      <p class="mt-5 text-base text-stone-600 leading-relaxed">
        That is why we are building Shoulders.
      </p>

      <!-- Get involved -->
      <div class="mt-16 pt-12 border-t border-stone-100 pb-8">
        <h2 class="font-serif text-xl font-semibold tracking-tight text-stone-900">
          Get involved
        </h2>

        <p class="mt-5 text-base text-stone-600 leading-relaxed">
          Shoulders is a work in progress. Please <a href="mailto:contact@shoulde.rs" class="underline hover:text-stone-900 transition-colors">get in touch</a> if you have thoughts on what AI-human research collaboration should look like, or if you would like to collaborate.
        </p>

        <div class="mt-8 flex flex-wrap items-center gap-4">
          <NuxtLink to="/download" class="bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded transition-colors">
            Download
          </NuxtLink>
          <NuxtLink to="/enterprise" class="text-sm text-stone-600 hover:text-stone-900 transition-colors">
            Organisations &rarr;
          </NuxtLink>
        </div>
      </div>

    </div>
  </div>
</template>
