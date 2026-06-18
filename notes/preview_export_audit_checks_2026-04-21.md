# Export and Audit Preview Checks — 2026-04-21

## Route checks completed

| Route | Result | Notes |
| --- | --- | --- |
| `/disputes` | Pass | The shared evidence rail renders the new four-card summary band: Audit coverage, Signed delivery, Retention entries, and Export history. The retention and delivery trail subsection is present below the export package list. Empty-state copy renders cleanly with no layout breakage. |
| `/ledger-sync` | Partial pass | The bespoke ledger-control workspace renders the new export controls, evidence summary cards, discrepancy queue, export package section, and retention and delivery trail. The route remains in a restricted empty state for the active persona and currently shows no audit or export records in preview. |

## Observations

The shared DomainWorkspace enhancement is visible in preview and appears structurally correct on the disputes route. The bespoke ledger-sync rewrite is also structurally present, including its export and audit-trail controls, but the live preview currently exposes the expected permission-restricted message for `ledger-reconciliation` and therefore does not yet show populated evidence rows under the default runtime persona.

| `/trade-finance` | Pass | The shared evidence rail renders the new four summary cards and the retention and delivery trail subsection. Empty-state evidence messaging is intact and the route layout remains stable. |
| `/agricultural-insurance` | Pass (archive subtree) | The archive agriculture route continues to render its portfolio and retained-evidence surfaces cleanly after the shared export/audit enhancement batch. No obvious layout regression was introduced in the broader agriculture subtree. |

## Additional preview notes

The trade-finance route confirms that the shared DomainWorkspace enhancement propagates beyond disputes with the expected four-card audit/export summary treatment. The agriculture subtree remained visually stable in preview; however, the visible page at `/agricultural-insurance` resolves through the archive agriculture control plane rather than the routed banking evidence rail, so this check only confirms there was no collateral regression in that surface.

## Middleware endpoint visibility batch

A first preview pass against the control-center homepage confirmed that the dashboard still loads cleanly after adding the new middleware endpoint and history surfaces. The initial viewport showed no regression in the dashboard shell, but the newly added endpoint section sits below the fold and was not visible in the first screenshot. A keyword lookup for `Live default endpoints` from the initial page state did not find the text in the currently extracted markdown, so a deeper scroll-based verification remains advisable before closing this newer batch.

A follow-up preview check clarified that the newly added middleware endpoint visibility work belongs on `/control-center`, not the root dashboard route. The control-center page loaded successfully with the banking workbench hero, integrated module controls, export controls, and deep scroll length intact, which indicates the new additions did not break route rendering. Because the page is long and the new middleware endpoint cards sit further below the initial viewport, a more targeted keyword or scroll verification on `/control-center` is still the cleanest way to confirm the exact new section in-browser.

A targeted keyword check on `/control-center` confirmed that the new `Live default endpoints` section is present in the live route content, alongside the `Middleware-facing runtime coordinates` heading. This verifies that the newly added middleware endpoint cards were deployed to the intended banking workbench route without preventing the rest of the page from rendering.

## TigerBeetle posting seam metadata batch

A targeted preview check on `/control-center` confirmed that the newly wired quick actions are active as route-backed links for the permitted roles, rather than inert buttons. Selecting the ERPNext integrated module card also updated the integrated module detail panel correctly, which verifies that the selection flow and the new ledger-adjacent contract rendering path remain intact after the latest Home.tsx changes. A deeper below-the-fold read of the posting-seam card copy is still advisable if I want explicit visual confirmation of the new `Recommended posting seams` and `Downstream sinks` labels in the rendered detail panel.

A follow-up keyword check on the selected ERPNext module confirmed that the new `Recommended posting seams` section is present in the live control-center route content, with `post-reconciliation accounting confirmation` visible as rendered copy. This gives direct browser evidence that the latest ledger outcome contract extension is not only typed and tested, but also exposed in the operator-facing integrated module detail panel.

## Bank management export wiring batch

A live preview check on `/banks` confirmed that the restored bank-management export controls are now connected to the active platform export flow instead of only generating page-local payloads. Triggering `Excel CSV` produced the message `Tenant management export is now available through the active export inventory.`, the visibility panel updated from `Archive exports 0` to `Archive exports 1`, and a new `Download package` link appeared from the active export inventory on the same page.

## Archive-admin management action wiring batch

A live preview check on `/billing` confirmed that the restored commercial follow-through cards now expose a real operator-action advance control instead of a read-only status badge. Clicking `Mark Done` on `Approve billing evidence package` updated the page in place, surfaced the confirmation message `Approve billing evidence package moved to Done.`, and changed the rendered status chip from `In progress` to `Done`, which verifies that the archive-admin surface is now reusing the active platform action-update flow.

## Customer transfers archive-layout parity pass

A live preview check on `/customer/transfers` confirmed that the updated customer transfer screen now follows the recovered archive rhythm more closely: the transfer shell sits directly beneath the colored header, the recent-transfers section renders as a separate archive-style list with directional icons and row dividers, and the active lifecycle metadata remains visible through status chips and live transfer amounts. The current remaining divergence is mainly the extra tenant-governance and approval-tracker layer that intentionally preserves active platform behavior.

## Customer dashboard archive-style parity pass

A live preview check on `/customer/dashboard` confirmed that the dashboard now renders a more archive-like quick-actions shell and promo banner after the latest parity pass. The quick-actions card is visibly simplified, the branding pill remains tenant-aware without dominating the section, and the promotional strip now reads much closer to the recovered cashback treatment while still preserving active tenant runtime details and navigation.

## Customer bills mobile-first parity pass

A live preview check on `/customer/bills` confirmed that the first bills parity pass now renders as a simpler mobile-first payment flow. The page header and primary confirmation copy are trimmed closer to the recovered mobile rhythm, while the active runtime still preserves compatible live layers below the primary form, including saved billers and recent payment history. The page continued to load and render correctly after the refactor, including category controls, biller selection, customer-reference entry, payment-mode buttons, and the lower enhancement sections.

## Customer cards archive-style parity pass

A live preview check on `/customer/cards` confirmed that the latest cards parity pass renders a simpler archive-inspired shell while keeping the compatible live servicing layers intact. The page now presents a cleaner header, tighter quick-actions rhythm, and more restrained framing around the control sections, while the active runtime still preserves search, live card controls, settings, and retained event-history behavior.

## Customer statements mobile-first parity pass

A live preview check on `/customer/statements` confirmed that the latest statements parity pass now reads as a more mobile-first history flow. The primary header and history-controls copy are simpler, the export section is framed as a secondary compatible enhancement rather than the dominant narrative, and the page still preserves the active runtime behavior for filtering, export readiness tracking, and transaction-history visibility.

## Farmers agriculture archive-faithful restoration pass

A live preview check on `/agriculture/farmers` confirmed that the latest restoration pass now renders a more distinct farmer portfolio supervision body rather than the older generic supervisory template. The page shows the new farmer servicing board, farmer portfolio anchors, outreach and support signals, and season continuity packs above the fold, which materially strengthens the agriculture subtree’s archive-first identity while preserving the compatible active-platform workflow, audit, and export evidence.

## Agri Loans agriculture archive-faithful restoration pass

A live preview check on `/agriculture/loans` confirmed that the second agriculture restoration pass now renders a more distinct seasonal credit desk instead of the previous generic supervisory shell. The page shows the new seasonal credit pipeline, escalation watchlist, desk exposure posture, and signed review pack framing above the fold, which gives the agriculture lending route a clearer archive-first identity while preserving the compatible active workflow and audit evidence.

## Risk Alerts agriculture archive-faithful restoration pass

A live preview check on `/agriculture/risk` confirmed that the latest restoration pass now renders a more distinct agriculture exception desk instead of the earlier generic alert summary. The page shows the new exception queue, repair and review watchlist, route control posture, and signed evidence pack framing, which materially strengthens the agriculture subtree’s archive-first identity while preserving the compatible active workflow and evidence rails.

## Value Chain agriculture archive-faithful restoration pass

A live preview check on `/agriculture/value-chain` confirmed that the latest restoration pass now renders a clearer coordination desk instead of the earlier generic operating template. The page shows the new route posture summary, connected product surfaces, servicing and settlement desk, counterparty control signals, and retained evidence framing, which strengthens the agriculture subtree’s archive-first supervision model while preserving the compatible active workflow and evidence rails.

## Agriculture restoration batch preview recheck

A follow-up live preview recheck on `/agriculture/value-chain` confirmed that the restored coordination-desk structure still renders cleanly after the latest validation rerun, including the posture metrics, connected product surfaces, servicing and settlement workflows, counterparty control signals, and retained evidence packs. A parallel recheck on `/agriculture/risk` confirmed that the restored supervisory exception-desk structure also remains stable in preview, with the exception queue, repair-and-review watchlist, route control posture, and signed evidence packs all visible. Together with the verified route table mapping for both `/agriculture/regulatory` and `/agriculture/compliance`, this preview pass supports closing the compliance-alias backlog item and proceeding toward checkpointing the currently validated agriculture batch.

## AgTech and Agri Analytics archive-first follow-up

A live preview check on `/agriculture/agtech` confirmed that the rewritten route now renders as a more distinct technology coordination desk rather than the earlier lighter template structure. The page shows the new route-posture rail, connected rollout rails, field enablement queue, integration drift watchlist, and retained rollout evidence, all bound to the compatible active overview, workflow, audit, and export adapters.

A parallel live preview check on `/agriculture/analytics` confirmed that the route now renders as a reporting and review desk rather than the earlier sparse metric strip. The page shows the new route-posture rail, workflow-mix bars, route review desk, route coverage section, and export-readiness panel, with no blocking runtime issue observed during the preview pass.

## Customer bills parsing recheck

A fresh live preview check on `/customer/bills` confirmed that the page currently loads and renders cleanly, including the paused-module banner, category tiles, biller selector, customer-reference and amount inputs, confirmation rail, saved billers, recent-payment history, and bottom navigation. The previously noted parsing concern does not reproduce in the active preview, which strengthens the interpretation that the remaining issue is stale watcher noise rather than a live route failure.

## Compliance supervisory-desk follow-up

A live preview check on `/agriculture/regulatory` confirmed that the rewritten compliance route now renders as a tighter supervisory desk with the new route-posture rail, supervisory review queue, control watchlist, retained evidence posture, and routing-note framing. A parallel check on `/agriculture/compliance` confirmed that the alias path still resolves to the same upgraded page without a regression, so the more guessable compliance route remains aligned with the archive-native regulatory destination.

## Farmers and Agri Loans data-fidelity follow-up

A fresh live preview check on `/agriculture/farmers` confirmed that the tightened farmers filters now surface a fuller supervision mix, including a larger servicing board with trade-finance, agricultural-insurance, and agent-settlement records, along with a two-pack continuity rail. A parallel check on `/agriculture/loans` confirmed that the lending desk now pulls a denser seasonal credit pipeline with trade-finance collateral, agricultural-insurance origination, and the seasonal crop loan review in one route, while keeping the page stable after the latest filter pass.

## Agriculture overview data-fidelity follow-up

A fresh live preview check on `/agriculture` confirmed that the tightened overview filters now produce a more agriculture-shaped root route, with the product surface, workflow pressure, service posture, and retained evidence sections pulling a clearer mix of agricultural insurance, trade-finance, agent-settlement, and seasonal crop-loan-adjacent records. The page remained stable in preview after the latest root-route filter pass.

## Usage Analytics admin-route follow-up

A fresh live preview check on `/usage-analytics` confirmed that the tightened analytics route now shows a more specific runtime mix, including customer operations, trade finance, dispute management, and ERPNext sync in the posture panel, the usage analytics snapshot plus billing evidence in the operations rail, and the retained analytics drift audit entry. The updated route rendered cleanly after the latest admin-module filter pass.

## Alerts admin-route follow-up

A fresh live preview check on `/alerts` confirmed that the tightened alert desk now surfaces a fuller operational mix, including the escalated alert backlog, analytics drift, billing evidence, ledger variance, and customer-control continuity in one routed alert surface, while keeping the response rail and retained export handoff stable after the latest admin-module filter pass.

## Billing admin-route follow-up

A fresh live preview check on `/billing` confirmed that the tightened billing control room now keeps billing settlement readiness, usage analytics evidence, customer-control continuity, and the commercial billing approval action in one runtime-backed surface. The updated route rendered cleanly after the latest billing-specific filter pass.

## Customer Loans parity follow-up

A fresh live preview check on `/customer/loans` confirmed that the rewritten screen now presents the archive-style tab split, eligibility card, and product-list rhythm instead of the earlier generic lending board. A follow-up filter pass removed the obvious teller-operations mismatch, but the latest recheck still shows broad runtime-adjacent items such as dispute management and merchant settlement analytics in the visible product rail. The route remains structurally stable in preview, but the lending-specific product mix still needs tighter curation before the loans-parity work can be treated as complete.

## Customer Loans final lending recheck

A fresh production build resolved the earlier preview-compilation mismatch on `/customer/loans`. The final preview recheck now shows only two lending-relevant products—Trade finance and Seasonal crop loan service review—and confirms that the temporary build marker used for debugging was removed after the cleanup build.

## Customer savings archive-compatible parity pass

A live preview check on `/customer/savings` confirmed that the refreshed savings page now renders with a tighter archive-compatible mobile rhythm. The route shows the updated reserve hero, paired saved-posture and workflow-pressure cards, runtime-backed savings goals, contribution-signal rows, and top-contributor section, while keeping all visible amounts grounded in the active dataset. The page remained stable after TypeScript, production build, smoke, and Vitest validation.

## Customer Statements archive-mobile follow-up

A fresh live preview check on `/customer/statements` confirmed that the updated page now foregrounds archive-style statement generation rather than leading with the heavier export registry. The refreshed screen exposes period chips for the last 7, 30, 90, and 365 days, format toggles for CSV and Excel, and mobile-friendly quick actions for generating, emailing, and scheduling statements while preserving the active runtime search, filters, retained export lifecycle, and recent activity feed. This keeps the active implementation materially closer to the recovered mobile statements reference without dropping the current governance-aware data rails.

## Customer Settings archive-mobile follow-up

A fresh live preview check on `/customer/settings` confirmed that the rewritten page now follows a clearer archive-style settings rhythm: a centered profile header leads into grouped **Account**, **Security**, **Notifications**, and **Support** sections with simple menu rows closer to the recovered mobile settings screen. The active implementation still preserves runtime-backed customer switching, tenant posture, notification visibility, and session details as compatible enhancements below the archive-shaped menu structure.

## Customer Transfers governance-copy tightening recheck

A fresh post-build preview check on `/customer/transfers?transfer_parity_recheck=20260421_1822` confirmed that the active transfer screen now presents a lighter archive-compatible servicing overlay. The earlier large transfer-disable warning was reduced to the shorter `Transfers are temporarily paused` note, the tenant framing now appears as a compact `Runtime note`, and the approval section is labeled more narrowly as `Approval activity`. The route still preserves the required live OTP, approval, and workflow servicing layers, but the visible first-screen rhythm is closer to the recovered mobile transfer baseline than in the previous pass.
