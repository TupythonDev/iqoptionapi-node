/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // semantic-release commits CHANGELOG URLs that exceed 100 chars
    'body-max-line-length': [0],
  },
};
