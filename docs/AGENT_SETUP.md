# Agent setup for future DeepLife chats

Updated 10 September 2026. The root `AGENTS.md` is the short task entrypoint;
`CLAUDE.md` remains the detailed game reference. Existing release packages are the
acceptance checklist, not a claim that all current code is verified.

## Installed on this computer

| Skill | Use | Reviewed source revision |
| --- | --- | --- |
| vercel-react-native-skills | Lists, UI patterns, state subscriptions and rendering | vercel-labs/agent-skills `063bee94c3f4df8453406c830b0a7df0f2860278` |
| react-native-best-practices | Measure and improve frame time, startup, memory and bundle size | callstackincubator/agent-skills `2766baa46ca0fe7c16cc5ab4d0077ccec2e95fb9` |
| expo-dev-client | Native development-client setup and diagnosis | expo/skills `ea892a7d1421fea5ecdf8c00a4550867fdf8c423` |
| deeplife-ios-quality | Project-specific player journeys and iOS quality acceptance | Personal skill authored for this repository |

Installed in the user's `.codex/skills` directory. Skills are available on the
next turn; the repository instructions travel with the checkout, personal skill
installs do not. The existing `find-skills` installation already matches the
requested discovery workflow; it was not duplicated.

Selection evidence: [Vercel React Native](https://skills.sh/vercel-labs/agent-skills/vercel-react-native-skills)
approximately 206.8K installs / 31K repository stars;
[Callstack](https://skills.sh/callstackincubator/agent-skills/react-native-best-practices)
25.3K / 1.6K; [Expo dev client](https://skills.sh/expo/skills/expo-dev-client)
56.8K / 2.5K, observed on 10 September. Counts are discovery signals, not proof of
correctness. Entrypoints were reviewed before installation. Callstack's directory
listing includes a Snyk warning; review any referenced commands before use.

Use task-relevant references progressively. Do not load every skill for every
change. Do not run skill feedback submission commands without authorization to
send that information. Native dependencies, new navigation stacks and SDK upgrades
are choices to validate, not mandatory consequences of installing a skill.

The latest Expo upgrade skill contains guidance for SDK 57 and broad dependency
replacement instructions. It was evaluated but not installed for this SDK 54
release pass. No generic SwiftUI/Flutter/Godot or new browser automation framework
was added. Existing browser control and project test tools cover those needs.

## Recreate the external skill installs

Use the installed OpenAI `skill-installer` helper with the repositories and pinned
revisions above. The source paths are `skills/react-native-skills` (destination
name `vercel-react-native-skills`), `skills/react-native-best-practices`, and
`plugins/expo/skills/expo-dev-client`. Inspect newer source before updating pins;
there is no automatic update or automatic deployment hook.

The local weekly-audit and preflight skills have been corrected to use existing
files and canonical commands. Useful existing skills: test-suite for regression
scope, preflight for release validation, weekly-audit for all five simulation
domains, computer-use for visible acceptance, imagegen only for justified raster
assets, and eas-build only when a concrete build is requested.

## Suggested next-chat request

> Read AGENTS.md, tasks/todo.md and the latest release evidence. Refresh the branch,
> open PRs and checks. Complete the next reproducible release blocker, verify the
> affected player journey and update the evidence. Preserve unrelated work. Keep
> native/provider acceptance explicitly pending until it is actually exercised.

OpenAI documents how [repository instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
and [skills](https://learn.chatgpt.com/docs/build-skills) provide persistent context.
No global model, permissions, credential, notification or unrelated project
settings were changed.
