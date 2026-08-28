# Mollu

지정한 Discord 서버에서 **한국어가 아닌 메시지**를 AI API로 자동 번역해 원문 아래에 붙여 보여 주는 BetterDiscord 플러그인입니다.

> 이전 이름은 `KoreanAutoTranslator` 입니다. 저장돼 있던 API 키·대상 서버·번역 캐시는 첫 실행 때 자동으로 인계됩니다. 다만 **`plugins` 폴더에 남아 있는 `KoreanAutoTranslator.plugin.js` 는 지워야 합니다.** 두 파일이 함께 있으면 플러그인이 두 벌 로드됩니다.

- 대상 서버는 설정에서 서버 ID 목록으로 지정합니다.
- 한글 비율이 임계값 이상인 메시지는 번역하지 않습니다.
- 번역문은 원문을 그대로 둔 채 바로 아래 회색 텍스트로 표시됩니다.
- 같은 문장은 캐시해서 재요청하지 않습니다.
- 기본 백엔드는 DeepSeek(`/chat/completions`, OpenAI 호환)이며, `baseUrl` / `model` 만 바꾸면 다른 OpenAI 호환 API도 사용할 수 있습니다.

## 동작 방식

1. `MessageContent` 컴포넌트의 렌더를 패치합니다.
2. 대상 서버의 메시지이고, 봇/본인/시스템 메시지 필터를 통과하고, 한글 비율이 임계값 미만이면 원문 아래에 번역 컴포넌트를 붙입니다.
3. 번역 컴포넌트는 캐시를 먼저 확인하고, 캐시에 없으면 **그 메시지가 화면에 0.35초 이상 보일 때** 동시 실행 수 제한이 걸린 큐를 통해 API를 호출합니다. 결과가 오면 해당 메시지만 다시 렌더합니다. 스크롤로 빠르게 지나간 메시지는 번역하지 않으며, 큐에서 차례를 기다리는 동안 화면 밖으로 나간 메시지는 호출 직전에 취소되고 다시 보일 때 재시도합니다. "번역 중…" 은 큐에 들어간 시점이 아니라 **실제 요청이 시작된 메시지에만** 표시되므로, 스크롤 중 화면이 밀리지 않습니다.
4. 멘션·커스텀 이모지·코드·링크·타임스탬프는 `【0】` 형태 placeholder로 치환해 모델에 보내고, 번역 후 원래대로 복원합니다. 복원된 토큰은 원문과 같은 모습(멘션 이름, 이모지 이미지, 코드 배경, 현지 시각)으로 렌더됩니다.
5. `deepseek-v4-*` 는 thinking(추론) 모드가 기본 ON이라 응답이 15~20초 걸립니다. 이 플러그인은 `thinking: {"type": "disabled"}` 를 보내 꺼 둡니다.

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

`dist/` 는 커밋하지 않습니다. 배포 시에는 `npm run build` 결과물인 `dist/Mollu.plugin.js` 한 파일만 배포하면 됩니다.

## 설치

1. `npm run build`
2. `dist/Mollu.plugin.js` 를 BetterDiscord `plugins` 폴더에 넣습니다.
   - Windows: `%AppData%\BetterDiscord\plugins`
   - macOS: `~/Library/Application Support/BetterDiscord/plugins`
   - Linux: `~/.config/BetterDiscord/plugins`
   - 또는 BetterDiscord 설정 → Plugins → **Open Plugins Folder**
3. 플러그인 목록에서 활성화합니다.

`npm run deploy` 를 쓰면 2번을 자동으로 해 줍니다.

## 설정

플러그인 설정 패널에서:

| 항목 | 설명 |
| --- | --- |
| DeepSeek API 키 | 필수. 없으면 아무 동작도 하지 않습니다. 저장된 키는 패널에 표시되지 않고 뒤 4자리만 보입니다. 비워 두면 유지되고, `-` 를 입력하면 삭제됩니다. |
| 모델 이름 | `deepseek-v4-flash`(기본·저렴, 1M 컨텍스트) 또는 `deepseek-v4-pro`(고품질). 구 `deepseek-chat`/`deepseek-reasoner`는 2026-07-24 폐기됨 |
| API Base URL | OpenAI 호환 엔드포인트. 기본값은 `https://api.deepseek.com` |
| 대상 서버 ID | 쉼표/공백 구분. **개발자 모드**를 켠 뒤 서버 아이콘 우클릭 → *서버 ID 복사* |
| 한국어로 간주할 한글 비율 | 이 비율 이상 한글이면 번역 생략 (기본 30%) |
| 번역할 최대 글자 수 | 이보다 긴 메시지는 건너뜀 (비용 보호) |
| 동시 번역 요청 수 | API 호출 동시 실행 상한 |
| 봇 메시지도 번역 / 내 메시지도 번역 | 필터 토글 |
| 번역 중 표시 / 번역 실패 시 표시 | UI 토글 |

## 프로젝트 구조

```
src/
  index.js                     플러그인 클래스 — start/stop, 의존성 조립
  constants.js                 이름, 기본 설정, 상수
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
    prompt.js                  시스템 프롬프트
    providers/
      index.js                 프로바이더 레지스트리
      deepseek.js              DeepSeek(OpenAI 호환) 호출
scripts/
  build.mjs                    esbuild 번들 + 메타 배너 + 선택적 설치
  smoke.mjs                    스모크 체크
```

## 알려진 제약

- **`MessageContent` 탐색이 가장 취약한 부분입니다.** Discord가 내부 구조를 바꾸면 번역이 표시되지 않을 수 있습니다. 그 경우 콘솔(Ctrl+Shift+I)에 `[Mollu] MessageContent ...` 로그가 없거나 에러 토스트가 뜹니다. `src/discord.js` 의 `markerSets` 만 고치면 되도록 분리해 두었습니다.
- 스트리밍 응답은 사용하지 않습니다. 번역은 완료 후 한 번에 표시됩니다.
- 메시지 수정 시 새 내용으로 다시 번역합니다(이전 캐시는 남습니다).

## 개인정보

대상 서버에서 한국어가 아닌 것으로 판정된 메시지의 **본문 텍스트**가 설정한 API 엔드포인트(기본값 DeepSeek)로 전송됩니다. 대상 서버 외 메시지, 한국어 메시지, 필터로 제외된 메시지는 전송되지 않습니다.

전송 전에 멘션·이모지·코드·링크·타임스탬프는 placeholder로 치환되므로 스노우플레이크 ID와 URL은 모델에 노출되지 않습니다.

번역 결과는 **디스크에 평문으로 캐시됩니다.** 원문(치환된 형태)과 번역문 쌍이 최대 3000개까지 BetterDiscord 데이터 폴더에 남습니다.

- Windows: `%AppData%\BetterDiscord\data\<release>\Mollu\`
- macOS: `~/Library/Application Support/BetterDiscord/data/<release>/Mollu/`
- Linux: `~/.config/BetterDiscord/data/<release>/Mollu/`

API 키도 같은 위치에 평문으로 저장되며, 설정 패널에서도 가려지지 않은 채 표시됩니다. **화면 공유 중에는 설정 패널을 열지 마세요.** 캐시와 키를 지우려면 플러그인을 비활성화한 뒤 위 폴더의 `Mollu` 디렉터리를 삭제하면 됩니다.
