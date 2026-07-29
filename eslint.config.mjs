import nx from "@nx/eslint-plugin";

export default [
    ...nx.configs["flat/base"],
    ...nx.configs["flat/typescript"],
    ...nx.configs["flat/javascript"],
    {
        ignores: [
            "**/dist",
            "**/out-tsc",
            // Capacitor native shells (apps/*/android, apps/*/ios) contain copied/generated web
            // build output (apps/*/ios/**/public/*.js etc.) and native project scaffolding —
            // neither is source code this workspace owns the style of.
            "**/android",
            "**/ios"
        ]
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.js",
            "**/*.jsx"
        ],
        rules: {
            // Sprint 1.1 — Enterprise Nx Module Boundary Enforcement.
            //
            // Two independent tag dimensions, both enforced simultaneously (Nx ANDs every
            // depConstraints entry whose sourceTag matches one of the source project's own tags):
            //
            //   type:*  — architectural layer (app / feature / ui / core / auth / auth-ui / sdk / models)
            //   scope:* — which app's domain a project belongs to (customer / restaurant / delivery /
            //             admin / shared) — prevents e.g. a restaurant-app feature from importing a
            //             delivery-app feature even though both are `type:feature`.
            //
            // Layering is strictly downward (app -> feature -> auth-ui -> {ui, core, auth} -> sdk/models)
            // with no rule ever pointing back up, which structurally rules out cycles between layers.
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    enforceBuildableLibDependency: true,
                    allow: [
                        "^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$"
                    ],
                    depConstraints: [
                        // --- type:* (architectural layer) ---
                        {
                            sourceTag: "type:app",
                            onlyDependOnLibsWithTags: [
                                "type:feature", "type:ui", "type:core", "type:auth",
                                "type:auth-ui", "type:sdk", "type:models"
                            ]
                        },
                        {
                            sourceTag: "type:feature",
                            onlyDependOnLibsWithTags: [
                                "type:feature", "type:ui", "type:core", "type:auth",
                                "type:auth-ui", "type:sdk", "type:models"
                            ]
                        },
                        {
                            sourceTag: "type:auth-ui",
                            onlyDependOnLibsWithTags: [
                                "type:auth-ui", "type:ui", "type:auth", "type:core", "type:sdk", "type:models"
                            ]
                        },
                        {
                            // shared/ui must not depend on feature libraries or the SDK. `type:core` is
                            // permitted (not forbidden by the brief) since `map-picker` (also `type:ui`)
                            // legitimately needs `APP_ENVIRONMENT` from core; `libs/shared/ui` itself has
                            // zero cross-lib imports today, so this stays a no-op for it in practice.
                            sourceTag: "type:ui",
                            onlyDependOnLibsWithTags: ["type:ui", "type:core"]
                        },
                        {
                            // shared/core must not depend on feature libraries.
                            sourceTag: "type:core",
                            onlyDependOnLibsWithTags: ["type:core", "type:auth", "type:sdk", "type:models"]
                        },
                        {
                            sourceTag: "type:auth",
                            onlyDependOnLibsWithTags: ["type:auth", "type:sdk", "type:models"]
                        },
                        {
                            // SDK must remain independent.
                            sourceTag: "type:sdk",
                            onlyDependOnLibsWithTags: ["type:sdk"]
                        },
                        {
                            sourceTag: "type:models",
                            onlyDependOnLibsWithTags: ["type:models"]
                        },

                        // --- scope:* (app-domain ownership) ---
                        {
                            sourceTag: "scope:customer",
                            onlyDependOnLibsWithTags: ["scope:customer", "scope:shared"]
                        },
                        {
                            sourceTag: "scope:restaurant",
                            onlyDependOnLibsWithTags: ["scope:restaurant", "scope:shared"]
                        },
                        {
                            sourceTag: "scope:delivery",
                            onlyDependOnLibsWithTags: ["scope:delivery", "scope:shared"]
                        },
                        {
                            sourceTag: "scope:admin",
                            onlyDependOnLibsWithTags: ["scope:admin", "scope:shared"]
                        },
                        {
                            // Shared libraries may only depend on other shared libraries — never on a
                            // single app's feature libraries — which independently re-enforces "shared/core
                            // must not depend on feature libraries" (and the same for shared/ui/auth/sdk).
                            sourceTag: "scope:shared",
                            onlyDependOnLibsWithTags: ["scope:shared"]
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.cts",
            "**/*.mts",
            "**/*.js",
            "**/*.jsx",
            "**/*.cjs",
            "**/*.mjs"
        ],
        // Override or add rules here
        rules: {}
    }
];
