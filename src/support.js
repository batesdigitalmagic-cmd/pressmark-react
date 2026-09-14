/*
 * The support chat's shared facts.
 *
 * Read by the page and by the server (lib/chat/chat.js), so the topics a
 * visitor can pick are exactly the ones the server accepts.
 *
 * There is deliberately no phone number here. Messages reach the studio's
 * phone through the server, which holds the number in an environment variable;
 * nothing on the site reveals it.
 */

/* What people can ask about. The chosen topic heads the first text the studio
   receives, so it knows what the conversation is for before reading on. */
export const SUPPORT_TOPICS = ["InDesign automation", "Data merge", "Microsoft Publisher"];

export const CHAT_ENDPOINT = "/api/chat/messages";

/* Where the visitor's conversation id is kept, so a reload or another page on
   the site picks the same chat back up. */
export const CHAT_STORAGE_KEY = "pressmark.chat";

export const MAX_MESSAGE_LENGTH = 1000;
