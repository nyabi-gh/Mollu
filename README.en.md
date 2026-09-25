[한국어](README.md) · **English**

# Mollu

A BetterDiscord plugin that translates foreign-language messages and shows the translation right under the original.

It works in both directions — into your language, or out of it.

## What it does

- Translates messages in the servers you pick (or every server) into a language you choose, shown under the original in grey.
- Direct messages can be translated too, one-to-one and group alike. Off by default; one switch turns them on.
- Pick from 15 languages. Messages already written in that language are left alone.
- **Automatic mode** translates what is on screen by itself. **Manual mode** puts a `Translate` button under each message and only sends what you press.
- Translations are remembered, so repeating the same sentence costs nothing extra.
- Right-click a message to hide its translation, or to translate it again when it came out wrong.
- **Your own outgoing messages** can be translated too — type in Korean, send in English. Off by default.
- The things you turn on and off often have keyboard shortcuts.
- When a new version is out, its signature is checked and Discord asks whether to install it.

## Installing

The plugin is a single file. There is nothing else to install.

1. [**Download Mollu.plugin.js**](https://github.com/nyabi-gh/Mollu/releases/latest/download/Mollu.plugin.js) — always the newest release.
2. In BetterDiscord, go to Settings → Plugins → **Open Plugins Folder** and drop the file in.
3. Enable **Mollu** in the plugin list.

To find the folder yourself:

- Windows: `%AppData%\BetterDiscord\plugins`
- macOS: `~/Library/Application Support/BetterDiscord/plugins`
- Linux: `~/.config/BetterDiscord/plugins`

BetterDiscord 1.14.0 or newer is required.

## First-time setup

Translation runs through an outside service, so you need **an API key**. Pick one of the five.

| Service | Cost | Where to get a key |
| --- | --- | --- |
| **DeepL** | 500,000 characters a month, free | [deepl.com/pro-api](https://www.deepl.com/pro-api) |
| **Google Gemini** | Has a free tier | [aistudio.google.com](https://aistudio.google.com) |
| **DeepSeek** | Paid, but very cheap | [platform.deepseek.com](https://platform.deepseek.com) |
| **OpenAI** | Paid; the default `gpt-6-luna` is very cheap | [platform.openai.com](https://platform.openai.com) |
| **Anthropic Claude** | Paid; the default is `claude-haiku-4-5` | [platform.claude.com](https://platform.claude.com) |

**DeepL** is the easiest way to start for free. It is a dedicated translation service, so it is fast and there is no model to choose. DeepSeek, Gemini, OpenAI and Claude read more naturally, though, keeping tone and slang. Gemini is supported from 3.1 on.

Once you have a key, in the plugin settings:

1. Choose your service under `Translation backend`.
2. Paste the key into `API key`.
3. Decide where to translate: turn on `Translate in every server`, or right-click a server icon → **Translate with Mollu**.
   - To leave one channel out, right-click it → **Translate with Mollu** and switch it off. Threads follow their channel.
   - To translate DMs as well, turn on `Translate direct messages`. It stands on its own, so you can leave every server off and translate only DMs.

> **A warning about Gemini's free tier**: what you send is used to improve Google's products. This plugin sends **other people's messages** from your servers, which means their conversations become training data. The paid tier is not affected.

## Shortcuts

| Default | What it does |
| --- | --- |
| `Ctrl+Shift+T` | Automatic translation on / off |
| `Ctrl+Shift+O` | Outgoing translation on / off |

Click the field in settings and press the keys you want. Clear it to use no shortcut.

## Settings

The settings come in six sections. **Advanced** starts folded.

**Translation service**

| Setting | What it means |
| --- | --- |
| Translation backend | Which service to use. Switching fills in the rest, and each service's key is remembered separately |
| API key | Required: nothing happens without it. Once saved only the last 4 characters are shown; type `-` to erase it |
| Model | Which model translates. Pick `Type a name in…` for one the list does not carry, and write its id as the service documents it. DeepL has no model to choose |
| Connection | `Test` translates a short sample with the key and model above |

**Where to translate**

| Setting | What it means |
| --- | --- |
| Translate in every server | Every server you are in becomes a target. Direct messages have their own switch |
| Target server ids | The servers to translate. The right-click switch fills this in; ids can also be typed, separated by commas or spaces |
| Channels left untranslated | Channels skipped inside the target servers, switched from a channel's right-click menu |
| Translate direct messages | Translates one-to-one and group DMs, whatever the settings above say. Off by default |

**Messages I receive**

| Setting | What it means |
| --- | --- |
| Translate into | The language to translate messages into |
| Automatic translation | Off is manual mode: only messages whose `Translate` button you press are sent |
| Treat as already translated above | Skip a message when this share of it is already in the target language |
| Maximum characters to translate | Longer messages are skipped, which keeps a wall of text from costing a lot at once |
| Translate bot messages / Translate my own messages | What to include |

**Messages I send**

| Setting | What it means |
| --- | --- |
| Translate the messages I send | **Replaces what you type with its translation** before sending. Other people never see the original |
| Send my messages in | The language your own messages are translated into |

**Display**

| Setting | What it means |
| --- | --- |
| Show while translating | Shows `Translating…` under a message while it is being translated |
| Pop up a notice when a translation fails | A toast for every failure. The failure line under the message is always shown; a refused key or empty balance is always announced |
| Plugin language | The language of the settings panel and the plugin's own messages |

**Advanced**

| Setting | What it means |
| --- | --- |
| API base URL | Filled in when you pick a service. You will rarely touch it |
| Concurrent requests | How many translations to run at once. Lower it to 1–2 if you keep hitting a free-tier limit |
| Check for updates automatically | Looks for a new version every few hours. Only a version carrying the publisher's signature is offered, and it installs only when you agree |
| Updates | `Check` looks right now |
| Translation cache | `Clear` deletes every saved translation. Use it after changing the API base URL; for one wrong translation, the message's right-click menu is enough |
| Log why a message was skipped | Records the reason a message was not translated. For when nothing shows up and you cannot tell why |

## Worth knowing

- If no translations appear at all, it is usually because **the target language is the language the server already speaks**. Set it to Korean in a Korean server and there is nothing to translate.
- Your own messages are not translated by default. Turn on `Translate my own messages` to test with your own typing.
- Languages that share the Latin alphabet — English, Spanish, French — cannot be told apart before sending, so each sentence is sent once. The verdict is saved, so no sentence costs twice.
- When a translation fails, click the failure line to try again.
- To hide one message's translation, right-click it and switch off **Show Mollu translation**. In manual mode the `Translate` button comes back. Hidden translations show again when Discord restarts.
- **Translate again with Mollu** in the same menu asks the service afresh. Use it on a translation that came out wrong, or on a message that got none because the service judged it already in your language. DeepL translates the same text the same way every time, so it does not offer this.
- Editing a message re-translates it.
- A large Discord update can stop translations from appearing. Wait for a plugin update.

## Privacy

- The **text** of messages that need translating is sent to the service you configured. Messages outside your target servers, and messages already in the target language, are never sent.
- With `Translate direct messages` on, **private conversations are sent too**, on the same terms as any other message. Leave it off if that is not what you want — especially on Gemini's free tier, where what you send becomes training data.
- With `Translate the messages I send` on, **what you type is sent too**, just before it goes out.
- Mentions, emoji, links and code are swapped for placeholders before sending, so user ids and addresses are never exposed to the translation service.
- Translations and **your API key are stored in plain text** in the file below. Do not share it or put it on screen.
  - Windows: `%AppData%\BetterDiscord\plugins\Mollu.config.json`
  - macOS: `~/Library/Application Support/BetterDiscord/plugins/Mollu.config.json`
  - Linux: `~/.config/BetterDiscord/plugins/Mollu.config.json`
- To erase everything, disable the plugin and delete that file.

## Releasing (maintainers)

Automatic updates install only signed releases.

1. Once, run `npm run keygen`. The private key goes to `~/.config/mollu/update-signing-key.pem` and the public key into `src/update-key.js`. Back the private key up somewhere safe: without it, builds that carry this public key cannot install any later version.
2. Store the private key as a repository secret: `gh secret set MOLLU_SIGNING_KEY < ~/.config/mollu/update-signing-key.pem`
3. Bump the version in `meta.json` and `package.json`, commit the built `dist/`, and push a matching tag (`v1.3.0`). The workflow checks, signs and publishes the release.
