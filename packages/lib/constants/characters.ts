/** Matches all special characters not present on a standard US keyboard. */
export const SPECIAL_CHAR_REGEXP =
  /[^a-zA-Z0-9\t\n .\/,<>?;:"'`!@#$%^&*()\[\]{}_+=|\\-]+/g;

export const USERNAME_REGEXP = /^[a-zA-Z0-9_-]+$/;
export const USERNAME_REPLACE_REGEXP = /[^a-zA-Z0-9_-]+/g;

export const QUIZLET_IMPORT_REGEXP =
  /^https:\/\/(?:www\.)?quizlet\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?[0-9]+(?:\/[a-zA-Z0-9_-]+){0,2}\/?$/;
