# JARVIS

JARVIS is a modular desktop assistant built with Tauri, React, and TypeScript. The first version is shaped around real daily-use actions like launching app routines, opening websites, routing Google searches, and growing into calendar, weather, and memory skills.

## Stack

- Tauri
- React
- TypeScript
- Vite

## Planned V1 skills

- Study and work app launchers
- Website opening and Google search routing
- External notes through Notion
- Calendar event capture
- Time and weather utilities
- Expandable module system for future skills

## Skill Roadmap

The next five practical JARVIS skills are:

1. Notion notes
2. Calendar event creation
3. Task and reminder capture
4. File search and recent file opening
5. Spotify playback control

## First implemented flow

The first end-to-end skill is `Open my study apps`.

How it works:

1. The command input in the React app captures your text.
2. A tiny command router in `src/App.tsx` checks whether the command matches the study routine.
3. The frontend calls the Tauri command `launch_study_setup`.
4. Rust runs the Windows launcher routine and opens the configured targets.

The current study setup opens:

- Google Calendar
- Google Docs
- VS Code
- File Explorer

## Memory foundation

JARVIS now has a first local memory layer backed by SQLite.

Current stored data:

- `routines`
- `routine_steps`
- `action_history`

Current behavior:

1. The app initializes a local `jarvis.db` file in the Tauri app data directory.
2. A default `Study Setup` routine is seeded into the database.
3. When you run `Open my study apps`, JARVIS executes the routine and logs the action into history.
4. The React UI loads stored routines and recent history so you can see what the assistant currently remembers.

## Draft learning flow

JARVIS can now draft routine proposals from repeated behavior without activating them automatically.

Current proposal behavior:

1. JARVIS checks repeated `launch_study_setup` history entries.
2. If enough evidence exists, it creates a `pending_review` proposal.
3. The proposal appears in the UI with a reason summary and confidence score.
4. You can approve or reject it.
5. Approval converts the draft into a live routine. Rejection keeps it as a reviewed suggestion.

## Voice V1

JARVIS now includes a first push-to-talk voice path in the React app.

Current voice behavior:

1. The mic button starts browser or webview speech recognition when available.
2. Interim and final transcripts are copied into the command box.
3. Final voice transcripts can be routed through the same command flow as typed input.

Current limitation:

- This first version uses browser speech recognition for speed and learning value.
- A future version should replace it with a local assistant-grade engine such as `whisper.cpp`.

## Voice V2

JARVIS can now speak short responses back through browser speech synthesis.

Current voice-response behavior:

1. JARVIS can speak command confirmations and proposal review outcomes.
2. Voice replies can be toggled on or off in the command area.
3. This currently uses browser or webview speech synthesis for fast iteration.

Current limitation:

- A future version should replace browser speech synthesis with a local TTS engine such as `Kokoro` or `Piper`.

## Voice Preferences V1

JARVIS can now remember a preferred spoken reply style.

Current behavior:

1. Save a voice reply mode locally as `quiet`, `brief`, `normal`, or `detailed`.
2. Switch modes by voice or from the command area.
3. Apply the saved mode across future spoken replies.

Supported examples:

- `Use quiet mode`
- `Be brief`
- `Use normal mode`
- `Be more detailed`
- `What's my voice mode`

## Birthdays / People Memory V1

JARVIS can now remember people and birthdays locally, and it can pull birthday candidates from loaded Gmail messages.

Current behavior:

1. Save a birthday directly by voice.
2. Look up saved birthdays and sort upcoming ones.
3. Extract clear birthday patterns from the current email, a numbered email, a topic-matched email, or the loaded inbox list.

Supported examples:

- `Remember that Sarah's birthday is June 14`
- `Did I save Rahul's birthday`
- `Show birthdays`
- `Show upcoming birthdays`
- `Save birthdays from this email`
- `Save birthdays from email 2`
- `Save birthdays from loaded emails`

## Travel Extraction V1

JARVIS can now pull travel details from Gmail and save a travel summary to Notion.

Current behavior:

1. Extract travel details from the current email, a numbered email, or a topic-matched email.
2. Pull likely transport, hotel, booking, date, address, and confirmation-code details.
3. Save the travel summary to Notion when asked.
4. Keep a lightweight local travel memory for recent extracted trips.

Supported examples:

- `Extract travel from this email`
- `Analyze email 2 for travel`
- `Extract travel from the email about flight`
- `Save this travel to Notion`
- `Save travel from email 2 to Notion`
- `Show travel memory`

## Expense Capture V1

JARVIS can now pull receipt and invoice-style details from Gmail and save an expense summary to Notion.

Current behavior:

1. Extract expense details from the current email, a numbered email, or a topic-matched email.
2. Pull likely merchants, amounts, dates, order numbers, and receipt notes.
3. Save the expense summary to Notion when asked.
4. Keep a lightweight local expense memory for recent extracted expenses.

Supported examples:

- `Extract expense from this email`
- `Analyze email 2 for expenses`
- `Extract expense from the email about receipt`
- `Save this expense to Notion`
- `Save expense from email 2 to Notion`
- `Show expense memory`

## Package Tracking V1

JARVIS can now pull shipping and delivery-style details from Gmail and save a package summary to Notion.

Current behavior:

1. Extract package details from the current email, a numbered email, or a topic-matched email.
2. Pull likely carriers, delivery statuses, delivery dates, tracking numbers, and package notes.
3. Save the package summary to Notion when asked.
4. Keep a lightweight local package memory for recent extracted shipments.

Supported examples:

- `Extract package from this email`
- `Analyze email 2 for package`
- `Extract package from the email about shipped`
- `Save this package to Notion`
- `Save package from email 2 to Notion`
- `Show package memory`

## Meeting Prep V1

JARVIS can now build a meeting prep summary from today's Google Calendar events and related Gmail/Notion context.

Current behavior:

1. Match a meeting from today's connected Google Calendar events.
2. Pull related loaded emails, notes, and tasks using the event title.
3. Show the prep summary in-app or save it to Notion.
4. Keep a lightweight local meeting-prep memory for recent prep runs.

Supported examples:

- `Prepare me for my 3 PM meeting`
- `Prepare me for interview`
- `Summarize what I need before team sync`
- `Make a prep note for interview`
- `Show meeting prep memory`

## School Mode V1

JARVIS can now build a school-focused study plan from your loaded PDFs, school-like tasks, and deadline-heavy emails.

Current behavior:

1. Scan loaded PDFs, tasks, and recent Gmail context for school-related signals.
2. Build a focused study plan with suggested next moves.
3. Show the plan in-app or save it to Notion.
4. Keep a lightweight local school-plan memory for recent study-planning runs.

Supported examples:

- `Start school mode`
- `What should I study today`
- `Save school mode to Notion`
- `Show school memory`

## Voice V3

JARVIS now has a first voice-learning layer for transcript corrections.

Current voice-learning behavior:

1. You can correct the last heard phrase in the UI.
2. JARVIS stores the correction locally in SQLite.
3. Future matching transcripts are normalized through the saved correction before routing.

Current limitation:

- This first correction layer uses exact phrase matching.
- A future version should support fuzzy correction matching and pronunciation-aware normalization.

## Voice V4

JARVIS now includes a lighter voice-session flow for faster command handling.

Current Voice V4 behavior:

1. Voice sessions expose clearer states such as `listening`, `processing`, and `ready`.
2. Final voice transcripts can be auto-routed through the command system when enabled.
3. The command area now lets you toggle both spoken replies and automatic routing.

Current limitation:

- This is still a browser-recognition-based flow, not a full VAD or local streaming pipeline.

## Local STT Scaffold

JARVIS now includes a voice-backend boundary so browser recognition is no longer the only long-term path.

Current local STT scaffold behavior:

1. The UI can switch between `browser` and `local` voice backends.
2. Tauri exposes a local-backend status command for a future `whisper.cpp` integration.
3. The current local backend is a scaffold only and reports configuration status rather than transcribing audio yet.

## Local STT Integration

JARVIS now includes the first real local transcription path for `whisper.cpp`.

Current local STT behavior:

1. Switch the voice backend to `local`.
2. Enter a `whisper-cli` executable path and a ggml model path.
3. Save the local config.
4. Start local recording, stop it, and let Tauri send the WAV file to `whisper.cpp`.

Current limitation:

- You still need to provide a working `whisper-cli` binary and model file on your machine.
- This first local path uses a temp WAV file and CLI invocation rather than a deeply embedded library integration.

## Local TTS Integration

JARVIS now includes the first local speech-output path for `Piper`.

Current local TTS behavior:

1. Switch speech output to `local`.
2. Enter a `piper.exe` executable path and a Piper voice model path.
3. Save the local speech config.
4. JARVIS can route spoken replies through Piper instead of browser speech synthesis.

Current limitation:

- You still need to provide a working Piper executable and voice model on your machine.
- This first local TTS path generates a WAV file and plays it externally.

## Wake Word V1

JARVIS now includes the first wake-mode architecture layer.

Current Wake Word V1 behavior:

1. You can choose an assistant name.
2. You can save wake mode on or off locally.
3. You can simulate wake activation with a wake button that moves JARVIS into an awakened state and immediately starts listening for the next command.

Current limitation:

- This is a lifecycle and settings layer only.
- A true always-listening wake-word detector still needs to be integrated later.

## Wake Word V2

JARVIS now includes a first hands-free wake flow for browser/webview speech recognition.

Current Wake Word V2 behavior:

1. When wake mode is enabled with the `browser` voice backend, JARVIS can stay armed for your assistant name.
2. Saying the assistant name starts the normal command-listening flow automatically.
3. After a command ends, the wake listener can arm itself again so you do not have to keep pressing push-to-talk.
4. Browser wake now uses a visual cue instead of a spoken `Yes?` acknowledgement, which avoids polluting the next transcript.

Current limitation:

- This first hands-free wake path depends on browser/webview speech recognition.
- Local always-listening wake detection and true speaker verification still need a dedicated wake engine later.

## Wake / Conversation Polish V1

JARVIS now keeps a short follow-up window open after wake, after a spoken reply, and after a clarification prompt.

Current polish behavior:

1. Saying the wake name opens a short direct-listening window instead of dropping back to idle immediately.
2. If JARVIS asks a clarification question, you can answer naturally without waking it again.
3. After a spoken command completes, browser wake mode keeps listening briefly for a follow-up action.
4. The voice status area now tells you when the follow-up window is still open.
5. You can now say `go to sleep` or `stop listening` to disable hands-free wake for the current session, and `shut down` to close the app.
6. You can say `stand by` or `go back to standby` to leave listening mode and return to the armed wake state without turning wake mode off.

Current limitation:

- This follow-up window currently applies to the `browser` voice backend.
- It is still a timed conversational handoff, not a fully continuous streaming conversation loop.

## Personal Language Learning V1

JARVIS now has a first personal phrase-memory layer.

Current learning behavior:

1. After a command succeeds, JARVIS stores the exact phrase you used and the intent it resolved to.
2. On later turns, JARVIS checks that learned phrase memory before falling back to the normal parser.
3. Learned phrase memory stays local in the app database.
4. The UI now shows a small language-memory summary card once phrases have been learned.
5. If a new phrase looks close to an existing learned phrase, JARVIS can suggest reusing that intent and ask for confirmation.

Current limitation:

- This first pass learns exact successful phrasing, not broad semantic intent families yet.
- Intent-family suggestions currently use local phrase similarity, not full semantic embeddings yet.

## Contextual Learning V2

JARVIS now understands a stronger set of context cues and can learn from clarified commands.

Current contextual behavior:

1. Explicit cue phrases like `search ... on google` and `find ... on spotify` are routed more intentionally.
2. Context references like `this email` and `this pdf` now use the currently loaded email/PDF instead of acting like missing skills.
3. When you resolve a clarification successfully, JARVIS can now remember the original phrase that led to that confirmed intent.

Current limitation:

- `this` still depends on currently loaded app context, not arbitrary screen selection.
- Spotify cue phrases currently open Spotify search context; they do not yet guarantee direct playback of a specific track.

## Conversational Memory V3

JARVIS now keeps track of the active email or PDF in the conversation so short follow-ups can reuse it.

Current memory behavior:

1. When you open, read, summarize, or analyze an email or PDF, JARVIS marks it as the current conversation subject.
2. Follow-ups like `open it`, `read it`, `save it to notion`, and `add it to calendar` can now resolve against that active subject.
3. Successful clarified commands can also feed back into the language-learning layer.

Current limitation:

- This first pass mainly tracks active emails and PDFs.
- Broader pronoun chaining for notes, tasks, browser targets, and multi-object references still needs a later pass.

## Conversational Memory V4

JARVIS now extends that short-term conversation memory to notes, planner tasks, browser targets, and recently presented lists.

Current memory behavior:

1. When you open, read, save, or update a note or task, JARVIS can keep that note/task as the active conversation subject.
2. Browser actions now keep an active browser target, so follow-ups like `open it again` can reuse the last opened site or search target.
3. When JARVIS shows emails, PDFs, notes, or tasks, it stores the exact items from that visible list instead of only a count.
4. Follow-ups like `open the first one`, `read the second one`, `save the first one to notion`, and `complete the first one` now resolve against the last shown list.

Current limitation:

- This pass handles `first`, `second`, and `third` style follow-ups only.
- Broader references like `the other one` or `the last one from before` still need a later pass.

## Reference Memory V5

JARVIS now understands a first richer layer of reference language on top of the recent-list memory.

Current reference behavior:

1. Follow-ups like `the last one` can resolve against the most recently shown email, PDF, note, or task list.
2. Follow-ups like `the other one` can switch away from the currently active item to another visible item in that same recent list.
3. Query-style references like `the one about rent` or `the note about calculus` can match the last shown collection by topic.

Current limitation:

- This pass is still grounded in the most recently presented collection, not arbitrary long-term screen memory.
- More complex references like `the email before that` or `the third one from the earlier list` still need a later pass.

## Workflow Chaining V1

JARVIS can now split a single sentence into a short sequence of actions and run them in order.

Current chaining behavior:

1. Commands connected with phrases like `then`, `and then`, or comma-separated action clauses can run as one workflow.
2. Later steps can reuse the context created by earlier steps, so phrases like `save it to notion` or `add it to calendar` can follow an earlier email or PDF action.
3. If a step needs clarification or hits a missing skill, JARVIS pauses the workflow instead of blindly continuing.

Current limitation:

- This first pass focuses on short action chains, not open-ended planning.
- Natural language lists that are not action-shaped yet can still be treated as a single command.

## Workflow Learning V1

JARVIS can now notice repeated chained workflows and offer to save them as reusable triggers.

Current workflow-learning behavior:

1. When the same short multi-step workflow completes successfully multiple times, JARVIS increments a local repeat count for that normalized sequence.
2. After enough repeats, it suggests saving the workflow with an auto-generated name and trigger phrase.
3. Once you approve it, you can run that workflow later just by saying its saved trigger phrase.
4. Saved workflows can now be renamed, re-triggered with a custom phrase, and edited step by step in the UI.
5. Saved workflow steps can now use placeholders like `{{input}}`, `{{current_email}}`, `{{current_pdf}}`, `{{current_note}}`, and `{{current_task}}`.
6. If a saved workflow is missing `{{input}}` or the required current context, JARVIS can pause, ask for what it needs, and continue the workflow after you answer.
7. JARVIS now includes built-in workflow templates and a JSON export/import box for your saved workflow library.
8. Saved workflows can now use simple branching with `if ... then ...` and optional `else ...` clauses, including `stop` branches.
9. JARVIS now includes first batch actions like `save first 10 emails to notion`, `summarize all loaded pdfs`, and `complete all overdue tasks`.

Current limitation:

- This first pass stores workflow memory locally in the frontend layer.
- Workflow editing is currently local UI memory, not a shared/native database layer yet.
- Branching currently supports a small condition set such as `has current pdf`, `no current pdf`, `has current email`, `has emails`, `no emails`, `has notes`, and `has tasks`.

## Browser Voice Actions V1

JARVIS can now route browser-style commands from typed or spoken input.

Current browser action behavior:

1. `Open ...` commands can open websites through the native browser launcher.
2. `Search ...` commands can trigger Google searches.
3. Voice commands use the same command parser as typed input, so wake/listen flows can route browser actions too.

## Auto-Learning V1

JARVIS now includes a first auto-learning layer for browser corrections.

Current auto-learning behavior:

1. You can save a corrected site URL for the current command phrase.
2. JARVIS stores the phrase-to-URL mapping locally.
3. Future `Open ...` commands check learned aliases before falling back to generic URL guessing.
4. Common sites like Google, Gmail, YouTube, Docs, Calendar, Drive, Spotify, Notion, and GitHub now resolve through built-in aliases before generic guessing.
5. Known homepage-style URLs for those services are canonicalized to clean roots so JARVIS does not keep noisy one-time tracking links in memory.

## Natural Conversation V1

JARVIS now has a first conversation layer on top of the command system.

Current conversation behavior:

1. You can phrase supported requests more naturally, like asking for study setup or a Google search in normal language.
2. JARVIS keeps a short visible conversation thread in the UI.
3. If a request is ambiguous, JARVIS can ask a follow-up question before acting.
4. Follow-up replies can resolve those clarifications without restarting the whole command.

Current limitation:

- This is still a heuristic conversation layer, not a full LLM-backed planner.
- The supported natural conversation space currently focuses on study setup, website opening, and Google search actions.

## Ollama Conversation Integration

JARVIS now includes a first model-backed conversation adapter for Ollama.

Current Ollama conversation behavior:

1. You can switch the conversation backend between `heuristics` and `ollama`.
2. JARVIS stores an Ollama base URL and model name locally.
3. When Ollama mode is enabled, JARVIS asks the local model for a structured intent first.
4. The interpreted result still flows through JARVIS's own planner and safe action execution layer.
5. If Ollama is unavailable or does not help, JARVIS can fall back to the built-in heuristic parser.

Current limitation:

- This first integration is an interpreter layer only, not full autonomous planning.
- Ollama must already be installed and serving locally for the model-backed path to work.

## Missing Skill Escalation V1

JARVIS now includes a first approval-based escalation flow for missing skills.

Current missing-skill escalation behavior:

1. If JARVIS understands the request but does not have the skill, it keeps the request as a skill gap instead of dropping it.
2. You can explicitly ask the advanced assistant for a suggested skill plan.

## Notion Notes V1

JARVIS now includes the first external-app skill through Notion.

Current Notion note behavior:

1. You can save a Notion integration token and database ID locally in the app.
2. JARVIS can create a note in the connected Notion database.
3. JARVIS can list recent notes from that database.
4. JARVIS can search note titles in that database.

Supported commands:

- `Make a note to review calculus tonight`
- `Show my notes`
- `Find note about calculus`

## Calendar V1

JARVIS now includes the first external calendar skill through Google Calendar.

Current calendar behavior:

1. JARVIS can parse simple event requests like `Add gym tomorrow at 6 PM to my calendar`.
2. If you connect Google Calendar in the app, JARVIS creates the event directly through the Calendar API.
3. If you are not connected yet, JARVIS falls back to a prefilled Google Calendar event draft in the browser.

Supported commands:

- `Add gym tomorrow at 6 PM to my calendar`
- `Schedule dentist friday at 3 PM`
- `Create an event team sync tomorrow at 10 AM`

## Reminder V1

JARVIS now includes the first reminder-capture flow through Google Calendar drafts.

Current reminder behavior:

1. JARVIS can parse simple reminder requests with a day and time.
2. If Google Calendar is connected in the app, JARVIS creates the reminder event directly through the Calendar API.
3. Otherwise, JARVIS opens a prefilled Google Calendar draft titled as a reminder.

Supported commands:

- `Remind me to call mom tomorrow at 5 PM`
- `Set a reminder for dentist friday at 3 PM`
- `Remind me about paying rent tomorrow at 9 AM`

## File Search V1

JARVIS now includes a local file search skill for your Documents folder.

Current file behavior:

1. JARVIS can search for files by filename inside your Documents area.
2. JARVIS can list recent files from that same local area.
3. JARVIS can open a file directly when given its path.

Supported commands:

- `Find my resume`
- `Search files for project`
- `Show recent files`
3. The advanced assistant returns a reviewable plan with a skill name, summary, build steps, and permission needs.
4. JARVIS shows that plan in the UI and does not auto-build or auto-run it.

Current limitation:

- This first escalation flow drafts plans only.
- It does not yet turn the plan into a real implemented skill automatically.

## Skill Builder V1

JARVIS can now convert an approved missing-skill plan into a structured implementation brief.

Current skill-builder behavior:

1. You can approve a missing-skill plan after reviewing it.
2. JARVIS converts that plan into an implementation brief with the original request, value, build steps, and permission review notes.
3. The brief stays visible in the UI as the handoff object for a later build step.

Current limitation:

- This version creates the implementation brief only.
- It does not yet auto-generate code or apply the skill to the project.

## Build Request V1

JARVIS can now turn an approved implementation brief into a coding-agent handoff request.

Current build-request behavior:

1. After approving a skill plan, you can generate a build request.
2. JARVIS creates a structured implementation prompt with the skill goal, user value, build steps, and safety expectations.
3. The build request stays visible in the UI as the next-step handoff object for actual implementation work.

Current limitation:

- This version prepares the build request only.
- It does not yet auto-run the coding handoff or edit the project automatically.

## Autonomous Skill Builder V1

JARVIS can now run the missing-skill planning chain automatically.

Current autonomous behavior:

1. When skill autopilot is enabled, JARVIS can move from missing-skill request to plan, implementation brief, and build request on its own.
2. The chain stays visible in the UI with a simple status marker.
3. JARVIS still stops at the manual boundary instead of silently editing the project.

Current limitation:

- This version automates the planning chain only.
- Actual code generation and repo edits still require a later coding-agent execution step.

## Coding Handoff Package V1

JARVIS can now save a real coding handoff package to disk.

Current handoff behavior:

1. A build request can be turned into a Markdown and JSON handoff package automatically or manually.
2. When skill autopilot is enabled, JARVIS can create that package on its own after the build request is ready.
3. The package marks the exact manual boundary where a real coding/runtime executor would need to take over.

Current limitation:

- JARVIS does not yet execute the coding handoff itself.
- It prepares and saves the handoff package, then stops at the manual boundary.

## Executor Bridge V1

JARVIS can now try to hand a coding package to a configured local executor command.

Current executor behavior:

1. You can save an executor command path and working directory in the UI.
2. After creating a handoff package, JARVIS can try launching that local executor automatically.
3. The executor receives the JSON and Markdown handoff paths as arguments.
4. If the executor is missing or fails, JARVIS falls back to the visible manual boundary.

Current limitation:

- JARVIS does not know what executor you want by default; you must configure one.
- The actual code-editing runtime is still external to JARVIS and must already exist on your machine.

## Spotify Control V1

JARVIS can now connect to Spotify and control playback through the Spotify Web API.

Current Spotify behavior:

1. Save a Spotify client ID in the app.
2. Connect through the browser-based Spotify sign-in flow.
3. Use natural commands for playback control and status checks.

Supported examples:

- `Play Spotify`
- `Pause Spotify`
- `Next song`
- `Previous song`
- `What's playing on Spotify`

Current limitation:

- Direct playback control depends on Spotify player permissions and an active playback device.
- If no device is active yet, Spotify can reject the command until you open Spotify and start playback once.

## Gmail V1

JARVIS can now connect to Gmail with read-only access and pull inbox results into the app.

Current Gmail behavior:

1. Reuses the saved Google client configuration from Calendar.
2. Connects Gmail with a separate read-only consent flow.
3. Can list recent unread messages and search Gmail by query.

Supported examples:

- `Show unread emails`
- `Check my email`
- `Search email for internship`
- `Search Gmail for receipts`

Current limitation:

- Gmail V1 is read-only.
- The Google Cloud project must have the Gmail API enabled.

## Gmail -> Notion V1

JARVIS can now turn loaded Gmail results into Notion notes.

Current cross-app behavior:

1. Load emails by asking for unread mail or running a Gmail search.
2. Save the latest loaded email to Notion as a note.
3. Save the current loaded email batch as a Notion digest.

Supported examples:

- `Show unread emails`
- `Save this email to Notion`
- `Save unread emails to Notion`
- `Search Gmail for receipts`
- `Save email digest to Notion`

Current limitation:

- JARVIS saves from the emails currently loaded in the app.
- It does not yet let you pick a specific message by index or thread.

## Email Selection + Email -> Calendar V1

JARVIS can now act on a specific loaded email by its visible index and can try to turn an email into a calendar event.

Current behavior:

1. Loaded Gmail results are numbered in the app.
2. You can save a specific loaded email to Notion by number.
3. You can ask JARVIS to create a calendar event from the latest loaded email or a numbered email.

Supported examples:

- `Save email 2 to Notion`
- `Add this email to calendar`
- `Add email 3 to calendar`

Current limitation:

- Calendar extraction only works when JARVIS can find a recognizable date and time in the email subject or snippet.

Richer extraction notes:

- JARVIS now also checks decoded email body text, not just the subject/snippet.
- It can better handle phrases like `on Friday at 3 PM`, `from 2 PM to 4 PM`, month/day wording, and simple numeric dates like `5/29 at 2 PM`.
- You can now target a loaded email by topic, for example `save the email about rent to notion` or `add the email about interview to calendar`.

## Notion Planner V1

JARVIS can now use Notion as a lightweight task planner.

Current planner behavior:

1. Create task notes with an optional due phrase.
2. List task notes that are marked due today.
3. Reuse the existing Notion notes database instead of needing a separate planner app.

Supported examples:

- `Make a task to call mom tomorrow at 5 PM`
- `Create a task finish project report friday at 3 PM`
- `Show today's tasks`
- `Show upcoming tasks`
- `Show overdue tasks`
- `Complete task 1`
- `Update task 2 to submit project report tomorrow at 6 PM`

Current limitation:

- Task notes are stored in the same Notion database as other notes.
- If your Notion database includes `Status` and/or `Due` properties, JARVIS now uses them for task updates.
- If those properties are missing, JARVIS falls back cleanly to title-encoded task metadata so the workflow still works.

## Task Workflow Polish V1

JARVIS can now work with planner tasks by name as well as by number, and it supports simple rescheduling and reopening flows.

Current behavior:

1. Complete, reopen, or update a task by number or by a text match in the task title/summary.
2. Move a task to `today` or `tomorrow`.
3. Show filtered task sets for `done`, `open`, or a text/tag-like query.

Supported examples:

- `Complete task about report`
- `Reopen task 1`
- `Move task about rent to tomorrow`
- `Show done tasks`
- `Show open tasks`
- `Show tasks tagged school`

## Gmail Thread Read / Open V1

JARVIS can now work with a specific loaded Gmail message more directly instead of only saving or converting it.

Current behavior:

1. Read a numbered email in-app using the full loaded subject, sender, date, and decoded body.
2. Open a numbered or topic-matched email thread directly in Gmail.
3. Reuse the same loaded email list from `Show unread emails` or Gmail search results.

Supported examples:

- `Read email 1`
- `Read the email about rent`
- `Open email 2`
- `Open the email about interview`

## Gmail Smart Extraction V1

JARVIS can now scan a loaded Gmail message and pull out likely personal details from the body text.

Current behavior:

1. Analyze the latest loaded email, a numbered email, or an email matched by topic.
2. Pull likely deadlines, birthdays, meetings, addresses, and reminders from the visible email content.
3. Show the extracted categories directly in the app result panel.

Supported examples:

- `Analyze this email`
- `Analyze email 1`
- `Extract details from the email about rent`

Current limitation:

- The extraction is heuristic, so it works best on clear email wording and may miss subtle or unusually formatted details.

## Daily Brief V1

JARVIS can now generate a simple daily brief that pulls together connected information and saves it into Notion.

Current behavior:

1. Pull unread Gmail messages if Gmail is connected.
2. Pull today's Google Calendar events if Calendar is connected.
3. Pull task notes from Notion and summarize today's and upcoming tasks.
4. Save the combined brief back into Notion as a note.

Supported examples:

- `Create daily brief`
- `Make my daily brief`
- `Save daily brief to Notion`

## Daily Brief V2

JARVIS now makes the brief more useful instead of just listing connected data.

Current behavior:

1. Prioritizes email items that look urgent based on deadline, meeting, and reminder signals.
2. Groups today's calendar into morning, afternoon, and evening.
3. Puts overdue tasks ahead of tasks due today.
4. Starts the brief with a short `Focus today` summary.

Supported examples:

- `Create daily brief`
- `Make my daily brief`
- `Save daily brief to Notion`

## Local setup

This repository has been scaffolded, but the current machine is missing a working npm installation and the Rust/Tauri toolchain.

## Document / PDF Skill V1

JARVIS can now work with local PDFs from your Documents folder.

Current behavior:

1. Find PDFs and load them into the local files panel.
2. Open or read a loaded PDF by its visible number or by a topic match.
3. Summarize a loaded PDF by its visible number or by a topic match.
4. Save a PDF summary to Notion.
5. Create Notion tasks from likely action items inside the PDF text, including due phrases when detected.

Supported examples:

- `Find PDFs`
- `Search PDFs for calculus`
- `Open PDF 1`
- `Read PDF 1`
- `Summarize PDF 1`
- `Save PDF 1 summary to Notion`
- `Make tasks from PDF 1`

Current limitation:

- The summary and task extraction are heuristic.
- They work best on text-based PDFs and may be weaker on scanned/image-only PDFs.

## Batch Reference Controls V1

JARVIS can now act on ranges from the last visible list instead of making you restate the full collection every time.

Current behavior:

1. Resolve `the first N of those` against the last shown email, PDF, or task list.
2. Resolve `the next N` relative to the current active email, PDF, or task when there is one.
3. Resolve `the rest` against the remaining items in the current visible list.
4. Apply the resolved range to the matching batch action:
   - emails -> save to Notion
   - PDFs -> summarize
   - tasks -> complete

Supported examples:

- `Save the first 5 of those to Notion`
- `Summarize the next 3`
- `Complete the rest`

Once those are installed, run:

```powershell
npm install
npm run tauri dev
```
