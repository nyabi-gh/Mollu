[한국어](README.md) · **English**

# Mollu

A BetterDiscord plugin that translates foreign-language messages and shows the translation right under the original.

It works in both directions — into your language, or out of it.

## What it does

- Translates messages in the servers you pick (or every server) into a language you choose, shown under the original in grey.
- Pick from 15 languages. Messages already written in that language are left alone.
- **Automatic mode** translates what is on screen by itself. **Manual mode** puts a `Translate` button under each message and only sends what you press.
- Translations are remembered, so repeating the same sentence costs nothing extra.
- **Your own outgoing messages** can be translated too — type in Korean, send in English. Off by default.
- The things you turn on and off often have keyboard shortcuts.
- New versions install themselves from inside Discord.

## Installing

The plugin is a single file. There is nothing else to install.

1. Download `dist/Mollu.plugin.js`.
2. In BetterDiscord, go to Settings → Plugins → **Open Plugins Folder** and drop the file in.
3. Enable **Mollu** in the plugin list.

To find the folder yourself:

- Windows: `%AppData%\BetterDiscord\plugins`
- macOS: `~/Library/Application Support/BetterDiscord/plugins`
- Linux: `~/.config/BetterDiscord/plugins`

BetterDiscord 1.14.0 or newer is required.

## First-time setup

Translation runs through an outside service, so you need **an API key**. Pick one of the three.

| Service | Cost | Where to get a key |
| --- | --- | --- |
| **DeepL** | 500,000 characters a month, free | [deepl.com/pro-api](https://www.deepl.com/pro-api) |
| **Google Gemini** | Has a free tier | [aistudio.google.com](https://aistudio.google.com) |
| **DeepSeek** | Paid, but very cheap | [platform.deepseek.com](https://platform.deepseek.com) |

**DeepL** is the easiest way to start for free. It is a dedicated translation service, so it is fast and there is no model to choose. DeepSeek and Gemini read more naturally, though — they keep tone and slang.

Once you have a key, in the plugin settings:

1. Choose your service under `Translation backend`.
2. Paste the key into `API key`.
3. Decide where to translate: turn on `Translate in every server`, or list servers under `Target server ids`.
   - To get a server id, enable **Developer Mode** in Discord's settings under Advanced, then right-click a server icon → **Copy Server ID**.

> **A warning about Gemini's free tier**: what you send is used to improve Google's products. This plugin sends **other people's messages** from your servers, which means their conversations become training data. The paid tier is not affected.

## Shortcuts

| Default | What it does |
| --- | --- |
| `Ctrl+Shift+T` | Automatic translation on / off |
| `Ctrl+Shift+O` | Outgoing translation on / off |

Click the field in settings and press the keys you want. Clear it to use no shortcut.

## Settings

| Setting | What it means |
| --- | --- |
| Translation backend | Which service to use. Switching fills in the rest, and each service's key is remembered separately |
| API key | Required — nothing happens without it. Once saved only the last 4 characters are shown; type `-` to erase it |
| Translate in every server | Every server you are in becomes a target. Direct messages are never translated either way |
| Target server ids | The servers to translate, separated by commas or spaces |
| Translate into | The language to translate messages into |
| Plugin language | The language of the settings panel and the plugin's own messages |
| Treat as already translated above | Skip a message when this share of it is already in the target language |
| Maximum characters to translate | Longer messages are skipped, which keeps a wall of text from costing a lot at once |
| Concurrent requests | How many translations to run at once. Lower it to 1–2 if you keep hitting a free-tier limit |
| Automatic translation | Off is manual mode: only messages whose `Translate` button you press are sent |
| Translate the messages I send | **Replaces what you type with its translation** before sending. Other people never see the original |
| Send my messages in | The language your own messages are translated into |
| Translate bot messages / Translate my own messages | What to include |
| Show while translating / Show translation failures | What to show on screen |

**Advanced**:

| Setting | What it means |
| --- | --- |
| Model | Which model translates. Only appears when there is more than one worth choosing — DeepSeek has two, and DeepL has none |
| API base URL | Filled in when you pick a service. You will rarely touch it |
| Update automatically | Installs a new version when one appears. Checks every few hours |
| Updates | `Check` looks right now |
| Translation cache | `Clear` deletes every saved translation. Use it when a translation is wrong or you switched services |
| Log why a message was skipped | Records the reason a message was not translated. For when nothing shows up and you cannot tell why |

## Worth knowing

- If no translations appear at all, it is usually because **the target language is the language the server already speaks**. Set it to Korean in a Korean server and there is nothing to translate.
- Your own messages are not translated by default. Turn on `Translate my own messages` to test with your own typing.
- Languages that share the Latin alphabet — English, Spanish, French — cannot be told apart before sending, so each sentence is sent once. The verdict is saved, so no sentence costs twice.
- When a translation fails, click the failure line to try again.
- Editing a message re-translates it.
- A large Discord update can stop translations from appearing. Wait for a plugin update.

## Privacy

- The **text** of messages that need translating is sent to the service you configured. Messages outside your target servers, and messages already in the target language, are never sent.
- With `Translate the messages I send` on, **what you type is sent too**, just before it goes out.
- Mentions, emoji, links and code are swapped for placeholders before sending, so user ids and addresses are never exposed to the translation service.
- Translations and **your API key are stored in plain text** in the file below. Do not share it or put it on screen.
  - Windows: `%AppData%\BetterDiscord\plugins\Mollu.config.json`
  - macOS: `~/Library/Application Support/BetterDiscord/plugins/Mollu.config.json`
  - Linux: `~/.config/BetterDiscord/plugins/Mollu.config.json`
- To erase everything, disable the plugin and delete that file.
