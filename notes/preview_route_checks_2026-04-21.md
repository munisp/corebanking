# Preview Route Checks — 2026-04-21

## Root route `/`

The live preview root renders the admin dashboard inside the archive sidebar. The sidebar now visibly includes the newly added banking workspace links for Control Center, Operations Center, Teller Ops, Trade Finance, Disputes, Ledger Sync, ERPNext Sync, Identity & Channels, Islamic Banking, and Agri Insurance.

## Control Center route `/control-center`

The live preview route loads successfully and now renders the workbench content without leaving the main application. The page content confirms the integration direction: it explicitly describes teller, ERPNext, Islamic banking, trade, disputes, insurance, and ledger control inside one operating frame. The route is reachable from the sidebar and displays the integrated workbench content in the preview.

## Operations route `/operations`

The operations workspace loads successfully in the live preview and exposes the routed product-shell catalog for customer operations, teller operations, Islamic banking, trade finance, agricultural insurance, dispute management, ERPNext sync, and ledger reconciliation. The page confirms that the restored banking domains are reachable as first-class destinations and shows the shared service-health rail inside the preview.

## Teller route `/teller`

The teller workspace loads successfully in the live preview and exposes its teller-service and reconciliation posture inside the shared product shell. The page shows the expected empty-state treatment for sessions and recent cash movements while keeping the routed workspace reachable from the integrated shell.

## Trade finance route `/trade-finance`

The trade-finance workspace loads successfully in the live preview and keeps its operator action rail, export controls, and routed domain metadata visible inside the shared product shell. This confirms that the route remains reachable and continues to expose shared operational evidence rather than dropping back to a detached descriptive page.

## Disputes route `/disputes`

The disputes workspace loads successfully in the live preview and keeps its resolution controls, routed domain metadata, and shared operational evidence rail visible inside the integrated product shell. The route remains reachable as a first-class workspace destination.

## Ledger sync route `/ledger-sync`

The ledger-sync workspace loads successfully in the live preview and shows the expected reconciliation empty-state behavior while still rendering inside the shared product shell. The route confirms that ledger parity visibility is reachable from the integrated workspace navigation even when live sync data has not yet arrived.

## ERPNext sync route `/erpnext-sync`

The ERPNext sync workspace loads successfully in the live preview and shows the intended empty-state behavior for tenant configuration, document mappings, and outbound sync history while remaining embedded in the shared product shell.

## Identity and channels route `/identity-channels`

The identity and channels workspace loads successfully in the live preview and exposes both auth-context visibility and USSD dependency posture inside the shared product shell. The route remains reachable as an explicit operator-facing destination rather than a hidden infrastructure concern.

## Islamic banking route `/islamic-banking`

The Islamic banking workspace loads successfully in the live preview while keeping both the archive sidebar and the routed product-shell content visible at the same time. This confirms that the route is now embedded inside the broader admin shell rather than appearing as a detached destination.

## Agricultural insurance route `/agricultural-insurance`

The agricultural insurance route loads successfully in the live preview while preserving the archive sidebar shell and exposing the agriculture control-plane content. This confirms that the route remains reachable from the integrated navigation and does not break the embedded archive-style experience.

## Shared DomainWorkspace live-summary verification

### Trade finance route `/trade-finance`

The updated trade-finance workspace now renders the new "Live rail summary" block with runtime-backed values for open actions, audit events, ready exports, and service posture. The operator control rail and action buttons remain visible and functional inside the embedded admin shell.

### Disputes route `/disputes`

The updated disputes workspace also renders the new "Live rail summary" block and correctly reflects a different action state from the shared platform rail. The runtime-backed summary enhancement therefore works across at least two separate DomainWorkspace consumers inside the embedded shell.

## Operations workbench search-and-detail verification

The live `/operations` preview now exposes a visible search control inside the product-domain header and a selected-workspace detail rail below the routed banking cards. The default selected workspace surfaced the customer-operations route, category, status, and service-dependency chips, confirming that routed destinations are now discoverable through both filtering and an explicit detail surface rather than only through static cards.

## Control Center role-aware shell verification

The live `/control-center` preview continues to load inside the embedded admin shell after the role-based access-control pass. The hero rail still renders cleanly, the persona switcher remains visible, the quick-action cards now carry role-specific explanatory copy, and the export control remains present without breaking the surrounding shell layout. The integrated module CTA, customer-registry CTA, sidebar navigation, and selected-domain action rail also remain intact, confirming that the shared-shell restriction changes did not disrupt the routed banking experience.

## Routed workspace role-aware verification

### Trade finance route `/trade-finance`

The live trade-finance workspace still renders correctly after the shared DomainWorkspace access-control update. The routed shell, operator control rail, export controls, and evidence rail remain visible, and the route continues to load inside the embedded admin navigation without layout regressions. This confirms that the new persona-aware gating changes did not break a routed DomainWorkspace consumer while preserving the operational rail structure needed for the next multi-persona restriction checks.

### Multi-persona control-center verification

On `/control-center`, switching from the default role to **Branch operations** updated the active-role card and preserved branch-facing actions such as customer-profile servicing while keeping the shell intact. Switching again to **Treasury and ledger control** updated the role summary, visible-domain tiles, and control rail text, and surfaced multiple `Workflow access restricted` action states in place of unrestricted workflow buttons. Together with the separate routed `/trade-finance` check, this confirms that persona-aware gating now changes visible behavior across multiple personas while the routed banking experience remains reachable.
