/* The screen between choosing a Session and sitting it (ISSUE-0053).
 *
 * Its own feature rather than a folder under `session-setup`, for the reason
 * `dictation` is one: this screen needs the dictation engine, and
 * `eslint.config.js` forbids reaching into another feature's files. It is also
 * genuinely a different screen — `/session/new` decides what the Session is,
 * this one gets the browser ready to sit it.
 */
export { InterviewSetupScreen } from "./InterviewSetupScreen";
export { SetupBody } from "./components/SetupBody";
export type { SetupBodyProps, SetupFacts } from "./components/SetupBody";
export { useInterviewSetup, needsGesture } from "./hooks/useInterviewSetup";
export type { SetupState } from "./hooks/useInterviewSetup";
