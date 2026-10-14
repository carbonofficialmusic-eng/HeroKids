---
name: Legacy API migration boundary
description: Why the existing Little Champs frontend continues to use its established API client after moving to the multi-artifact workspace.
---

Keep the existing frontend request layer and the existing server routes intact when extending Little Champs to another surface. Define new OpenAPI contracts selectively for new integrations rather than replacing old callers as part of a port.

**Why:** The product has a large existing API with custom authentication, payment webhooks and real-time messaging. Rewriting all callers during the workspace migration would create a substantial regression risk without changing the user-facing product.

**How to apply:** For follow-up work, use the established endpoints where they already meet the need. Do not infer that a route's absence from the generated contract means that the route is unavailable.