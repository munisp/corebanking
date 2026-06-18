# 54Bank asset inventory audit — 2026-04-21

## Repositories and extracted workspaces

- `/home/ubuntu/54bank-ui`
- `/home/ubuntu/54bank-consolidated`
- `/home/ubuntu/54bank_original_drive_extract/54bank_platform/54bank-unified-platform`
- `/home/ubuntu/archive_probe_extract/ubuntu/54bank-ui`
- `/home/ubuntu/archive_probe_extract/ubuntu/54bank_original_drive_extract`
- `/home/ubuntu/backend_recovery_extract/54bank-consolidated`

## Prior archives and handoff artifacts

- `/home/ubuntu/54bank-comprehensive-FINAL.tar.gz`
- `/home/ubuntu/54bank-comprehensive-final-20260420.tar.gz`
- `/home/ubuntu/54bank-comprehensive-workspace-20260419.tar.gz`
- `/home/ubuntu/54bank-comprehensive-workspace-20260420.tar.gz`
- `/home/ubuntu/54bank-comprehensive-workspace-20260421.tar.gz`
- `/home/ubuntu/54bank-final-comprehensive-20260417.tar`
- `/home/ubuntu/upload/pasted_file_8zDTvU_54bank-consolidated-postgres-rust-refresh-20260416.tar`
- `/home/ubuntu/upload/pasted_file_gVGkz9_54bank-final-comprehensive-20260417.tar`
- `/home/ubuntu/54bank_FINAL_PRODUCTION_READINESS_AND_SECURITY_REPORT_20260416.md`
- `/home/ubuntu/54bank_security_signal_audit_post_jwt_fix_20260416.txt`
- `/home/ubuntu/54bank_ui_build_20260416.txt`

## Archive-inspection support files

- `/home/ubuntu/archive_inspection/54bank_archive_manifest_full.txt`
- `/home/ubuntu/archive_inspection/54bank_archive_size_comparison_20260421.csv`
- `/home/ubuntu/archive_inspection/54bank_archive_summary.txt`
- `/home/ubuntu/archive_inspection/54bank_production_readiness_handoff_20260419.md`

## Deployment assets currently present in the active project

- `/home/ubuntu/54bank-ui/Dockerfile`
- `/home/ubuntu/54bank-ui/docker-compose.yml`
- `/home/ubuntu/54bank-ui/deploy/54bank-ui.yaml`

## Immediate implications

The active project already sits alongside multiple prior archives, extracted workspaces, and recovery surfaces. The final completion pass therefore needs explicit comparison against both `54bank-consolidated` and `54bank_original_drive_extract/.../54bank-unified-platform`, plus the existing archive-inspection manifests, before producing any new comprehensive archive.

## Backend coverage inventory snapshot

The active server runtime currently exposes substantial persistence helpers for tenant configuration, customers, cards, billers, bill payments, transfers, approvals, statements, notifications, workflow cases, operator actions, audit entries, export jobs, statement exports, platform search, runtime-state synchronization, and customer session preferences. However, the main tRPC router still only wires `system` and `auth`, which means the richer persistence layer is not yet surfaced as production API contracts for most banking domains.

This gap confirms that the next backend hardening passes should prioritize routing and middleware exposure for the existing persistence capabilities before claiming complete backend domain coverage across the embedded banking workspaces.

## Frontend gap-inventory snapshot

The main operator shell now exposes broad cross-domain navigation through `ArchiveAdminSidebar`, `AdminShell`, `ProductShell`, and `DomainWorkspace`, and the routed banking destinations expose at least baseline operator controls such as action advancement, export creation, and route switching. However, the frontend inventory still points to concentration risk in a few oversized surfaces—especially `Home.tsx`—and suggests that end-to-end CRUD coverage remains uneven because many domain routes emphasize summary visibility and operator rails rather than full create, detail, edit, and search workflows.

The next frontend hardening pass should therefore focus on narrowing the remaining gap between overview-grade routed workspaces and production-grade task completion flows, especially where domains currently expose summary cards and action rails without deeper record management or dedicated forms.

## Deployment-asset gap snapshot

The active project already includes a Dockerfile, docker-compose definition, and Kubernetes-style deployment manifest, but these assets still carry production-readiness gaps. The Docker health check targets `/api/platform/overview` while the compose health check points at an external hosted URL, and both compose and YAML still embed change-me secrets and fixed upstream service URLs that need stronger secret handling and environment standardization before a final handoff.

This means the deployment review backlog should focus less on creating new container assets and more on hardening the existing ones so runtime probes, secret injection, and service endpoint defaults align with the current server behavior.

## Existing archive size baseline

The latest recorded comparison shows a split between smaller workspace-only archives at roughly 382 MB and broader comprehensive archives in the 584 MB to 588 MB range. That baseline provides a concrete threshold for the final archive pass: if the next comprehensive package lands materially below the upper historical range, it should be treated as incomplete until scope differences are explicitly explained.

## Archive scope baseline refinement

The prior manifest evidence shows that the historical archive inspection mostly captured the broader `/home/ubuntu` environment and did not provide a clean, project-scoped manifest for `54bank-ui`, `54bank-consolidated`, or `54bank_original_drive_extract`. In practice, this means the recorded size baseline remains useful, but the final archive comparison will also need a fresh project-scoped manifest generated from the new package so completeness can be judged against the active 54Bank surfaces rather than against a home-directory-heavy historical tarball.

## Env-default, smoke, and automation findings

The automation surface is compact but real: the project includes `scripts/smoke-test.mjs` and `scripts/check-runtime-dates.mjs`, and the package scripts already wire a smoke command. The main production-readiness gaps are concentrated in configuration defaults rather than in missing scripts. Compose, YAML, and `server/index.ts` still embed change-me secrets, `host.docker.internal` upstreams, and fixed hosted URLs, while the smoke and health-check targets are split between `/api/platform/overview` and `/healthz`, which should be standardized before final handoff.

## Seed-data asset findings

The remaining seed-related surfaces are concentrated on the server side rather than in the active client. `server/platformPersistence.ts` still supports seed hydration for tenants, customer records, workflow entities, and partner onboarding data, while `server/partnerOnboardingRuntime.ts` retains seeded onboarding and approval records as active runtime defaults. That means the production-readiness review is now complete at the audit level: the major remaining gap is not undiscovered seed files, but the need to harden or replace the remaining seeded server-runtime bootstrapping during later implementation passes.

## Backend route coverage findings

The active server runtime exposes a broad REST surface under `/api/platform`, including tenant configuration, auth context, overview, customers, customer-servicing cards, billers, bills, transfers, approvals, statement exports, statements, workflows, partner onboarding, actions, audit, exports, search, and domain overviews for teller, reconciliation, ERPNext, and Islamic banking. However, the routed banking domains beyond these overview endpoints still skew toward summary and orchestration coverage instead of full domain-specific CRUD and integration depth, and the parallel tRPC router remains minimal. That confirms the remaining backend backlog is mainly about depth, consistency, and middleware hardening rather than the total absence of server routes.

## Backend business-rule and degraded-mode findings

The customer-servicing transfer and approval routes in `server/index.ts` already enforce several concrete business rules: transfers require `amount` and `transferType`, high-value transfers over 500000 enter `pending_review`, OTP confirmation must match the issued reference and verification code, and approval actions enforce role matching before state transitions are applied. The same routes also show the current degraded-mode limitation clearly. Most failures are handled as local validation or not-found responses, but there is little explicit retry, backoff, adapter-failure, or partial-dependency degradation handling beyond those synchronous checks. That evidence closes the audit gap: the remaining backend work is to harden integration behavior and domain depth, not to discover whether basic business rules exist at all.

## Explicit frontend workflow evidence

The frontend audit now has concrete evidence that the active operator UI already includes real search and filter controls in the shell and page layer, plus create, save, submit, approve, reject, export, and action-advancement controls in `PartnerOnboardingPortalPage.tsx`, `PartnerOnboardingAdminPage.tsx`, and `DomainWorkspace.tsx`. At the same time, the evidence also shows uneven depth across routed banking workspaces, because these richer task-completion flows are concentrated in a few surfaces while other embedded domains still depend more heavily on shared overview and action-rail patterns than on domain-specific CRUD forms and detail management.

## Frontend validation and responsive findings

The routed UI audit now also has explicit evidence for validation and responsiveness. Operator-facing pages already use disabled states, local error setters, and required-style control logic in onboarding and workflow flows, while the component layer includes breakpoint-aware layouts and small-screen patterns such as `sm:`, `md:`, `lg:`, sticky headers, and the new `lg:hidden` mobile admin navigation. The main remaining frontend gap is therefore uneven application of these patterns across routed banking workspaces rather than a total absence of validation or responsive primitives.

## Routed workspace audit: Operations Center

`OperationsCenter.tsx` confirms the current operator-shell pattern: it provides clear cross-domain navigation, loading and error handling, and responsive card grids, but it remains primarily an overview surface. The page opens workspaces and summarizes readiness rather than offering deep record creation, editing, or validation-heavy task execution inside the route itself. That supports the broader frontend-inventory conclusion that the shell and domain discovery experience are now strong, while full task-completion depth remains concentrated in only a subset of routed pages.

## Routed workspace audit: Trade Finance

`TradeFinanceWorkspace.tsx` reinforces the same pattern seen in Operations Center, but at the domain level. The route has clear embedded navigation context, domain-specific summaries, collection rails, and operator-control framing, yet it still relies on shared `DomainWorkspace` structures rather than deeper trade-specific forms, searches, edits, or transactional detail panels. This is useful audit evidence because it shows that the current frontend gap is not discoverability, but the remaining distance from overview-grade embedded modules to fully executable product workspaces.

## Routed workspace audit: Partner onboarding admin

`PartnerOnboardingAdminPage.tsx` provides the strongest current evidence of production-style operator usability in the routed interface. It includes refresh behavior, role switching, loading and error handling, selection-driven detail inspection, approval resolution actions, and responsive summary/detail sections. This page confirms that the current frontend already contains at least one richer administrative workflow, which sharpens the inventory conclusion: the main gap is inconsistency across domains, not the absence of advanced operator UX patterns altogether.

## Prioritized next TigerBeetle seams

Using the existing TigerBeetle audit and hardening backlog, the next direct-ledger implementation order is now explicit. The first seam should be teller transaction posting and balancing, because it already represents the clearest cash-operation boundary inside the platform workbench. The second seam should be Islamic banking contract review and exposure adjustments, because those routes already express approved-exposure lifecycle changes. The third seam should be insurance premium and claim settlement endpoints, because they are the cleanest remaining direct-money boundaries outside the teller and ledger-control stack. This prioritization should govern the next middleware-expansion pass before lower-confidence domains such as ERPNext or broader overview-only routes.

## Active-project TigerBeetle coverage refresh

A project-scoped reference sweep confirms that the active `54bank-ui` codebase still treats TigerBeetle primarily as an exposed posture and reporting concept rather than as a broad, domain-by-domain direct posting implementation inside this workspace. The current UI/server layer already surfaces TigerBeetle through ledger-sync, reconciliation, and middleware-topology language, while the richer direct-integration evidence still lives mainly in the recovered audit artifacts and service-coverage documents rather than in many new active-project domain handlers.

That means the next TigerBeetle work inside `54bank-ui` should continue from the seams already prioritized in the backlog: teller, Islamic banking, and insurance. The shared ledger-outcome envelope added to the overview endpoints is now the clearest active-project bridge between UI/runtime posture and future direct-ledger expansion, but the remaining domain routes still need deeper endpoint-specific posting and replay semantics before the active workspace can claim broader direct TigerBeetle coverage.

## TigerBeetle-to-middleware mapping refresh

The broader `/home/ubuntu` sweep reinforces the earlier audit artifacts rather than overturning them. TigerBeetle still appears as a concentrated ledger-core dependency, while Kafka, Redis, Postgres, Temporal, and Lakehouse retain much wider footprint across the recovered platform. The sample co-reference hits continue to show the same pattern: TigerBeetle is strongest in ledger, reconciliation, virtual-account, billing, mortgage, education-loan, and trade-finance contexts, while many surrounding services rely on adjacent middleware layers without proving universal direct ledger posting.

For backlog purposes, this means the active project should continue treating TigerBeetle as the financial spine inside a broader middleware mesh. Kafka publication, workflow progression, authorization, cache invalidation, and analytics/reporting need to be normalized around ledger outcomes rather than assuming every service will become directly TigerBeetle-native in the short term.

## Role-based interface audit refresh

The root banking shell already contains a meaningful persona model, but the current implementation is still closer to role-aware filtering than to hard access control. `Home.tsx` keeps an `activeRole` switcher in local state, reloads auth context and role-shaped datasets when that value changes, and filters `platformProducts` against `authContext.visibleDomains`. However, the primary persona buttons remain openly clickable in the UI, and major shared-shell quick actions and embedded-route entry points are still rendered as generic controls rather than being consistently disabled, hidden, or downgraded according to branch, treasury, compliance, and operations scope.

This makes the next role-based hardening target clear: enforce persona-aware restrictions in the shared shell itself before polishing deeper route-level behaviors. The highest-impact seams are the root role switcher, quick-action rails, embedded-domain entry surfaces, and any domain cards or exports that currently depend only on post-load filtering instead of explicit role-aware affordances.
