# Mollu

지정한 Discord 서버의 메시지를 **고른 언어로** 자동 번역해 원문 아래에 붙여 보여 주는 BetterDiscord 플러그인입니다. 한국어로 번역하는 것도, 한국어를 영어·일본어 등으로 번역하는 것도 됩니다.

> 이전 이름은 `KoreanAutoTranslator` 입니다. 저장돼 있던 API 키·대상 서버·번역 캐시는 첫 실행 때 자동으로 인계됩니다. 다만 **`plugins` 폴더에 남아 있는 `KoreanAutoTranslator.plugin.js` 는 지워야 합니다.** 두 파일이 함께 있으면 플러그인이 두 벌 로드됩니다.

- 대상 서버는 설정에서 서버 ID 목록으로 지정합니다.
- **자동 / 수동** 두 모드가 있습니다. 수동 모드에서는 `번역` 버튼을 누른 메시지만 전송되므로 토큰과 요청 한도를 아낍니다.
- 대상 언어는 15개 중에서 고릅니다. 이미 그 언어로 쓰인 메시지는 번역하지 않습니다.
- 설정 패널과 표시 문구는 한국어·영어를 지원하며, 기본값은 Discord 로캘을 따릅니다.
- 번역문은 원문을 그대로 둔 채 바로 아래 회색 텍스트로 표시됩니다.
- 같은 문장은 캐시해서 재요청하지 않습니다.
- 백엔드는 **DeepSeek**(유료·저렴), **Google Gemini / Gemma**(무료 티어), **DeepL**(무료 월 50만 자) 중 설정에서 고릅니다. 앞의 둘은 OpenAI 호환 `/chat/completions` 를 쓰므로 `baseUrl` / `model` 만 바꾸면 다른 호환 API도 붙습니다.

## 동작 방식

1. `MessageContent` 컴포넌트의 렌더를 패치합니다.
2. 대상 서버의 메시지이고, 봇/본인/시스템 메시지 필터를 통과하고, 대상 언어 문자 비율이 임계값 미만이면 원문 아래에 번역 컴포넌트를 붙입니다.
3. 번역 컴포넌트는 캐시를 먼저 확인하고, 캐시에 없으면 **그 메시지가 화면에 0.35초 이상 보일 때** 동시 실행 수 제한이 걸린 큐를 통해 API를 호출합니다. 결과가 오면 해당 메시지만 다시 렌더합니다. 스크롤로 빠르게 지나간 메시지는 번역하지 않으며, 큐에서 차례를 기다리는 동안 화면 밖으로 나간 메시지는 호출 직전에 취소되고 다시 보일 때 재시도합니다. "번역 중…" 은 큐에 들어간 시점이 아니라 **실제 요청이 시작된 메시지에만** 표시되므로, 스크롤 중 화면이 밀리지 않습니다.
4. 멘션·커스텀 이모지·코드·링크·타임스탬프는 `【0】` 형태 placeholder로 치환해 모델에 보내고, 번역 후 원래대로 복원합니다. 복원된 토큰은 원문과 같은 모습(멘션 이름, 이모지 이미지, 코드 배경, 현지 시각)으로 렌더됩니다.
5. `deepseek-v4-*` 는 thinking(추론) 모드가 기본 ON이라 응답이 15~20초 걸립니다. 이 플러그인은 `thinking: {"type": "disabled"}` 를 보내 꺼 둡니다.

### 무료로 쓰기 — DeepL

[deepl.com/pro-api](https://www.deepl.com/pro-api) 에서 **DeepL API Free** 키를 받아 백엔드를 `DeepL` 로 바꾸면 됩니다. 월 50만 자까지 무료이고 모델을 고를 필요가 없습니다.

DeepL 은 채팅 모델이 아니라 전용 번역 엔진이라 다르게 동작합니다.

- 멘션·이모지·링크는 프롬프트로 부탁하는 대신 **DeepL 의 `ignore_tags` 로 번역 대상에서 제외**하므로 더 확실히 보존됩니다.
- 무료 키는 `:fx` 로 끝나고 전용 호스트를 씁니다. 키 종류와 주소가 어긋나면 자동으로 맞춥니다.
- 시스템 프롬프트가 없어 말투 지시(반말/존댓말 유지, 슬랭 자연스럽게)는 걸 수 없습니다. 구어체 채팅에서는 LLM 백엔드가 더 나을 수 있습니다.
- 할당량을 다 쓰면(`456`) 재시도하지 않고 바로 알려 줍니다.

### 무료로 쓰기 — Google Gemini / Gemma

설정에서 백엔드를 `Google Gemini / Gemma` 로 바꾸고 [aistudio.google.com](https://aistudio.google.com) 에서 발급한 키를 넣으면 됩니다. 모델·URL 은 자동으로 채워집니다.

**`gemma-4-*` 는 쓰지 마세요.** 추론 모델인데 `reasoning_effort` 를 거부해서(`Thinking budget is not supported for this model.`) 추론을 끌 수 없습니다. 실측 결과 응답에 9~12초가 걸리고, 토큰 예산을 추론에 다 써서 번역문이 나오기 전에 잘립니다. `gemini-3.1-flash-lite` 는 같은 메시지에 약 1초입니다.

무료 티어는 분당·일일 요청 한도가 있습니다. 한도에 걸리면(`429`) 플러그인이 **모든 요청을 서버가 알려 준 시간만큼 일시정지**한 뒤 다시 시도합니다. 한 메시지당 최대 3번까지 재시도하며, 그 사이 "번역 실패" 를 띄우지 않습니다. 자주 걸린다면 `동시 번역 요청 수` 를 1~2 로 낮추거나, 한도가 더 넉넉한 `gemma-4-31b-it` 로 바꾸세요.

> **주의: 무료 티어는 보낸 데이터가 Google 제품 개선에 사용됩니다.** 이 플러그인은 대상 서버에 있는 **다른 사람의 메시지 본문**을 전송하므로, 서버 구성원의 대화가 학습 데이터가 된다는 뜻입니다. 유료 티어에는 해당하지 않습니다.

## 요구 사항

- BetterDiscord **1.14.0 이상** (`BdApi.Net.fetch` 필요 — 이 API가 Discord의 CSP를 우회해 외부 API를 호출합니다)
- DeepSeek API 키 (`platform.deepseek.com` → API keys, 잔액 충전 필요 — 유료지만 저렴)
- 빌드용: Node.js 20 이상

## 빌드

```sh
npm install
npm run build          # dist/Mollu.plugin.js 생성
npm run deploy         # 빌드 후 BetterDiscord plugins 폴더로 복사
npm run watch          # 소스 변경 감지 → 자동 빌드 + 복사
npm test               # 빌드 후 토크나이저 / 언어 판정 / 번들 로드 스모크 체크
npm run lint           # ESLint
npm run format         # Prettier 적용 (검사만 하려면 npm run format:check)
```

> **Windows**: 명령은 동일합니다. PowerShell에서 `npm install` → `npm run deploy` 를 실행하면 `%AppData%\BetterDiscord\plugins` 로 자동 복사됩니다 (`scripts/build.mjs` 가 OS를 감지). `package.json` 스크립트에 셸 종속 코드는 없습니다.

빌드 산출물 `dist/Mollu.plugin.js` 는 **저장소에 커밋합니다.** 받는 쪽이 빌드 환경 없이 파일 하나만 받아 쓸 수 있어야 하기 때문입니다. 소스를 고쳤으면 `npm run build` 결과도 함께 커밋해야 하며, CI가 커밋된 파일과 소스가 일치하는지 검사합니다.

## 설치

플러그인은 의존성이 전혀 없는 **파일 하나**입니다. 쓰는 쪽에는 Node.js 도 npm 도 빌드도 필요 없습니다.

1. `dist/Mollu.plugin.js` 를 받습니다. 빌드해 둔 파일이 저장소에 커밋되어 있습니다.
2. BetterDiscord `plugins` 폴더에 넣습니다.
   - Windows: `%AppData%\BetterDiscord\plugins` (탐색기 주소창에 그대로 붙여넣으면 열립니다)
   - macOS: `~/Library/Application Support/BetterDiscord/plugins`
   - Linux: `~/.config/BetterDiscord/plugins`
   - 또는 BetterDiscord 설정 → Plugins → **Open Plugins Folder**
3. 플러그인 목록에서 **Mollu** 를 켭니다.

소스를 고쳐서 쓸 때만 `npm run build`(빌드) 또는 `npm run deploy`(빌드 후 plugins 폴더로 자동 복사)가 필요하며, Windows·macOS·Linux 명령이 동일합니다.

## 설정

플러그인 설정 패널에서:

| 항목 | 설명 |
| --- | --- |
| 번역 백엔드 | `DeepSeek` / `Google Gemini / Gemma` / `DeepL`. 바꾸면 모델·URL 이 기본값으로 맞춰지고, 각 백엔드의 키는 따로 기억됩니다. |
| API 키 | 필수. 없으면 아무 동작도 하지 않습니다. 저장된 키는 패널에 표시되지 않고 뒤 4자리만 보입니다. 비워 두면 유지되고, `-` 를 입력하면 삭제됩니다. |
| 모델 이름 | DeepSeek: `deepseek-v4-flash`(기본·저렴) / `deepseek-v4-pro`(고품질). Gemini: `gemini-3.1-flash-lite`(기본·무료·약 1초). DeepL 은 모델이 없어 칸이 숨겨집니다 |
| API Base URL | OpenAI 호환 엔드포인트. 백엔드를 고르면 자동으로 채워집니다 |
| 대상 서버 ID | 쉼표/공백 구분. **개발자 모드**를 켠 뒤 서버 아이콘 우클릭 → *서버 ID 복사* |
| 번역할 언어 | 15개 중 선택 (기본 한국어). 이미 그 언어인 메시지는 건너뜁니다 |
| 플러그인 언어 | 설정 패널·표시 문구의 언어. `Discord 설정에 맞춤` / `EN` / `KO` |
| 번역 생략 기준 비율 | 글자 중 이 비율 이상이 대상 언어 문자면 번역 생략 (기본 30%) |
| 번역할 최대 글자 수 | 이보다 긴 메시지는 건너뜀 (비용 보호) |
| 동시 번역 요청 수 | API 호출 동시 실행 상한 |
| 자동 번역 | 끄면 **수동 모드**. 번역 대상 아래에 `번역` 버튼만 나오고, 누른 것만 API 로 보냅니다 |
| 봇 메시지도 번역 / 내 메시지도 번역 | 필터 토글 |
| 번역 중 표시 / 번역 실패 시 표시 | UI 토글 |

## 프로젝트 구조

```
src/
  index.js                     플러그인 클래스 — start/stop, 의존성 조립
  constants.js                 이름, 기본 설정, 상수
  languages.js                 대상 언어 표 (문자 체계 포함)
  i18n.js                      UI 문자열 (en / ko)
  settings.js                  설정 로드/저장 + BdApi.UI 설정 패널
  discord.js                   React 참조, Flux 스토어 접근, MessageContent 탐색
  message-patch.js             MessageContent 렌더 패치 → 번역 컴포넌트 주입
  lib/
    logger.js                  BdApi.Logger 래퍼
    net.js                     BdApi.Net.fetch 기반 JSON POST
  ui/
    translation-block.js       메시지 아래에 렌더되는 React 컴포넌트
    rich-text.js               복원된 멘션/이모지/코드/타임스탬프를 요소로 렌더
    visibility.js              공용 IntersectionObserver (블록당 1개가 아닌 전체 1개)
    styles.js                  주입 CSS
  translation/
    translator.js              캐시 + 큐 + 프로바이더 디스패치 파사드
    language-detector.js       한국어 여부 판정
    tokenizer.js               멘션/이모지/코드/링크 mask·unmask
    cache.js                   번역 캐시 (메모리 + 영속화 + 트리밍)
    queue.js                   동시성 제한 작업 큐
    prompt.js                  대상 언어를 받는 시스템 프롬프트
    providers/
      index.js                 프로바이더 레지스트리
      openai-compatible.js     /chat/completions 공통 호출
      deepseek.js              DeepSeek 고유 설정
      gemini.js                Gemini / Gemma 고유 설정
      deepl.js                 DeepL (OpenAI 호환 아님, 자체 태그 보호)
scripts/
  build.mjs                    esbuild 번들 + 메타 배너 + 선택적 설치
  smoke.mjs                    스모크 체크
```

## 대상 언어

한국어·일본어·중국어·러시아어·태국어·아랍어·힌디어처럼 **고유 문자**를 쓰는 언어는, 메시지의 문자 비율만 보고 "이미 그 언어" 인지 값싸게 판정해 불필요한 요청을 보내지 않습니다.

영어·스페인어·프랑스어·독일어·포르투갈어·베트남어·인도네시아어는 **모두 라틴 문자라 보내기 전에 서로 구분할 수 없습니다.** 이 경우 메시지마다 한 번은 API로 보내고, 모델이 원문 그대로 돌려주면(= 이미 대상 언어면) 표시하지 않고 그 판정을 캐시합니다. 즉 라틴 문자 대상 언어에서는 첫 요청 비용이 한 번 더 듭니다.

### 지역 변종

포르투갈어는 **브라질(`Português do Brasil`)과 유럽(`Português de Portugal`)을 따로** 고릅니다. 어휘·인칭·구어체가 달라서 하나로 묶으면 모델이 어느 쪽을 낼지 정해지지 않습니다. 실제 출력 차이:

```
원문     ㅋㅋㅋ 그 보스전 진짜 미쳤더라, 4트 만에 겨우 깼네…
브라질   kkk aquela luta contra o boss foi insana, só consegui passar na 4ª tentativa…
유럽     Ahah, aquele boss foi mesmo uma loucura, só consegui passar à quarta tentativa…
```

## 알려진 제약

- **`MessageContent` 탐색이 가장 취약한 부분입니다.** Discord가 내부 구조를 바꾸면 번역이 표시되지 않을 수 있습니다. 그 경우 콘솔(Ctrl+Shift+I)에 `[Mollu] MessageContent ...` 로그가 없거나 에러 토스트가 뜹니다. `src/discord.js` 의 `markerSets` 만 고치면 되도록 분리해 두었습니다.
- 스트리밍 응답은 사용하지 않습니다. 번역은 완료 후 한 번에 표시됩니다.
- 네트워크 오류·타임아웃·`5xx` 는 사용자에게 보이기 전에 2회 더 시도합니다. `400`/`401` 같은 설정 오류는 재시도하지 않습니다.
- **번역 실패 표시를 클릭하면 즉시 다시 시도합니다.** 자동 재시도로 안 되는 경우를 위한 수동 경로입니다.
- 메시지 수정 시 새 내용으로 다시 번역합니다(이전 캐시는 남습니다).
- 일본어 판정은 한자와 가나를 함께 보므로, 한자만 쓰인 중국어 메시지를 일본어로 오인할 수 있습니다.
- 중국어는 간체(`Simplified Chinese`) 하나만 있습니다. 번체가 필요하면 `src/languages.js` 에 항목을 추가하면 됩니다.
- 설정 패널·표시 문구는 한국어와 영어만 있습니다. 대상 언어 선택과는 별개입니다.

## 개인정보

대상 서버에서 한국어가 아닌 것으로 판정된 메시지의 **본문 텍스트**가 설정한 API 엔드포인트(기본값 DeepSeek)로 전송됩니다. 대상 서버 외 메시지, 한국어 메시지, 필터로 제외된 메시지는 전송되지 않습니다.

전송 전에 멘션·이모지·코드·링크·타임스탬프는 placeholder로 치환되므로 스노우플레이크 ID와 URL은 모델에 노출되지 않습니다.

번역 결과는 **디스크에 평문으로 캐시됩니다.** 원문(치환된 형태)과 번역문 쌍이 최대 3000개까지 저장되며, **API 키도 같은 파일에 평문으로** 들어갑니다. 위치는 `plugins` 폴더 안입니다.

- Windows: `%AppData%\BetterDiscord\plugins\Mollu.config.json`
- macOS: `~/Library/Application Support/BetterDiscord/plugins/Mollu.config.json`
- Linux: `~/.config/BetterDiscord/plugins/Mollu.config.json`

설정 패널에서 키는 뒤 4자리만 보이지만 이 파일에는 전체가 남습니다. 캐시와 키를 지우려면 플러그인을 비활성화한 뒤 이 파일을 삭제하면 됩니다.
