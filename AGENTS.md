## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Frontend & UI Architecture Rules

- STRICT HARDWARE ACCELERATION: ALL animations and transitions MUST use only GPU-accelerated CSS properties (`transform`, `opacity`, `scale`). NEVER animate layout-triggering properties (`width`, `height`, `top`, `left`, `margin`, `padding`).
- TAILWIND MOTION TOKENS: Standard UI micro-interactions (buttons, card hovers, form focus) MUST strictly rely on utility classes: `transition-all duration-200 ease-out`. Do NOT install external animation libraries for simple hover/focus states.
- COMPONENT ISOLATION: When building components with motion, separate structural layout markup from transition state logic.
- A11Y COMPLIANCE: All motion components MUST implement `prefers-reduced-motion: reduce` fallbacks (using Tailwind's `motion-safe:` and `motion-reduce:` prefixes).
