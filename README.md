# Monster site

A web page where anyone can talk to the monster you trained in the Weirding Choir Studio. You type or speak, your monster answers word by word, and the page can read its answers aloud.

## Put it online in three steps

**1. Press Deploy.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmadihg%2Fmonster-site&env=MONSTER_BASE_URL,MONSTER_API_KEY,MONSTER_MODEL&envDescription=Three%20values%20from%20the%20studio%3A%20base%20URL%2C%20secret%20key%20and%20model%20name.&envLink=https%3A%2F%2Fgithub.com%2Fmadihg%2Fmonster-site%23put-it-online-in-three-steps&project-name=my-monster-site&repository-name=my-monster-site)

Vercel asks you to sign in with GitHub, then makes a copy of this project in your own GitHub account.

**2. Paste three values.** Vercel asks for them. The studio's "Your own site" page shows all three with copy buttons.

| Name | What it is |
| --- | --- |
| `MONSTER_BASE_URL` | The studio's address for programs. It ends in `/api/v1`. |
| `MONSTER_API_KEY` | Your secret key. It starts with `sk_mon_`. Never put it in a page or share it. |
| `MONSTER_MODEL` | Your monster's model name, as the studio shows it. |

**3. Open your site.** When Vercel says it is ready (about a minute), press Visit and say hello. If your monster was asleep, the first answer takes a minute or two. The page shows waiting lines until it wakes.

Optional: set `NEXT_PUBLIC_MONSTER_SYSTEM` to give your monster a new system line on this site. Leave it out and the studio uses your monster's own.

## Change the look

You change the look with an LLM and the restyling prompt below. It changes only how the page looks, never what it does.

1. On GitHub, open `src/app/page.tsx` in your copy and copy all of it.
2. Copy the prompt below. Change the line in capitals to the look you want. Paste the prompt into the LLM, then paste the page right after it.
3. On your GitHub project, press the period key (`.`). github.dev opens. Open `src/app/page.tsx`, select all, paste the LLM's answer, and commit. Vercel puts the new version online in about a minute.

Things will break. Two fixes cover most breaks:

- Paste back the previous version: on GitHub, open `src/app/page.tsx`, press History, open the version before yours, copy it, paste it in github.dev and commit.
- Ask the LLM again: "Keep every function exactly as it is. Change only classNames and markup."

### The restyling prompt

<!-- restyle-prompt:start -->
```text
You are a UI designer and frontend developer. Modify only the **look and feel** (styling, layout, typography, visual hierarchy) of the following React+TypeScript (Next.js) component to achieve a new visual design based on the user's specified style.

[SPECIFY YOUR DESIRED VISUAL STYLE HERE - Examples: "Minimal and clean", "Dark mode", "Retro 90s", "Neon cyberpunk", "Corporate professional", "Playful and colorful", etc.]

IMPORTANT TYPESCRIPT CONSIDERATIONS

- This is a TypeScript project using Next.js - all HTML elements must be valid within TypeScript JSX.
- Do NOT use deprecated HTML elements like <marquee>, <blink>, or <font> as they're not valid in modern TypeScript React.
- Use inline styles or Tailwind classes instead of obsolete HTML attributes like "face", "size", or "color".
- Replace vertical alignment attributes like "valign" with className="align-top" or similar modern equivalents.
- Maintain proper TypeScript syntax throughout the component.

IMPORTANT: Do not modify or remove any of the **chatbot logic**, API calls, audio recording, transcription, or speech synthesis functionality.

Do not touch any JavaScript functions, hooks, state logic, or API interaction code.

You may update:
- CSS class names
- Tailwind utility classes
- HTML layout/structure used purely for visual purposes
- Replace deprecated HTML with modern equivalents that LOOK similar

IMPORTANT: All interactive logic (recording, speech, submission, API integration, state management) **must remain 100% functional and untouched**.

For any nostalgic or specialty looks, use modern alternatives:
- For animated text effects: Use CSS animations with keyframes instead of deprecated elements
- For special fonts: Use inline styles like style={{fontFamily: "..."}}
- For custom layouts: Use appropriate React/JSX syntax with proper TypeScript compatibility

Your job is **only to improve or change the visual design and layout**, not to change behavior.

Here is the component, the whole of src/app/page.tsx. Answer with the whole file, ready to paste over src/app/page.tsx:
```
<!-- restyle-prompt:end -->

## What is inside

- `src/app/page.tsx`: the chat page. This is the file you restyle.
- `src/app/api/chat/route.ts`: sends the conversation to your monster with your key and streams the answer back. Your key stays on the server.
- Speaking and listening use the browser's own Web Speech API (Chrome, Edge and Safari). Nothing is sent to OpenAI.

## Run it on your computer (optional)

Make a file `.env.local` with the three values (`MONSTER_BASE_URL=...` and so on, one per line), then `npm install` and `npm run dev`, and open http://localhost:3000.

## License

MIT. Made by Halim Madi (www.halimmadi.com) for students, builders and creative technologists.
