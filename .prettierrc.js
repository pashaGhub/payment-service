/** @type {import('prettier').Config} */
module.exports = {
    // Sorts imports and drops unused ones via the TS language service.
    // Must be last if other plugins are added later.
    plugins: ['prettier-plugin-organize-imports'],

    semi: true,
    singleQuote: true,
    trailingComma: 'all',
    tabWidth: 4,
    printWidth: 180,
    arrowParens: 'always',
    overrides: [
        {
            files: ['*.json', '*.jsonc', '*.md', '*.yml', '*.yaml'],
            options: {
                tabWidth: 2,
            },
        },
    ],
};
