import nx from "@nx/eslint-plugin";
import baseConfig from "../../../eslint.config.mjs";

export default [
    ...nx.configs["flat/angular"],
    ...nx.configs["flat/angular-template"],
    ...baseConfig,
    {
        files: [
            "**/*.json"
        ],
        rules: {
            "@nx/dependency-checks": [
                "error",
                {
                    ignoredFiles: [
                        "{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}"
                    ]
                }
            ]
        },
        languageOptions: {
            parser: await import("jsonc-eslint-parser")
        }
    },
    {
        files: [
            "**/*.ts"
        ],
        rules: {
            "@angular-eslint/directive-selector": [
                "error",
                {
                    type: "attribute",
                    // "lib" is the library's general prefix; "mobile" is reserved specifically for
                    // gesture/behavior directives under directives/ that originated as native-shell
                    // infrastructure (mobileSwipe, mobileLongPress, …) — see directives/*.ts.
                    prefix: ["lib", "mobile"],
                    style: "camelCase"
                }
            ],
            "@angular-eslint/component-selector": [
                "error",
                {
                    type: "element",
                    // "lib" is the library's general prefix (every generic/platform-agnostic
                    // component). "mobile" is reserved for layouts/mobile/* — components that are
                    // specifically the native-shell chrome (bottom tabs, FAB, top app bar, bottom
                    // sheet host's own <mobile-shell> root, …), so their tag name signals that
                    // platform-specific role even though they live in this one unified library.
                    prefix: ["lib", "mobile"],
                    style: "kebab-case"
                }
            ]
        }
    },
    {
        files: [
            "**/*.html"
        ],
        // Override or add rules here
        rules: {}
    }
];
