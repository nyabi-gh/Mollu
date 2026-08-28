import { logger } from "./lib/logger.js";

// Discord 자신의 React 인스턴스. 컴포넌트는 반드시 이걸로 만들어야 한다.
export const React = BdApi.React;

// 필요한 Flux 스토어에 대한 읽기 전용 파사드. BdApi.Webpack 접근을 이 파일로 격리한다.
export function createStores() {
    const ChannelStore = BdApi.Webpack.getStore("ChannelStore");
    const UserStore = BdApi.Webpack.getStore("UserStore");
    const GuildStore = BdApi.Webpack.getStore("GuildStore");

    return {
        guildIdForChannel(channelId) {
            try {
                return ChannelStore?.getChannel?.(channelId)?.guild_id ?? null;
            } catch {
                return null;
            }
        },
        currentUserId() {
            try {
                return UserStore?.getCurrentUser?.()?.id ?? null;
            } catch {
                return null;
            }
        },
        // 아래 세 조회는 멘션 표시용이다. null 은 "모름" 이고 호출자는 원본 토큰으로 물러난다.
        userName(userId) {
            try {
                const user = UserStore?.getUser?.(userId);
                return user?.globalName || user?.username || null;
            } catch {
                return null;
            }
        },
        channelName(channelId) {
            try {
                return ChannelStore?.getChannel?.(channelId)?.name ?? null;
            } catch {
                return null;
            }
        },
        roleName(guildId, roleId) {
            try {
                return GuildStore?.getGuild?.(guildId)?.roles?.[roleId]?.name ?? null;
            } catch {
                return null;
            }
        },
    };
}

// Discord 프로덕션 빌드에는 displayName 이 없고 CSS 클래스명도 해시되어 있어,
// 컴포넌트 소스의 안정적인 문자열 조각으로 찾고 여러 마커 조합으로 폴백한다.
// 이 플러그인에서 가장 깨지기 쉬운 부분이므로 markerSets 만 고치면 되도록 분리했다.
export function findMessageContent() {
    const { Filters } = BdApi.Webpack;

    // MessageContent 는 이 props 를 구조분해한다:
    //   {className, message, children, content, onUpdate, contentRef, compact}
    // contentRef + onUpdate + compact 조합이 사실상 이 컴포넌트에만 나타난다.
    const markerSets = [
        ["contentRef", "onUpdate", "compact"],
        ["contentRef", "onUpdate", "message", "content"],
        ["className", "message", "children", "content", "onUpdate", "contentRef", "compact"],
        ["messageContent", "onUpdate", "contentRef"],
    ];

    for (const markers of markerSets) {
        const target = tryWithKey(Filters.byComponentType(Filters.byStrings(...markers)));
        if (target) {
            logger.info(`MessageContent resolved via [${markers.join(", ")}] -> key "${target.key}"`);
            return target;
        }
    }

    // 최후 수단: 일부 빌드는 아직 displayName 을 노출한다.
    if (typeof Filters.byDisplayName === "function") {
        const target = tryWithKey(Filters.byDisplayName("MessageContent"));
        if (target) {
            logger.info(`MessageContent resolved via displayName -> key "${target.key}"`);
            return target;
        }
    }

    return null;
}

function tryWithKey(filter) {
    let owner;
    let key;
    try {
        [owner, key] = BdApi.Webpack.getWithKey(filter);
    } catch (e) {
        logger.warn("getWithKey threw", e);
        return null;
    }
    if (!owner || !key) return null;

    const value = owner[key];
    if (value && typeof value.type === "function") return { module: value, key: "type" }; // React.memo
    if (value && typeof value.render === "function") return { module: value, key: "render" }; // forwardRef
    if (typeof value === "function") return { module: owner, key }; // bare function component
    return null;
}
