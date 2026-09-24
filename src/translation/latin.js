// Languages written in the Latin alphabet share their letters, so the words decide. Each list
// holds short, frequent words that are rare in the other languages here.
const COMMON_WORDS = {
    en: "the and is are you to of it that this what for with have was not but just be do my me we they can will your so on if how why i'm don't it's",
    es: "el la los las que y es en un una por con para no lo se pero más como muy está yo tú qué del al mi su hay también",
    fr: "le la les des et est une du que qui pas pour dans ce je tu il elle nous vous sur avec mais très c'est j'ai au aux ne on",
    de: "der die das und ist nicht ich du er sie wir ein eine zu mit auf für den dem auch aber was wie noch sehr sind habe bin es im",
    pt: "o os as de que e é um uma não para com do da em eu você mas muito está isso no na por se mais também tem são",
    id: "yang dan di ke dari ini itu tidak aku saya kamu apa ada untuk dengan juga sudah belum bisa akan mau lagi kita kami ya gak nggak sama tapi karena",
    vi: "và của là không có tôi bạn được những này một người cho với đã rồi thì mình nhé",
};

const SETS = Object.fromEntries(
    Object.entries(COMMON_WORDS).map(([family, words]) => [family, new Set(words.split(" "))]),
);

// Letters only Vietnamese uses among these languages; â ê ô are left out because French has them.
const VIETNAMESE = /[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
const WORD = /[\p{L}']+/gu;
const MIN_WORDS = 3;
const MIN_SHARE = 0.2;

export function latinFamily(code) {
    const family = String(code || "").startsWith("pt") ? "pt" : code;
    return SETS[family] ? family : null;
}

// Only a clear verdict counts: enough words, a fair share of them the target's own, and more
// of them than of any other language. Anything less is sent, and the model's unchanged answer
// is what marks it as already translated.
export function isClearlyIn(text, family) {
    WORD.lastIndex = 0;
    const words = String(text).toLowerCase().match(WORD) ?? [];
    if (words.length < MIN_WORDS || !SETS[family]) return false;

    const score = (candidate) =>
        words.filter((word) => SETS[candidate].has(word) || (candidate === "vi" && VIETNAMESE.test(word)))
            .length;

    const own = score(family);
    if (own < 2 || own / words.length < MIN_SHARE) return false;
    return Object.keys(SETS).every((other) => other === family || score(other) < own);
}
