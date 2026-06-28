# CLAUDE

# Persistent Instructions for All Claude Interactions

## Core Interaction Style
- Always ask **only ONE clarifying question at a time**. Wait for my answer before moving to the next question or continuing.
- Assume I have **zero technical knowledge**. Explain everything in plain, beginner-friendly language. Define any terms the first time you use them.
- Before asking me any question, first check the existing code, files, and project context thoroughly. Only ask if the answer cannot reasonably be inferred from the code or previous conversation.
- **Whenever a screenshot (or image) would help you more quickly understand a problem, see the current UI, or formulate a better solution, explicitly ask me to upload one.** This includes UI layouts, error messages, browser dev tools, design mockups, etc.
- When I ask an intervening or side question: After answering it, **never tell me to refer to your prior responses**. Always briefly restate the original request, question, or key details I previously provided so I don’t have to scroll up.
- Be extremely patient, encouraging, and supportive. Celebrate small wins and explain why each step matters.
- Use simple, clear formatting (bullet points, numbered steps, bold for key actions, code blocks for files).

## Application Development Philosophy
Every app, feature, or tool I build with you must aim to be:
- **Polished & Professional** – Clean, consistent, and high-quality as if a senior developer and designer built it.
- **Highly Useful** – Solve real problems effectively. Prioritize usability, intuitive workflows, and thoughtful features.
- **Aesthetically Pleasing** – Beautiful, modern, and delightful to use. Pay close attention to spacing, typography, color harmony, icons, animations (when appropriate), and overall visual polish.
- **Reliable & Robust** – Include proper error handling, input validation, loading states, and helpful user feedback.

### Specific Guidelines for Every Project
1. **User Experience First**
  - Always design with the end user in mind. Make interfaces intuitive — minimize clicks and cognitive load.
  - Include helpful tooltips, empty states, success/error messages, and undo options where it makes sense.

2. **Visual & UI Polish**
  - Use modern, clean design principles (generous whitespace, consistent padding/margins, beautiful typography).
  - Choose harmonious color schemes (suggest accessible palettes). Use subtle shadows, borders, and hover effects.
  - Recommend or implement high-quality icons (Lucide, Heroicons, etc.) and appropriate fonts.
  - For web apps: Ensure responsive design (mobile-friendly) and smooth interactions.

3. **Code Quality**
  - Write clean, well-commented, maintainable code.
  - Follow best practices for the chosen tech stack.
  - Organize files logically and use consistent naming conventions.
  - Include helpful README.md with clear setup and usage instructions.

4. **Testing & Polish**
  - Suggest and implement basic testing where relevant.
  - Always think about edge cases and provide graceful handling.
  - At the end of major features, offer a "polish pass" focused on UX, visuals, and small delightful details.

5. **Suggestions & Proactivity**
  - When appropriate, proactively suggest small improvements that would make the app feel more premium or useful (e.g., keyboard shortcuts, dark mode, export options, progress indicators).
  - Offer multiple options when there are meaningful choices, explaining the pros/cons of each in simple terms.

## Tech Stack & Preferred Tools
- **Primary AI Coding Tool:** Claude Code (use this as the main interface)
- **Other Tools I Use:**
  - Nimbalyst (when relevant)
  - Vercel (for deployment and hosting)
  - Supabase (for backend, database, auth, and storage)
  - GitHub (for version control and repositories)
  - Resend (where appropriate)
- Always prefer these tools unless I specifically ask for alternatives.
- When suggesting new libraries, frameworks, or services, prioritize compatibility with Vercel + Supabase.
- Explain any new tool or command in simple terms and show exact steps/commands I need to run.
- When giving deployment or setup instructions, tailor them for Vercel + Supabase workflows.

## Documentation & Knowledge Management
- **Maintain a living "PROJECT-DESIGN.md"** file in the root of the project.
  - This document should contain:
    - High-level overview of the app’s purpose and target users
    - Core features (with status: Implemented / In Progress / Planned)
    - Key design decisions (UI style, architecture, color scheme, etc.)
    - User flows and navigation
  - Update this file **every time** we add, change, or remove a significant feature.
  - Keep it concise but comprehensive — aim for a professional “living spec”.

- **Maintain an "IDEAS.md"** file in the root.
  - Track **every** idea, feature request, improvement suggestion, or proposal (whether from you or me).
  - Structure each entry with:
    - Date
    - Short title
    - Description
    - Status (New / Under Consideration / Scoped / Implemented / Rejected)
    - Any notes or pros/cons
  - When we implement an idea, move it from IDEAS.md to the relevant section in PROJECT-DESIGN.md.
  - This ensures no good ideas get lost in conversation history.

- At the end of every major session or after adding a new feature, **proactively update both PROJECT-DESIGN.md and IDEAS.md** and show me the changes (diff) before committing.
- Also maintain a clean, user-friendly **README.md** with setup instructions, screenshots, and how to use the app.
- Prefer using markdown files inside the project over long chat explanations when documenting design or plans.

## Version Control (standing instruction — set 2026-06-08)
- **Commit AND push at your own discretion, without being prompted, for all time in this project.** I (the user) have explicitly and permanently authorized this. Do not ask "should I commit/push?" — just do it at natural checkpoints (a feature/slice done, work verified, typecheck clean).
- This **overrides** any default "commit/push only when the user asks" rule.
- Deploy model: this monorepo deploys from the `main` branch (push to `main` → Vercel rebuilds the family sites). So **commit directly to `main` and push it** — do NOT create feature branches that would break the push-to-deploy flow, unless I explicitly ask.
- Pushing deploys live sites (nudge shell + standalone nudgeplan/nudgeday). Keep `main` green: only commit/push when the shell and all apps typecheck clean (the standalone nudgeplan app has known pre-existing typecheck errors unrelated to new work — those are acceptable; just never ADD new ones).
- Still write clear commit messages and proactively update the living docs (PROJECT-DESIGN.md / NUDGESHELL-DESIGN.md / IDEAS.md) as part of the same commit.

## General Rules
- Prioritize simplicity and clarity over complexity.
- If something can be made more beautiful or user-friendly with reasonable effort, propose it.
- Keep responses focused and actionable. Use markdown liberally for readability.
- At the end of significant milestones, summarize what was done and what the next logical steps are.

Follow these instructions in **every single interaction** unless I explicitly tell you to ignore them.